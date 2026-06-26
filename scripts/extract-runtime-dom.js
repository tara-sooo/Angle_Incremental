const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainPath = path.join(root, "src", "main.js");
const gamePath = path.join(root, "game.js");
const domPath = path.join(root, "src", "ui", "dom.js");

function fail(message) {
  throw new Error(`runtime DOM extraction: ${message}`);
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`);
}

function buildLoader() {
  return `// Ordered classic-script bootstrap during the mechanical extraction phase.\n// Each file shares one global lexical environment; src/main.js remains the composition root.\n(() => {\n  const runtimeFiles = [\n    "./src/ui/dom.js",\n    "./src/core/constants.js",\n    "./src/data/i18n.js",\n    "./src/data/infinity-data.js",\n    "./src/core/state.js",\n    "./src/core/numbers.js",\n    "./src/core/save.js",\n    "./src/main.js",\n  ];\n\n  function loadClassicScript(path) {\n    return new Promise((resolve, reject) => {\n      const script = document.createElement("script");\n      script.src = path;\n      script.async = false;\n      script.onload = resolve;\n      script.onerror = () => reject(new Error(\`Failed to load \${path}\`));\n      document.head.appendChild(script);\n    });\n  }\n\n  runtimeFiles\n    .reduce((chain, path) => chain.then(() => loadClassicScript(path)), Promise.resolve())\n    .catch((error) => console.error("Angle Incremental failed to start", error));\n})();\n`;
}

function extract() {
  const source = fs.readFileSync(mainPath, "utf8");
  const endMarker = "const ACHIEVEMENTS =";
  const end = source.indexOf(endMarker);
  if (!source.startsWith("const canvas =") || end === -1) {
    fail("DOM declarations are missing or already extracted");
  }

  const header = "// Extracted mechanically from the next-runtime baseline.\n// DOM bindings are evaluated before the runtime composition root.\n\n";
  writeFile(domPath, `${header}${source.slice(0, end)}`);
  writeFile(mainPath, source.slice(end));
  writeFile(gamePath, buildLoader());

  const output = fs.readFileSync(mainPath, "utf8");
  if (output.startsWith("const canvas =") || output.includes("const elements =")) {
    fail("DOM declarations remain in src/main.js");
  }
  console.log("extracted DOM bindings");
}

extract();
