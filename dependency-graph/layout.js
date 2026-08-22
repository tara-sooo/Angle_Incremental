export function layoutGraph(nodes, edges) {
  const numbers = new Set(nodes.map(node => node.number));
  const outgoing = new Map([...numbers].map(number => [number, []]));
  const indegree = new Map([...numbers].map(number => [number, 0]));
  for (const edge of edges.filter(edge => edge.type === 'hard')) {
    if (!numbers.has(edge.from) || !numbers.has(edge.to)) continue;
    outgoing.get(edge.from).push(edge.to);
    indegree.set(edge.to, indegree.get(edge.to) + 1);
  }

  const queue = [...numbers].filter(n => indegree.get(n) === 0).sort((a, b) => a - b);
  const rank = new Map([...numbers].map(n => [n, 0]));
  const visited = new Set();
  while (queue.length) {
    const n = queue.shift();
    visited.add(n);
    for (const next of outgoing.get(n)) {
      rank.set(next, Math.max(rank.get(next), rank.get(n) + 1));
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) {
        queue.push(next);
        queue.sort((a, b) => a - b);
      }
    }
  }
  for (const n of numbers) if (!visited.has(n)) rank.set(n, 0);

  const layers = new Map();
  for (const node of nodes) {
    const r = rank.get(node.number) || 0;
    if (!layers.has(r)) layers.set(r, []);
    layers.get(r).push(node);
  }
  const nodeW = 270, nodeH = 86, gapX = 54, gapY = 96;
  let maxWidth = 0;
  for (const layer of layers.values()) {
    maxWidth = Math.max(maxWidth, layer.length * nodeW + Math.max(0, layer.length - 1) * gapX);
  }
  const positioned = new Map();
  for (const r of [...layers.keys()].sort((a, b) => a - b)) {
    const layer = layers.get(r).sort((a, b) => a.number - b.number);
    const width = layer.length * nodeW + Math.max(0, layer.length - 1) * gapX;
    const startX = (maxWidth - width) / 2;
    layer.forEach((node, i) => positioned.set(node.number, {
      ...node, x: startX + i * (nodeW + gapX), y: r * (nodeH + gapY), w: nodeW, h: nodeH,
    }));
  }
  return positioned;
}

export function edgePath(a, b) {
  const x1 = a.x + a.w / 2, y1 = a.y + a.h;
  const x2 = b.x + b.w / 2, y2 = b.y;
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}
