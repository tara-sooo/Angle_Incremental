const fs = require("fs");
const path = require("path");
const runtimeOrder = require("./tests/candidate-runtime-order.js");

const originalReadFileSync = fs.readFileSync.bind(fs);
const legacyGamePath = path.join(__dirname, "game.js");
const candidateRuntimePaths = runtimeOrder.map((relativePath) => path.join(__dirname, relativePath));

function candidateRuntimeSource() {
  return candidateRuntimePaths
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => originalReadFileSync(filePath, "utf8"))
    .join("\n\n");
}

fs.readFileSync = (file, ...args) => {
  if (path.resolve(String(file)) === legacyGamePath) return candidateRuntimeSource();
  return originalReadFileSync(file, ...args);
};

async function main() {
  require("./regression-tests-core.js");
  await require("./tests/differential-runtime.js").runDifferentialTests();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
