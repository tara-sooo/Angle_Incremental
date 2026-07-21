import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
if (!address || typeof address === "string") throw new Error("failed to bind performance server");

const browser = await chromium.launch({ headless: true, args: ["--use-gl=disabled"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
  });
  await page.goto(`http://127.0.0.1:${address.port}/index.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__angleDebug?.state && window.__angleDebug?.ready));
  await page.evaluate(() => window.__angleDebug.ready);

  const result = await page.evaluate(() => {
    const debug = window.__angleDebug;
    const state = debug.state;

    function summarize(samples) {
      const sorted = [...samples].sort((a, b) => a - b);
      const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
      return {
        count: samples.length,
        meanMs: samples.reduce((total, sample) => total + sample, 0) / samples.length,
        p50Ms: percentile(0.50),
        p95Ms: percentile(0.95),
        maxMs: sorted[sorted.length - 1],
      };
    }

    function resetScenario() {
      state.activeChallenge = 0;
      state.vertices = 3;
      state.speedLevel = 0;
      state.gainLevel = 0;
      state.pointProgress = 0;
      state.totalVertexProgress = 0;
      state.score = 0;
      state.scoreLog10 = -Infinity;
      state.totalScore = 0;
      state.totalScoreLog10 = -Infinity;
      state.generationScore = 0;
      state.generationScoreLog10 = -Infinity;
      debug.switchMainTab("angle");
    }

    function measure(callback, iterations = 120) {
      const samples = [];
      for (let index = 0; index < iterations; index += 1) {
        const start = performance.now();
        callback();
        samples.push(performance.now() - start);
      }
      return samples;
    }

    resetScenario();
    const normalSimulation = measure(() => debug.update(1 / 60));
    resetScenario();
    const normalFrame = measure(() => window.advanceTime(1000 / 60));

    resetScenario();
    state.vertices = 10000;
    state.speedLevel = 300;
    state.gainLevel = 100;
    const highLoadSimulation = measure(() => debug.update(1 / 60));
    resetScenario();
    state.vertices = 10000;
    state.speedLevel = 300;
    state.gainLevel = 100;
    const highLoadFrame = measure(() => window.advanceTime(1000 / 60));

    debug.switchMainTab("infinity");
    const hiddenAngleFrame = measure(() => window.advanceTime(1000 / 60));
    debug.switchMainTab("angle");

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      normalSimulation: summarize(normalSimulation),
      normalFrame: summarize(normalFrame),
      highLoadSimulation: summarize(highLoadSimulation),
      highLoadFrame: summarize(highLoadFrame),
      hiddenAngleFrame: summarize(hiddenAngleFrame),
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
