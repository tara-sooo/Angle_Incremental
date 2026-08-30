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
      ja: "Realルート。ゲーム効果は後続の効果リーフで実装されるため、現在は選択のみです。",
      en: "Real route. Its gameplay effect is reserved for a later effect leaf; this node is currently selection-only.",
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
      ja: "Parallelルート。ゲーム効果は後続の効果リーフで実装されるため、現在は選択のみです。",
      en: "Parallel route. Its gameplay effect is reserved for a later effect leaf; this node is currently selection-only.",
    }),
  }),
]);

export { TIMELINE_NODES };
