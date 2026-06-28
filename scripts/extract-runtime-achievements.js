const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainPath = path.join(root, "src", "main.js");
const gamePath = path.join(root, "game.js");
const achievementsPath = path.join(root, "src", "systems", "achievements.js");

function fail(message) {
  throw new Error(`runtime achievement extraction: ${message}`);
}

function skipString(source, index) {
  const quote = source[index];
  index += 1;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source[index] === quote) return index + 1;
    index += 1;
  }
  fail("unterminated string literal");
}

function skipLineComment(source, index) {
  const end = source.indexOf("\n", index + 2);
  return end === -1 ? source.length : end + 1;
}

function skipBlockComment(source, index) {
  const end = source.indexOf("*/", index + 2);
  if (end === -1) fail("unterminated block comment");
  return end + 2;
}

function findStatementEnd(source, start) {
  const expectedClosings = [];
  const closingFor = { "(": ")", "[": "]", "{": "}" };
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (character === "'" || character === '"' || character === "`") {
      index = skipString(source, index) - 1;
      continue;
    }
    if (character === "/" && next === "/") {
      index = skipLineComment(source, index) - 1;
      continue;
    }
    if (character === "/" && next === "*") {
      index = skipBlockComment(source, index) - 1;
      continue;
    }
    if (closingFor[character]) {
      expectedClosings.push(closingFor[character]);
      continue;
    }
    if ([")", "]", "}"].includes(character)) {
      const expected = expectedClosings.pop();
      if (character !== expected) fail("mismatched delimiter");
      continue;
    }
    if (character === ";" && expectedClosings.length === 0) return index + 1;
  }
  fail("unterminated statement");
}

function declarationRange(source, name) {
  const start = source.indexOf(`const ${name} =`);
  if (start === -1) fail(`missing declaration ${name}`);
  return { start, end: findStatementEnd(source, start) };
}

function removeRanges(source, ranges) {
  return [...ranges]
    .sort((left, right) => right.start - left.start)
    .reduce((result, range) => result.slice(0, range.start) + result.slice(range.end), source);
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`);
}

function buildLoader() {
  return `// Ordered classic-script bootstrap during the mechanical extraction phase.\n// Each file shares one global lexical environment; src/main.js remains the composition root.\n(() => {\n  const runtimeFiles = [\n    "./src/ui/dom.js",\n    "./src/core/constants.js",\n    "./src/data/i18n.js",\n    "./src/data/infinity-data.js",\n    "./src/core/state.js",\n    "./src/core/numbers.js",\n    "./src/core/save.js",\n    "./src/systems/achievements.js",\n    "./src/main.js",\n  ];\n\n  function loadClassicScript(path) {\n    return new Promise((resolve, reject) => {\n      const script = document.createElement("script");\n      script.src = path;\n      script.async = false;\n      script.onload = resolve;\n      script.onerror = () => reject(new Error(\`Failed to load \${path}\`));\n      document.head.appendChild(script);\n    });\n  }\n\n  runtimeFiles\n    .reduce((chain, path) => chain.then(() => loadClassicScript(path)), Promise.resolve())\n    .catch((error) => console.error("Angle Incremental failed to start", error));\n})();\n`;
}

function extract() {
  const source = fs.readFileSync(mainPath, "utf8");
  const definitions = declarationRange(source, "ACHIEVEMENTS");
  const functionStartMarker = "function isAchievementUnlocked(id)";
  const functionEndMarker = "function isChallengeCompleted(index)";
  const functionStart = source.indexOf(functionStartMarker);
  const functionEnd = source.indexOf(functionEndMarker, functionStart);
  if (definitions.start !== 0 || functionStart === -1 || functionEnd === -1 || functionStart >= functionEnd) {
    fail("achievement declarations are missing or already extracted");
  }

  const header = "// Extracted mechanically from the next-runtime baseline.\n// Unlock checks retain their original runtime dependencies during migration.\n\n";
  writeFile(achievementsPath, `${header}${source.slice(definitions.start, definitions.end)}\n\n${source.slice(functionStart, functionEnd)}`);
  writeFile(mainPath, removeRanges(source, [definitions, { start: functionStart, end: functionEnd }]));
  writeFile(gamePath, buildLoader());

  const output = fs.readFileSync(mainPath, "utf8");
  if (output.includes("const ACHIEVEMENTS =") || output.includes(functionStartMarker)) {
    fail("achievement declarations remain in src/main.js");
  }
  console.log("extracted achievement definitions and checks");
}

extract();
