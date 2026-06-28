const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainPath = path.join(root, "src", "main.js");
const gamePath = path.join(root, "game.js");
const savePath = path.join(root, "src", "core", "save.js");

function fail(message) {
  throw new Error(`runtime save extraction: ${message}`);
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`);
}

function buildLoader() {
  return `// Ordered classic-script bootstrap during the mechanical extraction phase.\n// Each file shares one global lexical environment; src/main.js remains the composition root.\n(() => {\n  const runtimeFiles = [\n    "./src/core/constants.js",\n    "./src/data/i18n.js",\n    "./src/data/infinity-data.js",\n    "./src/core/state.js",\n    "./src/core/save.js",\n    "./src/main.js",\n  ];\n\n  function loadClassicScript(path) {\n    return new Promise((resolve, reject) => {\n      const script = document.createElement("script");\n      script.src = path;\n      script.async = false;\n      script.onload = resolve;\n      script.onerror = () => reject(new Error(\`Failed to load \${path}\`));\n      document.head.appendChild(script);\n    });\n  }\n\n  runtimeFiles\n    .reduce((chain, path) => chain.then(() => loadClassicScript(path)), Promise.resolve())\n    .catch((error) => console.error("Angle Incremental failed to start", error));\n})();\n`;
}

function extract() {
  const source = fs.readFileSync(mainPath, "utf8");
  const startMarker = "function legacyInfinityUpgradeRefundLog10(data)";
  const endMarker = "function formatNumber(value)";
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1 || end <= start) {
    fail("save function region is missing or already extracted");
  }

  const header = "// Extracted mechanically from the next-runtime baseline.\n// Numeric helpers and UI hooks remain in src/main.js during this migration phase.\n\n";
  writeFile(savePath, `${header}${source.slice(start, end)}`);
  writeFile(mainPath, source.slice(0, start) + source.slice(end));
  writeFile(gamePath, buildLoader());

  const output = fs.readFileSync(mainPath, "utf8");
  if (output.includes(startMarker) || output.includes("function applySaveData(data,")) {
    fail("save functions remain in src/main.js");
  }
  console.log("extracted save and persistence functions");
}

extract();
