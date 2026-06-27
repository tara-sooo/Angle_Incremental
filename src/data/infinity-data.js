import { runtime, expose } from "../runtime/shared.js";

// Extracted mechanically from the next-runtime baseline. Keep declaration order stable during migration.

const INFINITY_CHALLENGES = [
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
    name: { ja: "IC6 下剋上された", en: "IC6 Overthrown from Below" },
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

const INFINITY_UPGRADES = [
  {
    id: "1-1",
    bit: 0,
    cost: 1,
    requires: [],
    name: { ja: "1-1 リセットは負ではない", en: "1-1 Resets Are Not Negative" },
    effect: {
      ja: "頂点通過ごとの増加がInfinity回数に応じて強化される",
      en: "Gain per vertex scales with Infinity count.",
    },
  },
  {
    id: "1-2",
    bit: 1,
    cost: 1,
    requires: [],
    name: { ja: "1-2 はじめてのQoL", en: "1-2 First QoL" },
    effect: { ja: "通常強化の自動購入を解放", en: "Unlocks normal-upgrade autobuy." },
  },
  {
    id: "2-1",
    bit: 2,
    cost: 1,
    requires: ["1-1", "1-2"],
    name: { ja: "2-1 最速タイム", en: "2-1 Fastest Time" },
    effect: { ja: "ラップスピードが×1.5される", en: "Multiplies lap speed by 1.5." },
  },
  {
    id: "3-1",
    bit: 3,
    cost: 3,
    requires: ["2-1"],
    name: { ja: "3-1 実績3を獲得するにはこれがほぼ必須です", en: "3-1 Almost Required For Achievement 3" },
    effect: { ja: "GRスコア倍率が^1.5される", en: "Raises GR score multiplier to ^1.5." },
  },
  {
    id: "3-2",
    bit: 4,
    cost: 3,
    requires: ["2-1"],
    name: { ja: "3-2 (必須じゃない方だけど強い)", en: "3-2 Optional, But Strong" },
    effect: { ja: "GRコスト倍率が×0.95される", en: "Multiplies GR cost factor by 0.95." },
  },
  {
    id: "4-1",
    bit: 5,
    cost: 5,
    requires: ["3-1", "3-2"],
    name: { ja: "4-1 縛り縛られ", en: "4-1 Bound By Restrictions" },
    effect: { ja: "Infinity Challengeを解放", en: "Unlocks Infinity Challenges." },
  },
];

const BALANCE_PROFILE = Object.freeze({
  generationRewardLogCoefficient: 0.20,
  initialUpgradeCostScaling: Object.freeze({
    speed: Object.freeze({ startsAfter: 10, logScale: 0.00140 }),
    vertex: Object.freeze({ startsAfter: 8, logScale: 0.00560 }),
    gain: Object.freeze({ startsAfter: 6, logScale: 0.00260 }),
  }),
  infinityUpgradeCostReduction: Object.freeze({
    perInfinity: 0.002,
    softcapStartExponent: 0.9,
    softcapAsymptoteExponent: 0.8,
    postSoftcapDecay: 0.005,
  }),
});

const BALANCE_INFINITY_UPGRADES = [
  {
    id: "1-1",
    bit: 0,
    cost: 1,
    requires: [],
    name: { ja: "1-1 リセットは負ではない", en: "1-1 Resets Are Not Negative" },
    effect: {
      ja: "頂点通過ごとの増加が×(Infinity回数+1)される",
      en: "Multiplies gain per vertex by Infinity count + 1.",
    },
  },
  {
    id: "1-2",
    bit: 1,
    cost: 1,
    requires: [],
    name: { ja: "1-2 はじめてのQoL", en: "1-2 First QoL" },
    effect: { ja: "通常強化の自動購入を解放", en: "Unlocks normal-upgrade autobuy." },
  },
  {
    id: "2-1",
    bit: 2,
    cost: 1,
    requires: ["1-1", "1-2"],
    name: { ja: "2-1 最速タイム", en: "2-1 Fastest Time" },
    effect: { ja: "ラップスピードが×1.5される", en: "Multiplies lap speed by 1.5." },
  },
  {
    id: "3-1",
    bit: 3,
    cost: 3,
    requires: ["2-1"],
    name: { ja: "3-1 スコア革命", en: "3-1 Score Revolution" },
    effect: { ja: "GRスコア倍率が^1.5される", en: "Raises the GR score multiplier to ^1.5." },
  },
  {
    id: "3-2",
    bit: 4,
    cost: 3,
    requires: ["2-1"],
    name: { ja: "3-2 コスト革命", en: "3-2 Cost Revolution" },
    effect: { ja: "GRコスト倍率が×0.95される", en: "Multiplies the GR cost factor by 0.95." },
  },
  {
    id: "4-1",
    bit: 5,
    cost: 5,
    requires: ["3-1", "3-2"],
    name: { ja: "4-1 縛り縛られ", en: "4-1 Bound By Restrictions" },
    effect: { ja: "Infinity Challengeを解放", en: "Unlocks Infinity Challenges." },
  },
  {
    id: "5-1",
    bit: 6,
    cost: 10,
    requires: ["4-1"],
    name: { ja: "5-1 スタートダッシュ", en: "5-1 Starting Dash" },
    effect: { ja: "ラップスピードが×3される", en: "Multiplies lap speed by 3." },
  },
  {
    id: "5-2",
    bit: 7,
    cost: 10,
    requires: ["4-1"],
    name: { ja: "5-2 親が地主", en: "5-2 Landlord Parents" },
    effect: { ja: "リセット後、スコア100で開始する", en: "Start every reset with 100 score." },
  },
  {
    id: "6-1",
    bit: 8,
    cost: 50,
    requires: ["5-1", "5-2"],
    name: { ja: "6-1 ほんのりした甘味", en: "6-1 A Hint of Sweetness" },
    effect: { ja: "GRスコア倍率がさらに^1.2される", en: "Further raises the GR score multiplier to ^1.2." },
  },
  {
    id: "6-2",
    bit: 9,
    cost: 50,
    requires: ["5-1", "5-2"],
    name: { ja: "6-2 澄んだ視界", en: "6-2 Clear View" },
    effect: { ja: "GRコスト倍率の下限が×0.70になる", en: "Lowers the GR cost-factor floor to x0.70." },
  },
  {
    id: "7-1",
    bit: 10,
    cost: 150,
    requires: ["6-1", "6-2"],
    name: { ja: "7-1 権力の集中", en: "7-1 Concentration of Power" },
    effect: { ja: "CBごとの増加倍率が+1.0になる", en: "Raises the per-CB gain multiplier increase to +1.0." },
  },
  {
    id: "7-2",
    bit: 11,
    cost: 150,
    requires: ["6-1", "6-2"],
    name: { ja: "7-2 庶民の幸せ", en: "7-2 Commoners' Happiness" },
    effect: { ja: "Infinity回数に応じて通常強化コストを下げる", en: "Lowers normal-upgrade costs based on Infinity count." },
  },
];

expose("INFINITY_CHALLENGES", () => INFINITY_CHALLENGES);
expose("INFINITY_UPGRADES", () => INFINITY_UPGRADES);
expose("BALANCE_PROFILE", () => BALANCE_PROFILE);
expose("BALANCE_INFINITY_UPGRADES", () => BALANCE_INFINITY_UPGRADES);

BALANCE_INFINITY_UPGRADES.forEach((definition) => {
  const existing = INFINITY_UPGRADES.find((upgrade) => upgrade.id === definition.id);
  if (existing) Object.assign(existing, definition);
  else INFINITY_UPGRADES.push(definition);
});
