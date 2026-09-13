const TIMELINE_NODES = Object.freeze([
  Object.freeze({
    id: "Real-BC16500",
    era: "BC16500",
    route: "Real",
    costTF: 1,
    prerequisites: Object.freeze([]),
    name: Object.freeze({
      ja: "惰性の打製石器",
      en: "Inert Stone Tools",
    }),
    description: Object.freeze({
      ja: "Infinity獲得量は現在所持しているIPの数に応じて強化される（元の獲得量 × (1 + log10(IP))）",
      en: "Infinity count gain is strengthened based on current IP (original gain × (1 + log10(IP))).",
    }),
  }),
  Object.freeze({
    id: "Parallel-BC16500",
    era: "BC16500",
    route: "Parallel",
    costTF: 1,
    prerequisites: Object.freeze([]),
    name: Object.freeze({
      ja: "終わらない氷河期",
      en: "Endless Ice Age",
    }),
    description: Object.freeze({
      ja: "IC8をクリアした後、IP獲得量は毎秒×3ずつ増加する（×{softcap} SC）",
      en: "After clearing IC8, IP gain increases by ×3 each second (SC at ×{softcap}).",
    }),
  }),
  Object.freeze({
    id: "Real-BC6000",
    era: "BC6000",
    route: "Real",
    costTF: 1,
    prerequisites: Object.freeze(["Real-BC16500", "Parallel-BC16500"]),
    prerequisiteMode: "any",
    name: Object.freeze({
      ja: "チグリスとユーフラテスの狭間に",
      en: "Between the Tigris and Euphrates",
    }),
    description: Object.freeze({
      ja: "IC6のInfinity数報酬倍率はEternity数に応じて強化される（1 Eternityごとに×2、×1e10以降 SC）",
      en: "IC6 Infinity count reward multiplier increases by ×2 per Eternity (SC after ×1e10).",
    }),
  }),
  Object.freeze({
    id: "Parallel-BC6000",
    era: "BC6000",
    route: "Parallel",
    costTF: 1,
    prerequisites: Object.freeze(["Real-BC16500", "Parallel-BC16500"]),
    prerequisiteMode: "any",
    name: Object.freeze({
      ja: "三角州の中の暮らし",
      en: "Life in the Delta",
    }),
    description: Object.freeze({
      ja: "Towerのスコア累乗の増加量を+^0.05/Floorから+^0.07/Floorに変更する",
      en: "Change the Tower score exponent increase from +^0.05/Floor to +^0.07/Floor.",
    }),
  }),
  Object.freeze({
    id: "Real-AD30",
    era: "AD30",
    route: "Real",
    costTF: 5,
    prerequisites: Object.freeze(["Real-BC6000", "Parallel-BC6000"]),
    prerequisiteMode: "any",
    name: Object.freeze({
      ja: "復活する神の子",
      en: "The God-Child Reborn",
    }),
    description: Object.freeze({
      ja: "現在のスコアに応じてEternity獲得量を×(1 + 20^((log10(スコア)-14000)/5000))する",
      en: "Multiply Eternity gain by ×(1 + 20^((log10(Score)-14000)/5000)) based on current Score.",
    }),
  }),
  Object.freeze({
    id: "Parallel-AD30",
    era: "AD30",
    route: "Parallel",
    costTF: 5,
    prerequisites: Object.freeze(["Real-BC6000", "Parallel-BC6000"]),
    prerequisiteMode: "any",
    name: Object.freeze({
      ja: "死後にはできない人間宣言",
      en: "A Human Declaration Impossible After Death",
    }),
    description: Object.freeze({
      ja: "現在のInfinity数に応じてEternity獲得量を×(1 + 10^(log10(Infinity数)) / 4)する（Infinity数e15以降 SC）",
      en: "Multiply Eternity gain by ×(1 + 10^(log10(Infinity count)) / 4) based on current Infinity count (SC after e15 Infinity count).",
    }),
  }),
]);

export { TIMELINE_NODES };
