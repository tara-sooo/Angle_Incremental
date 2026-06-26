const { execFileSync } = require("node:child_process");

const expectedBlob = "8e04b5a4115455903bbde7419a1f770d525a5563";
const fixturePath = "tests/fixtures/next-runtime.js";
const actualBlob = execFileSync("git", ["hash-object", fixturePath], { encoding: "utf8" }).trim();

if (actualBlob !== expectedBlob) {
  throw new Error(`${fixturePath} must remain the exact next/game.js baseline. Expected ${expectedBlob}, got ${actualBlob}.`);
}

console.log("Runtime fixture matches next/game.js");
