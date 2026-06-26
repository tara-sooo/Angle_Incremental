const BALANCE_PROFILE = Object.freeze({
  generationRewardLogCoefficient: 0.37,
  initialUpgradeCostScaling: Object.freeze({
    speed: Object.freeze({ startsAfter: 20, logScale: 0.00035 }),
    vertex: Object.freeze({ startsAfter: 15, logScale: 0.00140 }),
    gain: Object.freeze({ startsAfter: 12, logScale: 0.00065 }),
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

function applyBalanceInfinityUpgradeDefinitions() {
  BALANCE_INFINITY_UPGRADES.forEach((definition) => {
    const existing = INFINITY_UPGRADES.find((upgrade) => upgrade.id === definition.id);
    if (existing) Object.assign(existing, definition);
    else INFINITY_UPGRADES.push(definition);
  });
}
