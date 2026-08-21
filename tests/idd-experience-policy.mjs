import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

const instruction = read('.github/instructions/idd-experience.instructions.md');
const readme = read('docs/idd-experience/README.md');
const index = read('docs/idd-experience/index.md');
const workflowExperience = read('docs/idd-experience/workflow.md');
const policy = read('docs/idd-policy.md');
const agents = read('AGENTS.md');
const claude = read('CLAUDE.md');
const gemini = read('GEMINI.md');

assert.match(instruction, /^---[\s\S]*applyTo: "\*\*"[\s\S]*# IDD — Repository Experience/m,
  'shared experience instruction must be auto-loadable on editor instruction surfaces');
assert.match(instruction, /Before B2\/B3 — scoped experience lookup/);
assert.match(instruction, /Open only the matching topic files[\s\S]*Do not read every topic file/i,
  'experience retrieval must stay scoped instead of loading a global memory dump');
assert.match(instruction, /current Issue[\s\S]*maintainer decision[\s\S]*code\/specification[\s\S]*policy[\s\S]*test\/CI/i,
  'current authoritative repository evidence must outrank experience');
assert.match(instruction, /Experience capture is optional/);
assert.match(instruction, /Routine successful work with no reusable lesson creates no entry/i,
  'routine success must not create mandatory experience noise');
assert.match(instruction, /update that record instead of appending a near-duplicate/i,
  'capture must deduplicate lessons');
assert.match(instruction, /Mark the experience record `promoted`[\s\S]*Authoritative at/i,
  'promoted lessons must point to their authoritative surface');
assert.match(instruction, /F4 does not create a new repository mutation after merge/i,
  'experience capture must not add a post-merge mutation or completion gate');
assert.match(instruction, /does not relax the explicit-target-only Discover policy/i,
  'experience lookup must not broaden Issue discovery');
assert.match(instruction, /Never store private chain-of-thought, full agent transcripts, credentials/i);

assert.match(readme, /Do not load the whole directory on every Issue/i);
assert.match(index, /Missing topic files mean no recorded lesson, not a retrieval failure/i);
assert.match(workflowExperience, /EXP-WF-001/);
assert.match(workflowExperience, /Status: promoted/);
assert.match(workflowExperience, /Learned from: Issue #104/);
assert.match(workflowExperience, /EXP-WF-002/);
assert.match(workflowExperience, /Status: active/);
assert.match(workflowExperience, /Learned from: Issue #198/);

for (const [name, source] of Object.entries({ AGENTS: agents, CLAUDE: claude, GEMINI: gemini })) {
  assert.match(source, /\.github\/instructions\/idd-experience\.instructions\.md/,
    `${name} entry must route IDD sessions through the shared experience instruction`);
}

assert.match(policy, /## IDD experience memory/);
assert.match(policy, /B2\/B3/);
assert.match(policy, /before PR submission/i);
assert.match(policy, /F4[\s\S]*does not create a post-merge repository mutation/i);
assert.match(policy, /明示されたGitHub Issue/,
  'experience integration must preserve the explicit-target-only repository boundary');
assert.match(policy, /`next`.*`fully_autonomous_merge`/,
  'experience integration must preserve next autonomous integration policy');
assert.match(policy, /`main`.*`release\/\*\*`.*`human_merge`/,
  'experience integration must preserve release human-merge policy');

console.log('IDD experience policy OK');