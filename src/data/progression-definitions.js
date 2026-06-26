// Progression data is kept separate from the runtime so new achievements and
// Infinity Challenges can be added without editing the simulation/UI layers.

const ACHIEVEMENT_DEFINITIONS = [
  {
    title: { ja: "頂点すなわち角度", en: "A Vertex Is an Angle" },
    condition: { ja: "角の数を増やす", en: "Increase the number of vertices." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.vertices > 3,
  },
  {
    title: { ja: "世代を超えて", en: "Beyond Generations" },
    condition: { ja: "Generationを実行する", en: "Run Generation." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.generationCount > 0,
  },
  {
    title: { ja: "e(この実績の番号)分のブースト", en: "An e3 Boost" },
    condition: { ja: "GR由来の単純なスコア獲得量の実効乗算値が1000を超える", en: "Make the effective GR score multiplier exceed 1000." },
    reward: { ja: "GRの単純なスコア獲得量の乗算の効果が2倍", en: "Doubles the effect of the GR score multiplier." },
    isUnlocked: () => generationAchievementMultiplier() > 1000,
  },
  {
    title: { ja: "角と核はダブルミーニングでもあり", en: "Angle and Core, Doubled" },
    condition: { ja: "Core Boost1に到達", en: "Reach Core Boost 1." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.coreBoostCount >= 1,
  },
  {
    title: { ja: "目視できない", en: "Too Fast to See" },
    condition: { ja: "ラップスピードが100を超える", en: "Raise lap speed above 100." },
    reward: { ja: "", en: "" },
    isUnlocked: () => lapSpeedMultiplier() > 100,
  },
  {
    title: { ja: "contagon", en: "contagon" },
    condition: { ja: "頂点の数が30を超える", en: "Raise vertices above 30." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.vertices > 30,
  },
  {
    title: { ja: "スケーリングは始まっている", en: "Scaling Has Begun" },
    condition: { ja: "所持スコアがe30を超える", en: "Hold more than 1e30 score." },
    reward: { ja: "", en: "" },
    isUnlocked: () => currentScoreLog10() > 30,
  },
  {
    title: { ja: "増幅、増幅、増幅", en: "Boost, Boost, Boost" },
    condition: { ja: "CB3に到達", en: "Reach Core Boost 3." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.coreBoostCount >= 3,
  },
  {
    title: { ja: "宇宙は収縮する", en: "The Universe Contracts" },
    condition: { ja: "Infinityに到達", en: "Reach Infinity." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.infinityCount > 0,
  },
  {
    title: { ja: "根元から", en: "From the Root" },
    condition: { ja: "Infinity Upgradesを購入", en: "Buy an Infinity Upgrade." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.infinityUpgradeMask !== 0,
  },
  {
    title: { ja: "Tips:目を休める時間です", en: "Tip: Time to Rest Your Eyes" },
    condition: { ja: "累計5時間プレイする", en: "Play for 5 total hours." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.totalPlayTime >= 5 * 60 * 60,
  },
  {
    title: { ja: "一代で成り上がれ", en: "Rise in One Lifetime" },
    condition: { ja: "GRなしでCB1に到達", en: "Reach Core Boost 1 without Generation." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.noGenerationCoreBoostReached,
  },
  {
    title: { ja: "かつての記憶", en: "Former Memory" },
    condition: { ja: "IU4-1を購入", en: "Buy IU 4-1." },
    reward: { ja: "", en: "" },
    isUnlocked: () => hasInfinityUpgrade("4-1"),
  },
  {
    title: { ja: "乗り越える時", en: "Time to Overcome" },
    condition: { ja: "Infinite Challengeを1つクリア", en: "Complete one Infinity Challenge." },
    reward: { ja: "", en: "" },
    isUnlocked: () => completedChallengeCount() > 0,
  },
];

const INFINITY_CHALLENGE_DEFINITIONS = [
  {
    name: { ja: "IC1 改悪された計算式", en: "IC1 Worsened Formula" },
    restriction: { ja: "基礎獲得式の(x/y)^zのyが10倍される", en: "The y in the base (x/y)^z formula is multiplied by 10." },
    reward: { ja: "yは撤廃される", en: "Removes y from the base formula." },
  },
  {
    name: { ja: "IC2 現実的に書ける範囲で", en: "IC2 Within Writable Bounds" },
    restriction: { ja: "角の数は200を超えない", en: "Vertices cannot exceed 200." },
    reward: { ja: "upgrade購入スコアが^0.95される", en: "Normal upgrade score costs are raised to ^0.95." },
  },
  {
    name: { ja: "IC3 ナメクジよりは早い", en: "IC3 Faster Than a Slug" },
    restriction: { ja: "ラップスピードが^0.8され、周回速度アップグレードのコスト増加が2倍になる", en: "Lap speed is raised to ^0.8 and speed upgrade cost growth is doubled." },
    reward: { ja: "ラップスピードx1.1", en: "Lap speed x1.1." },
  },
  {
    name: { ja: "IC4 うん、それ以上もそれ以下もないよ", en: "IC4 Nothing More, Nothing Less" },
    restriction: { ja: "頂点獲得量が^0.5される", en: "Gain per vertex is raised to ^0.5." },
    reward: { ja: "頂点獲得量が^1.1される", en: "Gain per vertex is raised to ^1.1." },
  },
  {
    name: { ja: "IC5 環境配慮", en: "IC5 Environmental Consideration" },
    restriction: { ja: "核増幅は使えない", en: "Core Boost cannot be used." },
    reward: { ja: "核増幅の獲得指数+0.01", en: "Core Boost gain exponent +0.01." },
  },
  {
    name: { ja: "IC6 最初だけ強い", en: "IC6 Strong Only at First" },
    restriction: { ja: "頂点通過ごとの増加は0.001で固定される", en: "Gain per vertex is fixed at 0.001." },
    reward: { ja: "Infinity獲得量を×2", en: "Infinity count gain x2." },
  },
  {
    name: { ja: "IC7 倹約家もどき", en: "IC7 Pretend Saver" },
    restriction: { ja: "スコアが1e30を超えると、アップグレードを購入できなくなる", en: "Normal upgrades cannot be bought above 1e30 score." },
    reward: { ja: "購入価格以上のスコアがあれば、通常アップグレード購入時にスコアを消費しない", en: "Normal upgrades no longer spend score, but still require enough score to afford them." },
  },
  {
    name: { ja: "IC8 反出生主義", en: "IC8 Anti-Natalism" },
    restriction: { ja: "角の数は3で始まり角増加アップグレードは購入できず、角はGRとCBでリセットされない", en: "Starts at 3 vertices, vertex upgrades cannot be bought, and vertices are not reset by Generation or Core Boost." },
    reward: { ja: "角の数はGRとCBでリセットされなくなる", en: "Vertices are no longer reset by Generation or Core Boost." },
  },
];

function applyProgressionDefinitions() {
  ACHIEVEMENTS.splice(0, ACHIEVEMENTS.length, ...ACHIEVEMENT_DEFINITIONS);
  INFINITY_CHALLENGES.splice(0, INFINITY_CHALLENGES.length, ...INFINITY_CHALLENGE_DEFINITIONS);
}
