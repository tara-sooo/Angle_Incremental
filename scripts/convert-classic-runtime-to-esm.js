/*
 * One-time AST converter for the mechanically split runtime.
 * Install acorn, eslint-scope, and magic-string before running this script.
 * The conversion workflow commits only after ESM parity validation succeeds.
 */
const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");
const eslintScope = require("eslint-scope");
const MagicString = require("magic-string");

const root = path.resolve(__dirname, "..");
const runtimeOrder = require(path.join(root, "tests", "candidate-runtime-order.js"));
const runtimeFiles = runtimeOrder.map((relativePath) => path.join(root, relativePath));
const mainPath = path.join(root, "src", "main.js");
const sharedPath = path.join(root, "src", "runtime", "shared.js");

function fail(message) {
  throw new Error(`ESM conversion: ${message}`);
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`);
}

function parse(source) {
  return acorn.parse(source, {
    ecmaVersion: 2024,
    sourceType: "script",
    ranges: true,
  });
}

function collectPatternNames(pattern, output) {
  if (!pattern) return;
  if (pattern.type === "Identifier") {
    output.push(pattern.name);
    return;
  }
  if (pattern.type === "RestElement") return collectPatternNames(pattern.argument, output);
  if (pattern.type === "AssignmentPattern") return collectPatternNames(pattern.left, output);
  if (pattern.type === "ArrayPattern") return pattern.elements.forEach((entry) => collectPatternNames(entry, output));
  if (pattern.type === "ObjectPattern") {
    return pattern.properties.forEach((entry) => collectPatternNames(entry.value || entry.argument, output));
  }
}

function topLevelBindings(ast) {
  const bindings = new Map();
  ast.body.forEach((node) => {
    if ((node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") && node.id) {
      bindings.set(node.id.name, { name: node.id.name, mutable: true });
      return;
    }
    if (node.type === "VariableDeclaration") {
      node.declarations.forEach((declaration) => {
        const names = [];
        collectPatternNames(declaration.id, names);
        names.forEach((name) => bindings.set(name, { name, mutable: node.kind !== "const" }));
      });
    }
  });
  return bindings;
}

function buildParentMap(node, parent = null, parents = new Map()) {
  if (!node || typeof node !== "object") return parents;
  parents.set(node, parent);
  Object.entries(node).forEach(([key, value]) => {
    if (["start", "end", "range", "loc"].includes(key)) return;
    if (Array.isArray(value)) {
      value.forEach((child) => {
        if (child && typeof child.type === "string") buildParentMap(child, node, parents);
      });
      return;
    }
    if (value && typeof value.type === "string") buildParentMap(value, node, parents);
  });
  return parents;
}

function isDeclaration(node) {
  return node.type === "FunctionDeclaration"
    || node.type === "ClassDeclaration"
    || node.type === "VariableDeclaration"
    || node.type === "EmptyStatement";
}

function relativeImport(fromFile, toFile) {
  let relative = path.relative(path.dirname(fromFile), toFile).replaceAll(path.sep, "/");
  if (!relative.startsWith(".")) relative = `./${relative}`;
  return relative;
}

function transformModule(filePath, globalBindings) {
  const source = fs.readFileSync(filePath, "utf8");
  if (/^import\s/m.test(source) || /^export\s/m.test(source)) {
    fail(`${path.relative(root, filePath)} is already an ES module`);
  }
  const ast = parse(source);
  const ownBindings = topLevelBindings(ast);
  const parents = buildParentMap(ast);
  const scopeManager = eslintScope.analyze(ast, {
    ecmaVersion: 2022,
    sourceType: "script",
    optimistic: true,
    ignoreEval: true,
    impliedStrict: false,
  });
  const output = new MagicString(source);
  const replaced = new Set();

  scopeManager.scopes.flatMap((scope) => scope.references || []).forEach((reference) => {
    const identifier = reference.identifier;
    if (!identifier || reference.resolved || !globalBindings.has(identifier.name)) return;
    const parent = parents.get(identifier);
    const identifierKey = `${identifier.start}:${identifier.end}`;
    if (replaced.has(identifierKey)) return;

    if (parent && parent.type === "Property" && parent.shorthand && parent.value === identifier) {
      const propertyKey = `${parent.start}:${parent.end}`;
      if (!replaced.has(propertyKey)) {
        output.overwrite(parent.start, parent.end, `${identifier.name}: runtime.${identifier.name}`);
        replaced.add(propertyKey);
      }
      replaced.add(identifierKey);
      return;
    }

    output.overwrite(identifier.start, identifier.end, `runtime.${identifier.name}`);
    replaced.add(identifierKey);
  });

  const exposeLines = [...ownBindings.values()].map(({ name, mutable }) => (
    mutable
      ? `expose(${JSON.stringify(name)}, () => ${name}, (value) => { ${name} = value; });`
      : `expose(${JSON.stringify(name)}, () => ${name});`
  ));
  const insertionNode = ast.body.find((node) => !isDeclaration(node));
  output.appendLeft(insertionNode ? insertionNode.start : source.length, `${exposeLines.join("\n")}\n\n`);

  const sharedImport = `import { runtime, expose } from ${JSON.stringify(relativeImport(filePath, sharedPath))};\n`;
  if (filePath === mainPath) {
    const sideEffectImports = runtimeFiles
      .filter((candidate) => candidate !== mainPath)
      .map((candidate) => `import ${JSON.stringify(relativeImport(mainPath, candidate))};`)
      .join("\n");
    output.prepend(`${sharedImport}${sideEffectImports}\n\n`);
  } else {
    output.prepend(`${sharedImport}\n`);
  }

  return output.toString();
}

function writeSharedRuntime() {
  writeFile(sharedPath, [
    "export const runtime = Object.create(null);",
    "",
    "export function expose(name, getter, setter) {",
    "  Object.defineProperty(runtime, name, {",
    "    configurable: true,",
    "    enumerable: true,",
    "    get: getter,",
    "    set: setter,",
    "  });",
    "}",
  ].join("\n"));
}

function updateEntrypoints() {
  const indexPath = path.join(root, "index.html");
  const index = fs.readFileSync(indexPath, "utf8");
  const updated = index.replace(
    /<script src="game\.js([^\"]*)"><\/script>/,
    '<script type="module" src="src/main.js$1"></script>',
  );
  if (updated === index) fail("index.html does not reference game.js");
  writeFile(indexPath, updated);
  writeFile(
    path.join(root, "game.js"),
    'import("./src/main.js").catch((error) => console.error("Angle Incremental failed to start", error));',
  );
  writeFile(path.join(root, "src", "package.json"), '{\n  "type": "module"\n}');
}

function convert() {
  if (!fs.existsSync(path.join(root, "src", "ui", "events.js"))) {
    fail("physical module split is incomplete");
  }

  const parsedModules = runtimeFiles.map((filePath) => ({
    filePath,
    ast: parse(fs.readFileSync(filePath, "utf8")),
  }));
  const globalBindings = new Map();
  parsedModules.forEach(({ filePath, ast }) => {
    topLevelBindings(ast).forEach((binding, name) => {
      if (globalBindings.has(name)) {
        fail(`duplicate top-level runtime binding ${name} in ${path.relative(root, filePath)}`);
      }
      globalBindings.set(name, binding);
    });
  });

  writeSharedRuntime();
  parsedModules.forEach(({ filePath }) => writeFile(filePath, transformModule(filePath, globalBindings)));
  updateEntrypoints();
  console.log(`converted ${runtimeFiles.length} split runtime files to ES modules`);
}

convert();
