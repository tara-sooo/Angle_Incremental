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
      ja: "IC8をクリアした後、IP獲得量は毎秒×3ずつ増加する（×{softcap}でソフトキャップ）",
      en: "After clearing IC8, IP gain increases by ×3 each second (softcap at ×{softcap}).",
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
      ja: "IC6のInfinity数報酬倍率はEternity数に応じた2^Eになる（e10以降は強度2のlogソフトキャップ）",
      en: "The IC6 Infinity count reward uses 2^E by Eternity count (strength-2 log softcap from e10).",
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
      ja: "TowerのScore exponentのFloor係数を+0.05から+0.07に変更する",
      en: "Change the Tower Score exponent's Floor coefficient from +0.05 to +0.07.",
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
      ja: "現在のScoreのlog10(S)に応じてEternity獲得量を1 + 20^((S - 14000) / 5000)倍にする（ソフトキャップなし）",
      en: "Multiply Eternity gain by 1 + 20^((S - 14000) / 5000), where S is log10 of current Score (no softcap).",
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
      ja: "現在のInfinity数Iに応じてEternity獲得量を1 + I / 4倍にする（Iのlog10がe15を超えると強度2のlogソフトキャップ）",
      en: "Multiply Eternity gain by 1 + I / 4 from current Infinity count I (strength-2 log softcap after log10(I) exceeds e15).",
    }),
  }),
]);

export { TIMELINE_NODES };
