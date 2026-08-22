export const REPO = 'tara-sooo/Angle_Incremental';
export const ISSUE_BASE = `https://github.com/${REPO}/issues/`;
const API = `https://api.github.com/repos/${REPO}`;

const BLOCKED_MARKER = /angle-incremental-blocked-by[^#\d]*(?:#)?(\d+)/gi;
const REF_PATTERN = /^\s*Refs?\s+#(\d+)\s*[.;,]?\s*$/gim;
const TASK_PATTERN = /^\s*[-*]\s*\[[ xX]\]\s*#(\d+)\b/gim;
const BLOCKED_BY_PATTERN = /\b(?:blocked\s+by|depends\s+on|dependency\s+on|requires?)\s*#(\d+)\b/gi;
const NUMBER_REQUIRES_PATTERN = /#(\d+)[^\n.]{0,100}\b(?:must\s+complete|must\s+land|is\s+required\s+before|blocks?\s+this)\b/gi;
const FORWARD_PATTERN = /\b(?:unblocks?|blocks?)\s*#(\d+)\b/gi;
const INPUT_TO_PATTERN = /\b(?:input|handoff|research\s+input)\s+to\s*#(\d+)\b/gi;

function collect(text, regex, callback) {
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) callback(Number(match[1]));
}

function inferEdges(issue, known) {
  const body = issue.body || '';
  const edges = [];
  const add = (from, to, type, reason) => {
    if (known.has(from) && known.has(to) && from !== to) edges.push({ from, to, type, reason });
  };
  collect(body, BLOCKED_MARKER, n => add(n, issue.number, 'hard', 'IDD blocked-by marker'));
  collect(body, BLOCKED_BY_PATTERN, n => add(n, issue.number, 'hard', 'explicit dependency wording'));
  collect(body, NUMBER_REQUIRES_PATTERN, n => add(n, issue.number, 'hard', 'required-before wording'));
  collect(body, FORWARD_PATTERN, n => add(issue.number, n, 'hard', 'blocks/unblocks wording'));
  collect(body, INPUT_TO_PATTERN, n => add(issue.number, n, 'hard', 'handoff/input wording'));
  collect(body, REF_PATTERN, n => add(n, issue.number, 'soft', 'Refs'));
  collect(body, TASK_PATTERN, n => add(issue.number, n, 'soft', 'task-list hierarchy'));
  return edges;
}

export async function fetchAllIssues(onProgress) {
  const collected = [];
  let remaining = null;
  for (let page = 1; page <= 20; page += 1) {
    onProgress?.(`GitHub Issues を取得中… page ${page}`);
    const response = await fetch(`${API}/issues?state=all&per_page=100&page=${page}`, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    const limit = response.headers.get('x-ratelimit-remaining');
    if (limit !== null) remaining = Number(limit);
    if (!response.ok) {
      let detail = '';
      try {
        const payload = await response.json();
        detail = payload.message ? ` — ${payload.message}` : '';
      } catch {}
      const rate = response.status === 403 && remaining === 0
        ? '（GitHub APIの未認証レート制限に達した可能性があります）'
        : '';
      throw new Error(`GitHub API ${response.status}: ${response.statusText}${detail}${rate}`);
    }
    const batch = await response.json();
    collected.push(...batch.filter(item => !item.pull_request));
    if (batch.length < 100) break;
  }
  return { issues: collected, remaining };
}

export function buildGraph(allIssues, minIssue) {
  const nodes = allIssues.filter(issue => issue.number >= Math.max(1, minIssue || 1));
  const known = new Set(nodes.map(issue => issue.number));
  const raw = nodes.flatMap(issue => inferEdges(issue, known));
  const seen = new Set();
  const unique = raw.filter(edge => {
    const key = `${edge.from}:${edge.to}:${edge.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const hardPairs = new Set(unique.filter(e => e.type === 'hard').map(e => `${e.from}:${e.to}`));
  return { nodes, edges: unique.filter(e => e.type === 'hard' || !hardPairs.has(`${e.from}:${e.to}`)) };
}
