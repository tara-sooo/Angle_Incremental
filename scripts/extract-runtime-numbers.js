const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainPath = path.join(root, "src", "main.js");
const gamePath = path.join(root, "game.js");
const numbersPath = path.join(root, "src", "core", "numbers.js");

function fail(message) {
  throw new Error(`runtime numbers extraction: ${message}`);
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`);
}

function buildLoader() {
  return `// Ordered classic-script bootstrap during the mechanical extraction phase.\n// Each file shares one global lexical environment; src/main.js remains the composition root.\n(() => {\n  const runtimeFiles = [\n    "./src/core/constants.js",\n    "./src/data/i18n.js",\n    "./src/data/infinity-data.js",\n    "./src/core/state.js",\n    "./src/core/numbers.js",\n    "./src/core/save.js",\n    "./src/main.js",\n  ];\n\n  function loadClassicScript(path) {\n    return new Promise((resolve, reject) => {\n      const script = document.createElement("script");\n      script.src = path;\n      script.async = false;\n      script.onload = resolve;\n      script.onerror = () => reject(new Error(\`Failed to load \${path}\`));\n      document.head.appendChild(script);\n    });\n  }\n\n  runtimeFiles\n    .reduce((chain, path) => chain.then(() => loadClassicScript(path)), Promise.resolve())\n    .catch((error) => console.error("Angle Incremental failed to start", error));\n})();\n`;
}

function extract() {
  const source = fs.readFileSync(mainPath, "utf8");
  const firstStartMarker = "function parseSavedNumber(value)";
  const firstEndMarker = "function formatNumber(value)";
  const secondStartMarker = "function log10Value(value)";
  const secondEndMarker = "function currentScoreLog10()";
  const firstStart = source.indexOf(firstStartMarker);
  const firstEnd = source.indexOf(firstEndMarker, firstStart);
  const secondStart = source.indexOf(secondStartMarker, firstEnd);
  const secondEnd = source.indexOf(secondEndMarker, secondStart);

  if ([firstStart, firstEnd, secondStart, secondEnd].some((value) => value === -1)
    || !(firstStart < firstEnd && firstEnd < secondStart && secondStart < secondEnd)) {
    fail("numeric helper regions are missing or already extracted");
  }

  const header = "// Extracted mechanically from the next-runtime baseline.\n// State-dependent progression and UI formatting remain outside this helper module.\n\n";
  writeFile(numbersPath, `${header}${source.slice(firstStart, firstEnd)}\n\n${source.slice(secondStart, secondEnd)}`);
  writeFile(mainPath, source.slice(0, secondStart) + source.slice(secondEnd));
  const afterSecond = fs.readFileSync(mainPath, "utf8");
  writeFile(mainPath, afterSecond.slice(0, firstStart) + afterSecond.slice(firstEnd));
  writeFile(gamePath, buildLoader());

  const output = fs.readFileSync(mainPath, "utf8");
  if (output.includes(firstStartMarker) || output.includes(secondStartMarker)) {
    fail("numeric helpers remain in src/main.js");
  }
  console.log("extracted numeric helpers");
}

extract();
