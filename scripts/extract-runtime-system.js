const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainPath = path.join(root, "src", "main.js");
const gamePath = path.join(root, "game.js");
const orderPath = path.join(root, "tests", "candidate-runtime-order.js");

const SYSTEMS = {
  angle: [
    "rawLapSpeedLog10", "rawLapSpeedMultiplier", "effectiveLapSpeedLog10", "lapSpeedMultiplier",
    "isLapSpeedSoftcapped", "lapSpeedSoftcapStart", "lapSpeedSoftcapPower", "lapDuration",
    "currentScoreLog10", "currentLog10ForValue", "currentTotalScoreLog10", "currentGenerationScoreLog10",
    "currentGainLog10", "setCurrentGainLog10", "addCurrentGain", "gainAfterIncreaseLog10",
    "currentPreviousGenerationScoreLog10", "currentInfinityPointsLog10", "currentInfiniteScoreLog10",
    "scoreDisplay", "applyInfinitySoftcap", "vertexGainIncrease", "finalScoreGainPower",
    "finalScoreGainDivisor", "finalScoreGain", "angleExpressionFromBaseLog10", "angleExpressionLog10",
    "preExpressionScoreGainLog10", "finalScoreGainFromBaseLog10", "finalScoreGainLog10",
    "coreVertexIndices", "isCoreVertex", "sumCoreHitGains", "earlyLayerCostScalingFactor",
    "preGenerationCostScalingLog10", "stagedUpgradeCostScalingLog10", "costLog10", "cost",
    "costLogs", "costs", "addScore", "passVertex", "processManyVertices",
    "normalizeVertexProgress", "spendLog", "spend", "upgradeCostLog", "canBuyNormalUpgrade",
    "spendNormalUpgrade", "resetVertexProgress", "buySpeed", "buyVertex", "buyGain", "buyAllUpgrades",
    "balancePreGenerationCostScalingLog10", "balanceCanBuyNormalUpgrade", "balanceCostLog10",
    "balanceRawLapSpeedLog10", "balanceVertexGainIncrease",
  ],
  generation: [
    "generationScorePower", "generationCostPower", "currentGenerationScoreMultiplierLog10",
    "generationScoreMultiplierBaseEffectLog10", "generationScoreMultiplierBaseEffect",
    "generationAchievementMultiplier", "applyGenerationAchievementRewardLog10",
    "applyGenerationAchievementReward", "generationScoreMultiplierEffectLog10",
    "generationScoreMultiplierEffect", "generationCostFactorEffect", "generationRewardForLog",
    "generationRewardFor", "generationRequirementLog10", "generationRequirement", "canRunGeneration",
    "nextGenerationValues", "runGeneration", "balanceGenerationRewardForLog",
    "balanceGenerationMinCostFactor", "balanceRestoreGenerationCostFactor",
    "balanceRestoreGenerationCostFactorFromLocalSave", "balanceGenerationScorePower",
    "balanceApplyResetStartScore", "balanceRunGeneration", "balanceNextGenerationValues",
  ],
  "core-boost": [
    "coreBoostRequirementLog10", "coreBoostRequirement", "canCoreBoost", "coreBoostBonusPower",
    "coreBoostGainIncreaseMultiplier", "coreBoostGainExponent", "nextCoreBoostValues",
    "shouldPreserveVerticesThroughEarlyReset", "resetBelowCoreBoost", "runCoreBoost",
    "balanceCoreBoostGainIncreaseMultiplier",
  ],
  infinity: [
    "infinityUpgradeById", "hasInfinityUpgrade", "infinityUpgradeName", "infinityUpgradeEffectText",
    "infinityUpgradeEffectPower", "applyInfinityUpgradePower", "infinityUpgradePrerequisitesMet",
    "canBuyInfinityUpgrade", "infinityChallengesUnlocked", "infinitySoftcapPower",
    "isChallengeCompleted", "completedChallengeCount", "nextChallengeIndex", "challengeStateText",
    "challengeName", "challengeRestriction", "challengeReward", "infiniteAngleEfficiency",
    "infiniteAngleBoost", "infiniteAngleConversionCostLog10", "canInfinity", "infinityPointGain",
    "infiniteScoreGainPerIp", "infiniteScoreGainPerIpLog10", "canSpendInfinityPoints",
    "addInfinityPoints", "spendInfinityPoints", "addInfiniteScoreLog", "canBreakInfiniteCap",
    "completeChallengeIfReady", "updateChallengeTimers", "resetBelowInfinity", "recordInfinityRun",
    "infinityCountGain", "runInfinity", "buyInfinityUpgrade", "convertIpToInfiniteScore",
    "toggleInfinityChallenge", "breakInfiniteCap", "balanceInfinityPointGain",
    "balanceInfinityUpgradeCostExponent",
  ],
};

function fail(message) {
  throw new Error(`runtime system extraction: ${message}`);
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
    if (character === "(") {
      parameterDepth += 1;
      continue;
    }
    if (character === ")") {
      parameterDepth -= 1;
      continue;
    }
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

function extract(target) {
  const names = SYSTEMS[target];
  if (!names) fail(`unknown target ${target}`);
  const targetRelativePath = `src/systems/${target}.js`;
  const targetPath = path.join(root, targetRelativePath);
  if (fs.existsSync(targetPath)) fail(`${targetRelativePath} already exists`);

  const source = fs.readFileSync(mainPath, "utf8");
  const ranges = names.map((name) => functionRange(source, name));
  const ordered = [...ranges].sort((left, right) => left.start - right.start);
  const header = "// Extracted mechanically from the next-runtime baseline.\n// Functions retain their original global runtime dependencies during the classic-script migration phase.\n\n";
  writeFile(targetPath, `${header}${ordered.map((range) => source.slice(range.start, range.end)).join("\n\n")}`);
  writeFile(mainPath, removeRanges(source, ranges));

  const mainOutput = fs.readFileSync(mainPath, "utf8");
  names.forEach((name) => {
    if (new RegExp(`^function\\s+${escapeRegExp(name)}\\s*\\(`, "m").test(mainOutput)) {
      fail(`function ${name} remains in src/main.js`);
    }
  });

  const game = fs.readFileSync(gamePath, "utf8");
  writeFile(gamePath, insertBeforeMain(game, '    "./src/main.js",\n', `    "./${targetRelativePath}",\n`));
  const order = fs.readFileSync(orderPath, "utf8");
  writeFile(orderPath, insertBeforeMain(order, '  "src/main.js",\n', `  "${targetRelativePath}",\n`));
  console.log(`extracted ${names.length} functions to ${targetRelativePath}`);
}

extract(process.argv[2]);
