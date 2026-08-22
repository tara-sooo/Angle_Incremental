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

export async function openGamePage(browser, origin, { viewport, deviceScaleFactor }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor });
  const page = await context.newPage();
  await page.addInitScript(({ appVersion }) => {
    window.requestAnimationFrame = () => 0;
    localStorage.setItem("angle-incremental-seen-version", appVersion);
  }, { appVersion: expectedAppVersion });
  await page.goto(`${origin}/index.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__angleDebug?.state && window.__angleDebug?.ready));
  await page.evaluate(() => window.__angleDebug.ready);
  return { context, page };
}

export async function writeReport(reportPath, report) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
