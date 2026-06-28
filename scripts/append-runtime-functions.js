const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainPath = path.join(root, "src", "main.js");

const TARGETS = {
  helpers: [
    {
      path: "src/data/i18n.js",
      names: ["t"],
    },
    {
      path: "src/core/state.js",
      names: ["normalizeChoice"],
    },
    {
      path: "src/core/numbers.js",
      names: [
        "formatNumber", "formatUiNumber", "formatUiLogNumber", "formatLogNumber",
        "formatScientificLog", "formatPowerOfTen", "formatSmallDecimal", "formatDuration", "formatLongDuration",
      ],
    },
    {
      path: "src/ui/render-canvas.js",
      names: ["resizeCanvas"],
    },
    {
      path: "src/ui/render-ui.js",
      names: [
        "setSaveStatus", "gainExpressionConfig", "formatGainExpression", "gainExpressionParts",
        "hasMultiplicativeGainExpression", "formatGainExpressionSummary", "challengeText",
        "formatMultiplierPreview", "formatMultiplierLog", "formatMultiplierLogPreview",
        "formatExponentPreview", "balanceCreateInfinityUpgradeRows",
      ],
    },
  ],
};

function fail(message) {
  throw new Error(`runtime function append: ${message}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function findFunctionBodyOpening(source, start) {
  let parameterDepth = 0;
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
    if (character === "(") { parameterDepth += 1; continue; }
    if (character === ")") { parameterDepth -= 1; continue; }
    if (character === "{" && parameterDepth === 0) return index;
  }
  fail("function body opening brace not found");
}

function findFunctionEnd(source, start) {
  const opening = findFunctionBodyOpening(source, start);
  let depth = 0;
  for (let index = opening; index < source.length; index += 1) {
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
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  fail("unterminated function declaration");
}

function functionRange(source, name) {
  const expression = new RegExp(`^function\\s+${escapeRegExp(name)}\\s*\\(`, "m");
  const match = expression.exec(source);
  if (!match) fail(`missing function ${name}`);
  return { name, start: match.index, end: findFunctionEnd(source, match.index) };
}

function removeRanges(source, ranges) {
  return [...ranges]
    .sort((left, right) => right.start - left.start)
    .reduce((result, range) => result.slice(0, range.start) + result.slice(range.end), source);
}

function appendFunctions(targetPath, chunks) {
  const filePath = path.join(root, targetPath);
  const original = fs.readFileSync(filePath, "utf8");
  fs.writeFileSync(filePath, `${original.trimEnd()}\n\n// Mechanically appended from src/main.js during the parity-preserving migration.\n\n${chunks.join("\n\n")}\n`);
}

function extract(target) {
  const destinations = TARGETS[target];
  if (!destinations) fail(`unknown target ${target}`);
  const source = fs.readFileSync(mainPath, "utf8");
  const ranges = [];

  destinations.forEach((destination) => {
    const destinationRanges = destination.names.map((name) => functionRange(source, name));
    appendFunctions(
      destination.path,
      destinationRanges
        .sort((left, right) => left.start - right.start)
        .map((range) => source.slice(range.start, range.end)),
    );
    ranges.push(...destinationRanges);
  });

  fs.writeFileSync(mainPath, removeRanges(source, ranges));
  const output = fs.readFileSync(mainPath, "utf8");
  ranges.forEach(({ name }) => {
    if (new RegExp(`^function\\s+${escapeRegExp(name)}\\s*\\(`, "m").test(output)) {
      fail(`function ${name} remains in src/main.js`);
    }
  });
  console.log(`appended ${ranges.length} functions for ${target}`);
}

extract(process.argv[2]);
