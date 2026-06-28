const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainPath = path.join(root, "src", "main.js");
const gamePath = path.join(root, "game.js");
const orderPath = path.join(root, "tests", "candidate-runtime-order.js");
const eventsPath = path.join(root, "src", "ui", "events.js");

function fail(message) {
  throw new Error(`runtime events extraction: ${message}`);
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

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`);
}

function insertBeforeMain(source, line, replacement) {
  if (source.includes(replacement.trim())) return source;
  if (!source.includes(line)) fail(`missing insertion point ${line.trim()}`);
  return source.replace(line, `${replacement}${line}`);
}

function extract() {
  if (fs.existsSync(eventsPath)) fail("src/ui/events.js already exists");
  const source = fs.readFileSync(mainPath, "utf8");
  const functions = ["switchMainTab", "switchInfinitySubtab", "applySetting"].map((name) => functionRange(source, name));
  const blockStartMarker = "elements.speedUpgrade.addEventListener(\"click\", buySpeed);";
  const blockEndMarker = "createChallengeRows();";
  const blockStart = source.indexOf(blockStartMarker);
  const blockEnd = source.indexOf(blockEndMarker, blockStart);
  if (blockStart === -1 || blockEnd === -1 || blockStart >= blockEnd) fail("event binding block not found");

  const header = "// Extracted mechanically from the next-runtime baseline.\n// bindEvents is called by src/main.js at the original initialization point.\n\n";
  const functionSource = functions
    .sort((left, right) => left.start - right.start)
    .map((range) => source.slice(range.start, range.end))
    .join("\n\n");
  const bindingSource = source.slice(blockStart, blockEnd).trimEnd();
  writeFile(eventsPath, `${header}${functionSource}\n\nfunction bindEvents() {\n${bindingSource.split("\n").map((line) => `  ${line}`).join("\n")}\n}\n`);

  const rewritten = removeRanges(source, [...functions, { start: blockStart, end: blockEnd }]);
  const bindingCallAt = rewritten.indexOf(blockEndMarker);
  if (bindingCallAt === -1) fail("initialization anchor not found after extraction");
  writeFile(mainPath, `${rewritten.slice(0, bindingCallAt)}bindEvents();\n${rewritten.slice(bindingCallAt)}`);

  const game = fs.readFileSync(gamePath, "utf8");
  writeFile(gamePath, insertBeforeMain(game, '    "./src/main.js",\n', '    "./src/ui/events.js",\n'));
  const order = fs.readFileSync(orderPath, "utf8");
  writeFile(orderPath, insertBeforeMain(order, '  "src/main.js",\n', '  "src/ui/events.js",\n'));
  console.log("extracted UI event functions and bindings");
}

extract();
