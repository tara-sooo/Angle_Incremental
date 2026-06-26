// Triggered once by the extraction workflow; retained as deterministic migration tooling.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainPath = path.join(root, "src", "main.js");
const gamePath = path.join(root, "game.js");
const constantsPath = path.join(root, "src", "core", "constants.js");
const i18nPath = path.join(root, "src", "data", "i18n.js");
const infinityDataPath = path.join(root, "src", "data", "infinity-data.js");

function fail(message) {
  throw new Error(`runtime definition extraction: ${message}`);
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

function callRange(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) fail(`missing call ${marker}`);
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
  return `// Ordered classic-script bootstrap during the mechanical extraction phase.\n// Each file shares one global lexical environment; src/main.js remains the composition root.\n(() => {\n  const runtimeFiles = [\n    "./src/core/constants.js",\n    "./src/data/i18n.js",\n    "./src/data/infinity-data.js",\n    "./src/main.js",\n  ];\n\n  function loadClassicScript(path) {\n    return new Promise((resolve, reject) => {\n      const script = document.createElement("script");\n      script.src = path;\n      script.async = false;\n      script.onload = resolve;\n      script.onerror = () => reject(new Error(\`Failed to load \${path}\`));\n      document.head.appendChild(script);\n    });\n  }\n\n  runtimeFiles\n    .reduce((chain, path) => chain.then(() => loadClassicScript(path)), Promise.resolve())\n    .catch((error) => console.error("Angle Incremental failed to start", error));\n})();\n`;
}

function extract() {
  const source = fs.readFileSync(mainPath, "utf8");
  if (!source.includes("const BASE_LAP_SECONDS =")) {
    fail("src/main.js is already transformed; refuse to overwrite extracted files");
  }

  const constantsStart = source.indexOf("const BASE_LAP_SECONDS =");
  const text = declarationRange(source, "TEXT");
  const constants = source.slice(constantsStart, text.start);
  const challenges = declarationRange(source, "INFINITY_CHALLENGES");
  const upgrades = declarationRange(source, "INFINITY_UPGRADES");
  const balanceProfile = declarationRange(source, "BALANCE_PROFILE");
  const balanceUpgrades = declarationRange(source, "BALANCE_INFINITY_UPGRADES");
  const applyBalancedUpgrades = callRange(source, "BALANCE_INFINITY_UPGRADES.forEach");

  if (!(constantsStart < text.start && text.end < challenges.start && challenges.end < upgrades.start)) {
    fail("definition blocks are not in the expected order");
  }

  const header = "// Extracted mechanically from the next-runtime baseline. Keep declaration order stable during migration.\n\n";
  writeFile(constantsPath, `${header}${constants}`);
  writeFile(i18nPath, `${header}${source.slice(text.start, text.end)}`);
  writeFile(
    infinityDataPath,
    `${header}${source.slice(challenges.start, challenges.end)}\n\n${source.slice(upgrades.start, upgrades.end)}\n\n${source.slice(balanceProfile.start, balanceProfile.end)}\n\n${source.slice(balanceUpgrades.start, balanceUpgrades.end)}\n\n${source.slice(applyBalancedUpgrades.start, applyBalancedUpgrades.end)}`,
  );

  const rewrittenMain = removeRanges(source, [
    { start: constantsStart, end: text.start },
    text,
    challenges,
    upgrades,
    balanceProfile,
    balanceUpgrades,
    applyBalancedUpgrades,
  ]);

  writeFile(mainPath, rewrittenMain);
  writeFile(gamePath, buildLoader());

  const output = fs.readFileSync(mainPath, "utf8");
  if (output.includes("const BASE_LAP_SECONDS =") || output.includes("const TEXT =") || output.includes("const INFINITY_CHALLENGES =")) {
    fail("one or more data declarations remain in src/main.js");
  }
  console.log("extracted constants, localization, and Infinity data");
}

extract();
