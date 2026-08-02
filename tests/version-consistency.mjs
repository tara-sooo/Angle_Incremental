import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePaths = Object.freeze({
  constants: "src/core/constants.js",
  manifest: "version.json",
  index: "index.html",
  i18n: "src/data/i18n.js",
  events: "src/ui/events.js",
  browserSmoke: "tests/browser-smoke.mjs",
  performanceSmoke: "tests/performance-smoke.mjs",
});

async function readOptionalFile(rootDir, relativePath) {
  try {
    return await readFile(path.join(rootDir, relativePath), "utf8");
  } catch (error) {
    return null;
  }
}

export async function loadVersionSources(rootDir = repositoryRoot) {
  const entries = await Promise.all(
    Object.entries(sourcePaths).map(async ([key, relativePath]) => [
      key,
      await readOptionalFile(rootDir, relativePath),
    ]),
  );
  return Object.fromEntries(entries);
}

export function extractAppVersion(constantsSource) {
  if (typeof constantsSource !== "string") return null;
  const match = constantsSource.match(/\bconst\s+APP_VERSION\s*=\s*(["'`])([^"'`]+)\1/);
  return match?.[2] || null;
}

function issue(label, expected, actual) {
  return {
    label,
    expected: expected || "<missing>",
    actual: actual || "<missing>",
    message: `${label}: expected "${expected || "<missing>"}", found "${actual || "<missing>"}"`,
  };
}

function compareVersion(issues, label, expected, actual) {
  if (!expected || actual !== expected) issues.push(issue(label, expected, actual));
}

function parseManifest(manifestSource) {
  if (typeof manifestSource !== "string") return null;
  try {
    return JSON.parse(manifestSource);
  } catch (error) {
    return null;
  }
}

function extractLocaleBlock(i18nSource, locale, nextLocale) {
  if (typeof i18nSource !== "string") return null;
  const boundary = nextLocale
    ? `\\n\\s*\\},\\s*\\n\\s*${nextLocale}:\\s*\\{`
    : "\\n\\s*\\},\\s*\\n\\s*\\};";
  const match = i18nSource.match(new RegExp(`(?:^|\\n)\\s*${locale}:\\s*\\{([\\s\\S]*?)(?=${boundary})`));
  return match?.[1] || null;
}

function extractUpdateTitle(i18nSource, locale, nextLocale) {
  const block = extractLocaleBlock(i18nSource, locale, nextLocale);
  if (!block) return null;
  return block.match(/\bupdateTitle\s*:\s*(["'`])([^"'`]*)\1/)?.[2] || null;
}

function extractHtmlUpdateTitle(indexSource) {
  if (typeof indexSource !== "string") return null;
  return indexSource.match(/<h2[^>]*data-i18n=["']updateTitle["'][^>]*>([^<]*)<\/h2>/)?.[1]?.trim() || null;
}

function extractCacheVersions(source, pattern) {
  if (typeof source !== "string") return [];
  return [...source.matchAll(pattern)].map((match) => ({ path: match[1], version: match[2] || null }));
}

function extractJavaScriptCacheVersions(indexSource) {
  if (typeof indexSource !== "string") return [];
  const extract = (pattern) => [...indexSource.matchAll(pattern)].map((match) => {
    const [assetPath, query = ""] = match[1].split("?", 2);
    const version = query.match(/(?:^|&)v=([^&]*)/)?.[1] || null;
    return { path: assetPath, version };
  });
  return [
    ...extract(/:\s*["']([^"']+\.js(?:\?[^"']*)?)["']/g),
    ...extract(/\bsrc\s*=\s*["']([^"']+\.js(?:\?[^"']*)?)["']/g),
  ];
}

export function collectVersionConsistencyIssues(sources) {
  const issues = [];
  const expected = extractAppVersion(sources.constants);
  if (!expected) issues.push(issue("src/core/constants.js APP_VERSION", "a non-empty version", null));

  const manifest = parseManifest(sources.manifest);
  compareVersion(issues, "version.json appVersion", expected, manifest?.appVersion);

  const cssVersions = extractCacheVersions(
    sources.index,
    /["']([^"']*styles\.css)\?v=([^"'&\s]+)["']/g,
  );
  if (cssVersions.length === 0) {
    issues.push(issue("index.html CSS cache buster", expected, null));
  } else {
    cssVersions.forEach(({ path: assetPath, version }) => {
      compareVersion(issues, `index.html CSS cache buster (${assetPath})`, expected, version);
    });
  }

  const jsVersions = extractJavaScriptCacheVersions(sources.index);
  if (jsVersions.length === 0) {
    issues.push(issue("index.html JavaScript cache buster", expected, null));
  } else {
    jsVersions.forEach(({ path: assetPath, version }) => {
      compareVersion(issues, `index.html JavaScript cache buster (${assetPath})`, expected, version);
    });
    if (!jsVersions.some(({ path: assetPath }) => assetPath.endsWith("src/main.js"))) {
      issues.push(issue("index.html main.js cache buster", expected, null));
    }
  }

  const eventsVersions = extractCacheVersions(
    sources.events,
    /["']([^"']+\.js)\?v=([^"'&\s]+)["']/g,
  );
  if (eventsVersions.length === 0) {
    issues.push(issue("src/ui/events.js module cache buster", expected, null));
  } else {
    eventsVersions.forEach(({ path: assetPath, version }) => {
      compareVersion(issues, `src/ui/events.js module cache buster (${assetPath})`, expected, version);
    });
  }

  compareVersion(issues, "index.html update modal fallback", expected, extractHtmlUpdateTitle(sources.index)?.match(/\d+\.\d+\.\d+/)?.[0]);
  compareVersion(issues, "src/data/i18n.js Japanese updateTitle", expected, extractUpdateTitle(sources.i18n, "ja", "en")?.match(/\d+\.\d+\.\d+/)?.[0]);
  compareVersion(issues, "src/data/i18n.js English updateTitle", expected, extractUpdateTitle(sources.i18n, "en")?.match(/\d+\.\d+\.\d+/)?.[0]);

  return issues;
}

export function formatVersionConsistencyIssues(issues) {
  return [
    "Version consistency check failed:",
    ...issues.map(({ message }) => `- ${message}`),
  ].join("\n");
}

async function main() {
  const sources = await loadVersionSources();
  const issues = collectVersionConsistencyIssues(sources);
  if (issues.length > 0) {
    console.error(formatVersionConsistencyIssues(issues));
    process.exitCode = 1;
    return;
  }
  console.log(`Version consistency check passed: ${extractAppVersion(sources.constants)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
