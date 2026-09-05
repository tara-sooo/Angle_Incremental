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
]);

export { TIMELINE_NODES };
