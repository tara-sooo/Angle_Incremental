import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const expectedAppVersion = JSON.parse(await readFile(path.join(root, "version.json"), "utf8")).appVersion;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://127.0.0.1").pathname);
  const relative = path.normalize((pathname === "/" ? "/index.html" : pathname).replace(/^\/+/, ""));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return path.join(root, relative);
}

export async function startGameTest() {
  const server = createServer(async (request, response) => {
    const filePath = resolveRequestPath(request.url || "/");
    if (!filePath) {
      response.writeHead(403).end();
      return;
    }
    try {
      const metadata = await stat(filePath);
      if (!metadata.isFile()) throw new Error("not a file");
      response.writeHead(200, { "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
      response.end(await readFile(filePath));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to bind game test server");
  const browser = await chromium.launch({ headless: true, args: ["--use-gl=disabled"] });
  return {
    browser,
    origin: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

export async function stubExternalFonts(target) {
  await target.route("https://fonts.googleapis.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/css",
    body: "",
  }));
  await target.route("https://fonts.gstatic.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "font/woff2",
    body: "",
  }));
}

export function trackPage(page, scope, errors, httpFailures) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) httpFailures.push({ scope, type: "response", status: response.status(), url: response.url() });
  });
  page.on("requestfailed", (request) => {
    httpFailures.push({
      scope,
      type: "requestfailed",
      status: 0,
      url: request.url(),
      error: request.failure()?.errorText ?? "unknown",
    });
  });
}

export async function openGamePage(browser, origin, {
  viewport,
  deviceScaleFactor,
  hasTouch = false,
  isMobile = false,
  seenVersion = expectedAppVersion,
  stubFonts = false,
  freezeAnimationFrame = true,
}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor, hasTouch, isMobile });
  if (stubFonts) await stubExternalFonts(context);
  const page = await context.newPage();
  await page.addInitScript(({ appVersion, freezeAnimationFrame: shouldFreezeAnimationFrame }) => {
    if (shouldFreezeAnimationFrame) window.requestAnimationFrame = () => 0;
    if (appVersion) localStorage.setItem("angle-incremental-seen-version", appVersion);
  }, { appVersion: seenVersion, freezeAnimationFrame });
  await page.goto(`${origin}/index.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__angleDebug?.state && window.__angleDebug?.ready));
  await page.evaluate(() => window.__angleDebug.ready);
  return { context, page };
}

export async function writeReport(reportPath, report) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
