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
      ja: "Realルート。IP獲得量を「1 + log10(現在IP)」倍します。現在IPが0のときの倍率は1です。",
      en: "Real route. Multiplies Infinity Point gain by 1 + log10(current IP); at 0 IP the multiplier is 1.",
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
      ja: "Parallelルート。IC8クリア後は毎秒×3。raw×1e10まではそのまま、以降は対数ソフトキャップで伸びます。オフライン時間も加算されます。",
      en: "Parallel route. After IC8, it grows by ×3 per second; raw ×1e10 is the softcap boundary, then growth is logarithmically reduced. Offline time counts.",
    }),
  }),
]);

export { TIMELINE_NODES };
