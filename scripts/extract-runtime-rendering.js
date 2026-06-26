const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainPath = path.join(root, "src", "main.js");
const gamePath = path.join(root, "game.js");
const canvasPath = path.join(root, "src", "ui", "render-canvas.js");
const uiPath = path.join(root, "src", "ui", "render-ui.js");

function fail(message) {
  throw new Error(`runtime rendering extraction: ${message}`);
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`);
}

function removeRanges(source, ranges) {
  return [...ranges]
    .sort((left, right) => right.start - left.start)
    .reduce((result, range) => result.slice(0, range.start) + result.slice(range.end), source);
}

function buildLoader() {
  return `// Ordered classic-script bootstrap during the mechanical extraction phase.\n// Each file shares one global lexical environment; src/main.js remains the composition root.\n(() => {\n  const runtimeFiles = [\n    "./src/ui/dom.js",\n    "./src/core/constants.js",\n    "./src/data/i18n.js",\n    "./src/data/infinity-data.js",\n    "./src/core/state.js",\n    "./src/core/numbers.js",\n    "./src/core/save.js",\n    "./src/systems/achievements.js",\n    "./src/ui/render-canvas.js",\n    "./src/ui/render-ui.js",\n    "./src/main.js",\n  ];\n\n  function loadClassicScript(path) {\n    return new Promise((resolve, reject) => {\n      const script = document.createElement("script");\n      script.src = path;\n      script.async = false;\n      script.onload = resolve;\n      script.onerror = () => reject(new Error(\`Failed to load \${path}\`));\n      document.head.appendChild(script);\n    });\n  }\n\n  runtimeFiles\n    .reduce((chain, path) => chain.then(() => loadClassicScript(path)), Promise.resolve())\n    .catch((error) => console.error("Angle Incremental failed to start", error));\n})();\n`;
}

function rangeBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1 || end <= start) fail(`missing range ${startMarker} -> ${endMarker}`);
  return { start, end };
}

function extract() {
  const source = fs.readFileSync(mainPath, "utf8");
  const canvas = rangeBetween(source, "function vertexPoint(index, total = state.vertices)", "function applyLanguage()");
  const ui = rangeBetween(source, "function applyLanguage()", "function spendLog(amountLog)");

  const header = "// Extracted mechanically from the next-runtime baseline.\n// Runtime dependencies remain unchanged during the classic-script migration phase.\n\n";
  writeFile(canvasPath, `${header}${source.slice(canvas.start, canvas.end)}`);
  writeFile(uiPath, `${header}${source.slice(ui.start, ui.end)}`);
  writeFile(mainPath, removeRanges(source, [canvas, ui]));
  writeFile(gamePath, buildLoader());

  const output = fs.readFileSync(mainPath, "utf8");
  if (output.includes("function vertexPoint(index, total = state.vertices)") || output.includes("function applyLanguage()")) {
    fail("rendering functions remain in src/main.js");
  }
  console.log("extracted canvas and UI rendering functions");
}

extract();
