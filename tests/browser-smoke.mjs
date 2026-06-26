import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = path.join(root, "browser-smoke-report.json");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};
const EXPECTED_ASSET_VERSION = "0.1.0";
const EXPECTED_MODULE_PATHS = [
  "/src/main.js",
  "/src/runtime/shared.js",
  "/src/ui/dom.js",
  "/src/core/constants.js",
  "/src/data/i18n.js",
  "/src/data/infinity-data.js",
  "/src/core/state.js",
  "/src/core/numbers.js",
  "/src/core/save.js",
  "/src/systems/achievements.js",
  "/src/ui/render-canvas.js",
  "/src/ui/render-ui.js",
  "/src/systems/angle.js",
  "/src/systems/generation.js",
  "/src/systems/core-boost.js",
  "/src/systems/infinity.js",
  "/src/systems/infinity-point-normalization.js",
  "/src/ui/events.js",
];

function resolveRequestPath(requestUrl) {
  const parsed = new URL(requestUrl, "http://127.0.0.1");
  const requested = decodeURIComponent(parsed.pathname === "/" ? "/index.html" : parsed.pathname);
  const relative = path.normalize(requested.replace(/^\/+/, ""));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return path.join(root, relative);
}

const server = createServer(async (request, response) => {
  const filePath = resolveRequestPath(request.url || "/");
  if (!filePath) {
    response.writeHead(403).end();
    return;
  }
  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile()) throw new Error("not a file");
    const extension = path.extname(filePath);
    response.writeHead(200, { "content-type": contentTypes[extension] || "application/octet-stream" });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("failed to bind smoke-test server");

const browser = await chromium.launch({ headless: true });
const report = {
  result: "running",
  expectedAssetVersion: EXPECTED_ASSET_VERSION,
  errors: [],
  moduleRequests: [],
};
try {
  const page = await browser.newPage();
  const errors = [];
  const moduleRequests = [];
  const localOrigin = `http://127.0.0.1:${address.port}`;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === localOrigin && url.pathname.startsWith("/src/") && url.pathname.endsWith(".js")) {
      moduleRequests.push(url);
    }
  });

  await page.goto(`${localOrigin}/index.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => (
    typeof window.render_game_to_text === "function"
    && Boolean(window.__angleDebug?.state)
  ));

  const snapshot = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  assert.equal(snapshot.vertices, 3);
  assert.equal(snapshot.infinity.count, 0);
  assert.equal(typeof snapshot.score, "string");

  const requestedModulePaths = new Set(moduleRequests.map((url) => url.pathname));
  EXPECTED_MODULE_PATHS.forEach((modulePath) => {
    assert.ok(requestedModulePaths.has(modulePath), `expected ${modulePath} to be requested`);
  });
  assert.ok(
    moduleRequests.every((url) => url.searchParams.get("v") === EXPECTED_ASSET_VERSION),
    "every game ESM module must use the current versioned URL",
  );

  await page.evaluate(() => {
    window.__angleFullscreenRequests = 0;
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: () => {
        window.__angleFullscreenRequests += 1;
        return Promise.resolve();
      },
    });
  });
  await page.locator("#saveCodeArea").focus();
  await page.keyboard.press("f");
  assert.equal(
    await page.evaluate(() => window.__angleFullscreenRequests),
    0,
    "typing f in the save-code area must not toggle fullscreen",
  );
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press("f");
  assert.equal(
    await page.evaluate(() => window.__angleFullscreenRequests),
    1,
    "plain f outside an editable element must still toggle fullscreen",
  );

  assert.deepEqual(errors, []);
  report.result = "passed";
  console.log("browser ESM smoke test passed");
} catch (error) {
  report.result = "failed";
  report.failure = error instanceof Error ? error.stack || error.message : String(error);
  throw error;
} finally {
  try {
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    console.error("failed to write browser smoke report", error);
  }
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
