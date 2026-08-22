import { ISSUE_BASE, buildGraph, fetchAllIssues } from './data.js';
import { edgePath, layoutGraph } from './layout.js';

const $ = selector => document.querySelector(selector);
const svg = $('#graph'), viewport = $('#viewport'), edgesLayer = $('#edges'), nodesLayer = $('#nodes');
const statusEl = $('#status'), details = $('#details'), detailsBody = $('#detailsBody'), emptyState = $('#emptyState');
const controls = { showOpen: $('#showOpen'), showClosed: $('#showClosed'), showHard: $('#showHard'), showSoft: $('#showSoft'), minIssue: $('#minIssue'), search: $('#search') };
let issues = [], graph = { nodes: [], edges: [] }, transform = { x: 40, y: 40, scale: 1 }, drag = null, pinch = null;
const pointers = new Map();

function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function trunc(text, n = 35) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
function applyTransform() { viewport.setAttribute('transform', `translate(${transform.x} ${transform.y}) scale(${transform.scale})`); }
function zoomAt(x, y, factor) {
  const old = transform.scale, next = Math.min(3, Math.max(.1, old * factor));
  const wx = (x - transform.x) / old, wy = (y - transform.y) / old;
  transform = { scale: next, x: x - wx * next, y: y - wy * next };
  applyTransform();
}
function fitGraph() {
  const box = viewport.getBBox();
  if (!box.width || !box.height) return;
  const rect = svg.getBoundingClientRect(), pad = Math.min(60, Math.max(20, rect.width * .04));
  const scale = Math.min((rect.width - 2 * pad) / box.width, (rect.height - 2 * pad) / box.height, 1.25);
  transform.scale = Math.max(.1, scale);
  transform.x = (rect.width - box.width * transform.scale) / 2 - box.x * transform.scale;
  transform.y = Math.max(pad, (rect.height - box.height * transform.scale) / 2) - box.y * transform.scale;
  applyTransform();
}

function render() {
  graph = buildGraph(issues, Number(controls.minIssue.value) || 1);
  const query = controls.search.value.trim().toLowerCase();
  const nodes = graph.nodes.filter(issue => !(issue.state === 'open' && !controls.showOpen.checked) && !(issue.state === 'closed' && !controls.showClosed.checked));
  const set = new Set(nodes.map(n => n.number));
  const edges = graph.edges.filter(e => set.has(e.from) && set.has(e.to));
  const pos = layoutGraph(nodes, edges);

  edgesLayer.innerHTML = '';
  for (const edge of edges) {
    if ((edge.type === 'hard' && !controls.showHard.checked) || (edge.type === 'soft' && !controls.showSoft.checked)) continue;
    const a = pos.get(edge.from), b = pos.get(edge.to);
    if (!a || !b) continue;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', edgePath(a, b));
    path.setAttribute('class', edge.type === 'hard' ? 'edge-hard' : 'edge-soft');
    edgesLayer.appendChild(path);
  }

  nodesLayer.innerHTML = '';
  for (const node of nodes) {
    const p = pos.get(node.number);
    if (!p) continue;
    const match = query && `#${node.number} ${node.number} ${node.title}`.toLowerCase().includes(query);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `node ${node.state}${match ? ' match' : ''}`);
    g.setAttribute('transform', `translate(${p.x},${p.y})`);
    g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', `Issue ${node.number}: ${node.title}`);
    g.innerHTML = `<rect width="${p.w}" height="${p.h}"></rect><text x="16" y="27" class="title">#${node.number} ${esc(trunc(node.title, 31))}</text><text x="16" y="52" class="meta ${node.state === 'open' ? 'state-open' : 'state-closed'}">${node.state === 'open' ? 'OPEN' : 'COMPLETED'}</text><text x="16" y="71" class="meta">updated ${esc(new Date(node.updated_at).toLocaleDateString('ja-JP'))}</text>`;
    const open = event => { event.stopPropagation(); showDetails(node); };
    g.addEventListener('click', open);
    g.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') open(event); });
    nodesLayer.appendChild(g);
  }
  const shown = edges.filter(e => (e.type === 'hard' ? controls.showHard.checked : controls.showSoft.checked));
  statusEl.textContent = `${nodes.length} issues / ${shown.filter(e => e.type === 'hard').length} hard / ${shown.filter(e => e.type === 'soft').length} references`;
  emptyState.hidden = nodes.length !== 0;
  applyTransform();
}

function relationItem(edge, incoming) {
  const n = incoming ? edge.from : edge.to, target = graph.nodes.find(node => node.number === n);
  return `<li><a href="${ISSUE_BASE}${n}" target="_blank" rel="noopener">#${n} ${esc(trunc(target?.title || 'Issue', 48))}</a> — ${esc(edge.type)} · ${esc(edge.reason)}</li>`;
}
function showDetails(issue) {
  const related = graph.edges.filter(e => e.from === issue.number || e.to === issue.number);
  const incoming = related.filter(e => e.to === issue.number), outgoing = related.filter(e => e.from === issue.number);
  detailsBody.innerHTML = `<h2>#${issue.number} ${esc(issue.title)}</h2><p><strong>${issue.state === 'open' ? 'Open' : 'Completed'}</strong> · updated ${esc(new Date(issue.updated_at).toLocaleString('ja-JP'))}</p><p><strong>Upstream</strong></p><ul class="relation-list">${incoming.length ? incoming.map(e => relationItem(e, true)).join('') : '<li>none</li>'}</ul><p><strong>Downstream</strong></p><ul class="relation-list">${outgoing.length ? outgoing.map(e => relationItem(e, false)).join('') : '<li>none</li>'}</ul><p><a href="${esc(issue.html_url)}" target="_blank" rel="noopener">GitHub Issue を開く ↗</a></p>`;
  details.hidden = false;
}

async function load() {
  try {
    statusEl.textContent = 'GitHub Issues を読み込み中…';
    const result = await fetchAllIssues(text => { statusEl.textContent = text; });
    issues = result.issues; render();
    if (result.remaining !== null) statusEl.textContent += ` · API remaining ${result.remaining}`;
    requestAnimationFrame(fitGraph);
  } catch (error) {
    console.error(error); issues = []; edgesLayer.innerHTML = ''; nodesLayer.innerHTML = ''; emptyState.hidden = true;
    statusEl.innerHTML = `<span class="error">読み込み失敗: ${esc(error.message)}</span>`;
  }
}

for (const control of Object.values(controls)) control.addEventListener(control === controls.search ? 'input' : 'change', () => { render(); if (control !== controls.search) requestAnimationFrame(fitGraph); });
$('#refresh').addEventListener('click', load); $('#fit').addEventListener('click', fitGraph);
$('#zoomIn').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.25); });
$('#zoomOut').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, .8); });
$('#closeDetails').addEventListener('click', () => { details.hidden = true; });

svg.addEventListener('pointerdown', event => {
  if (event.target.closest?.('.node')) return;
  svg.setPointerCapture(event.pointerId); pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 1) { drag = { x: event.clientX, y: event.clientY, tx: transform.x, ty: transform.y }; pinch = null; }
  else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale: transform.scale, midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, tx: transform.x, ty: transform.y }; drag = null;
  }
});
svg.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 1 && drag) { transform.x = drag.tx + event.clientX - drag.x; transform.y = drag.ty + event.clientY - drag.y; applyTransform(); return; }
  if (pointers.size === 2 && pinch) {
    const rect = svg.getBoundingClientRect(), [a, b] = [...pointers.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y), midpoint = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
    const start = { x: pinch.midpoint.x - rect.left, y: pinch.midpoint.y - rect.top }, next = Math.min(3, Math.max(.1, pinch.scale * distance / pinch.distance));
    const wx = (start.x - pinch.tx) / pinch.scale, wy = (start.y - pinch.ty) / pinch.scale;
    transform = { scale: next, x: midpoint.x - wx * next, y: midpoint.y - wy * next }; applyTransform();
  }
});
function release(event) {
  pointers.delete(event.pointerId);
  if (pointers.size === 1) { const [p] = pointers.values(); drag = { x: p.x, y: p.y, tx: transform.x, ty: transform.y }; } else drag = null;
  if (pointers.size < 2) pinch = null;
}
svg.addEventListener('pointerup', release); svg.addEventListener('pointercancel', release);
svg.addEventListener('wheel', event => { event.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(event.clientX - r.left, event.clientY - r.top, event.deltaY < 0 ? 1.12 : .89); }, { passive: false });
window.addEventListener('resize', () => requestAnimationFrame(fitGraph));
load();
