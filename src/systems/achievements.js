import { runtime, expose } from "../runtime/shared.js";

// Extracted mechanically from the next-runtime baseline.
// Unlock checks retain their original runtime dependencies during migration.

const ACHIEVEMENTS = [
  {
    title: { ja: "頂点すなわち角度", en: "A Vertex Is an Angle" },
    condition: { ja: "角の数を増やす", en: "Increase the number of vertices." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.vertices > 3,
  },
  {
    title: { ja: "世代を超えて", en: "Beyond Generations" },
    condition: { ja: "Generationを実行する", en: "Run Generation." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.generationCount > 0,
  },
  {
    title: { ja: "e(この実績の番号)分のブースト", en: "An e3 Boost" },
    condition: { ja: "GR由来の単純なスコア獲得量の実効乗算値が1000を超える", en: "Make the effective GR score multiplier exceed 1000." },
    reward: { ja: "GRの単純なスコア獲得量の乗算の効果が2倍", en: "Doubles the effect of the GR score multiplier." },
    isUnlocked: () => runtime.generationAchievementMultiplier() > 1000,
  },
  {
    title: { ja: "角と核はダブルミーニングでもあり", en: "Angle and Core, Doubled" },
    condition: { ja: "Core Boost1に到達", en: "Reach Core Boost 1." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.coreBoostCount >= 1,
  },
  {
    title: { ja: "目視できない", en: "Too Fast to See" },
    condition: { ja: "ラップスピードが100を超える", en: "Raise lap speed above 100." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.lapSpeedMultiplier() > 100,
  },
  {
    title: { ja: "contagon", en: "contagon" },
    condition: { ja: "頂点の数が30を超える", en: "Raise vertices above 30." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.vertices > 30,
  },
  {
    title: { ja: "スケーリングは始まっている", en: "Scaling Has Begun" },
    condition: { ja: "所持スコアがe30を超える", en: "Hold more than 1e30 score." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.currentScoreLog10() > 30,
  },
  {
    title: { ja: "増幅、増幅、増幅", en: "Boost, Boost, Boost" },
    condition: { ja: "CB3に到達", en: "Reach Core Boost 3." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.coreBoostCount >= 3,
  },
  {
    title: { ja: "宇宙は収縮する", en: "The Universe Contracts" },
    condition: { ja: "Infinityに到達", en: "Reach Infinity." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.infinityCount > 0,
  },
  {
    title: { ja: "根元から", en: "From the Root" },
    condition: { ja: "Infinity Upgradesを購入", en: "Buy an Infinity Upgrade." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.infinityUpgradeMask !== 0,
  },
  {
    title: { ja: "Tips:目を休める時間です", en: "Tip: Time to Rest Your Eyes" },
    condition: { ja: "累計5時間プレイする", en: "Play for 5 total hours." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.totalPlayTime >= 5 * 60 * 60,
  },
  {
    title: { ja: "一代で成り上がれ", en: "Rise in One Lifetime" },
    condition: { ja: "GRなしでCB1に到達", en: "Reach Core Boost 1 without Generation." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.noGenerationCoreBoostReached,
  },
  {
    title: { ja: "かつての記憶", en: "Former Memory" },
    condition: { ja: "IU4-1を購入", en: "Buy IU 4-1." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.hasInfinityUpgrade("4-1"),
  },
  {
    title: { ja: "乗り越える時", en: "Time to Overcome" },
    condition: { ja: "Infinite Challengeを1つクリア", en: "Complete one Infinity Challenge." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.completedChallengeCount() > 0,
  },
  {
    title: { ja: "流石に最初よりは早い", en: "Faster Than the Beginning" },
    condition: { ja: "Infinityに10回到達", en: "Reach Infinity 10 times." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.infinityCount >= 10,
  },
  {
    title: { ja: "実は3より弱い", en: "Actually Weaker Than 3" },
    condition: { ja: "IC4をクリア", en: "Complete IC4." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.isChallengeCompleted(4),
  },
  {
    title: { ja: "おとなしく寝た方がいい", en: "You Should Just Sleep" },
    condition: { ja: "IC3をクリア", en: "Complete IC3." },
    reward: { ja: "IP獲得量が×2", en: "Infinity Point gain x2." },
    isUnlocked: () => runtime.isChallengeCompleted(3),
  },
  {
    title: { ja: "大雑把", en: "Roughly" },
    condition: { ja: "e314スコアに到達", en: "Reach 1e314 score." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.currentScoreLog10() >= 314,
  },
  {
    title: { ja: "固めのカップ麺", en: "Firm Cup Noodles" },
    condition: { ja: "最速Infinity時間が2分を切る", en: "Get a fastest Infinity time below 2 minutes." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.fastestInfinityTime > 0 && runtime.state.fastestInfinityTime < 120,
  },
  {
    title: { ja: "小学生だったら数えきれないね", en: "Too Many for an Elementary Schooler" },
    condition: { ja: "所持IPが100に到達", en: "Hold 100 IP." },
    reward: { ja: "GRのコスト倍率はさらに×0.98される", en: "The GR cost factor is additionally multiplied by 0.98." },
    isUnlocked: () => runtime.currentInfinityPointsLog10() >= 2,
  },
  {
    title: { ja: "昔はこれが最難関でした", en: "This Used to Be the Hardest" },
    condition: { ja: "IC5をクリア", en: "Complete IC5." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.isChallengeCompleted(5),
  },
  {
    title: { ja: "伝説の一代目", en: "Legendary First Generation" },
    condition: { ja: "GR、CBなしでInfinityに到達", en: "Reach Infinity without Generation or Core Boost." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.lastInfinityRuns.some((record) => Boolean(record.noGenerationCoreBoost)),
  },
  {
    title: { ja: "寄り添う心", en: "A Heart That Stays Close" },
    condition: { ja: "IU7-1、7-2を購入", en: "Buy IU 7-1 and 7-2." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.hasInfinityUpgrade("7-1") && runtime.hasInfinityUpgrade("7-2"),
  },
  {
    title: { ja: "SDGsよりは簡単な課題", en: "An Easier Goal Than the SDGs" },
    condition: { ja: "ICを8つクリア", en: "Complete all 8 ICs." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.completedChallengeCount() >= 8,
  },
  {
    title: { ja: "大きな壁でも問題なし", en: "No Problem, Even With a Big Wall" },
    condition: { ja: "Break Infinite Capを実行する", en: "Break the Infinite Cap." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.infiniteCapBroken,
  },
];

Object.defineProperty(runtime, "ACHIEVEMENT_COUNT", {
  configurable: true,
  enumerable: true,
  get: () => ACHIEVEMENTS.length,
});

function isAchievementUnlocked(id) {
  return (runtime.state.achievementMask & (1 << (id - 1))) !== 0;
}

function achievementCount() {
  let count = 0;
  for (let id = 1; id <= runtime.ACHIEVEMENT_COUNT; id += 1) {
    if (isAchievementUnlocked(id)) count += 1;
  }
  return count;
}

function achievementGainMultiplier() {
  return Math.pow(1.01, achievementCount());
}

function showAchievementNotification(id) {
  if (!runtime.elements.achievementToasts) return;
  const language = runtime.TEXT[runtime.state.language] ? runtime.state.language : "ja";
  const achievement = ACHIEVEMENTS[id - 1];
  const toast = document.createElement("div");
  toast.className = "achievement-toast";
  toast.innerHTML = `<span>${runtime.t("achievementNotice")}</span><strong>${achievement.title[language]}</strong>`;
  runtime.elements.achievementToasts.append(toast);
  window.setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 4200);
}

function checkAchievements(notify = false) {
  const unlockedIds = [];
  ACHIEVEMENTS.forEach((achievement, index) => {
    const id = index + 1;
    if (!isAchievementUnlocked(id) && achievement.isUnlocked()) {
      runtime.state.achievementMask |= 1 << index;
      unlockedIds.push(id);
      if (notify) showAchievementNotification(id);
    }
  });
  return unlockedIds;
}

expose("ACHIEVEMENTS", () => ACHIEVEMENTS);
expose("isAchievementUnlocked", () => isAchievementUnlocked, (value) => { isAchievementUnlocked = value; });
expose("achievementCount", () => achievementCount, (value) => { achievementCount = value; });
expose("achievementGainMultiplier", () => achievementGainMultiplier, (value) => { achievementGainMultiplier = value; });
expose("showAchievementNotification", () => showAchievementNotification, (value) => { showAchievementNotification = value; });
expose("checkAchievements", () => checkAchievements, (value) => { checkAchievements = value; });
