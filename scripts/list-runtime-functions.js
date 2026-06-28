const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
const lines = source.split("\n");
const functions = [];

lines.forEach((line, index) => {
  const match = line.match(/^function\s+([A-Za-z_$][\w$]*)\s*\(/);
  if (match) functions.push({ line: index + 1, name: match[1] });
});

const output = `${functions.map(({ line, name }) => `${String(line).padStart(4, " ")} ${name}`).join("\n")}\nTOTAL ${functions.length}\n`;
const targetIndex = process.argv.indexOf("--write");
if (targetIndex >= 0) {
  const target = process.argv[targetIndex + 1];
  if (!target) throw new Error("--write requires an output path");
  const outputPath = path.resolve(root, target);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output);
} else {
  process.stdout.write(output);
}
