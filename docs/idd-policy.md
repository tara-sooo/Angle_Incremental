# Angle Incremental のIDDポリシー

このリポジトリは、明示されたGitHub Issueを起点に作業する Issue-Driven Development (IDD) を使用します。IDDテンプレートは `kurone-kito/idd-skill` v0.6.0 から導入しています。

## 運用境界

- 作業対象は明示的に指定されたIssueに限定します。自律的なIssue選択は行いません。
- DiscoverはA0-T（明示的なIssue指定）だけを使用し、対象がない場合は停止して指定を求めます。設定の`issueScope: roadmap`はスキーマ互換の機械可読フォールバックであり、自律選択を許可しません。
- workerは`issue/*`の隔離worktreeで作業し、branch-aware policyに従います。`next`の統合は全IDDゲート後に自動merge可能、`main`と`release/**`はmaintainerが行います。
- `main`はリリース済みの安定版、`next`は次回リリースの統合ブランチです。
- リリース、タグ、デプロイ、および`main`/`release/**`へのマージ判断は自動化しません。`next`の通常統合だけが明示的な自動merge許可です。
- 通常のIssue PRは`next`を対象にし、`next`から`main`へのリリースPRは既存の手動境界で管理します。
- 初回導入は`direct-import`、以後は通常のIssue→branch/worktree→PR→CI→reviewフローを使います。

## IDDポリシー設定

- **Merge policy**: branch-aware。`next`は`fully_autonomous_merge`、`main`/`release/**`/未知baseは`human_merge`、transition PR #105はhuman handoffです。
- **PR review policy**: `no-advisory`
- **External advisory reviewer**: none. IDD does not request or wait for
  an external review bot; Codex critique passes remain
  internal work/review checks with their existing bounded convergence guards.
- **Review-thread resolution**: `fast-agent-resolve`
- **Critique loop**: distributed defaults
- **Claim timing**: stale age 24時間、heartbeat 12時間
- **CI wait**: 実行30分、生成待ち10分、`rerun-once`
- **Required-check read trust**: `ciGate.trustEmptyProtectionReads: true`。これは空の保護設定を読む場合の互換ポリシーです。required ruleは必ず実CIと組み合わせて確認し、vacuous greenを許可しません。
- **Branch-aware merge policy**: `.github/idd/config.json`の`branchMergePolicy`と`node scripts/branch-merge-policy.mjs`がbase branchを分類します。`next`以外はfail-closedでhuman route、transition PR #105もhuman routeです。
- **Release human-merge ruleset**: `main`と`release/**`には`angle-incremental-human-release-boundary`を適用し、bypass actorなし、PR必須、`regression` required check、review thread解決、merge commitのみ、force push/delete禁止を要求します。required approvalは0件とし、solo maintainerが自分のPRでGitHubの自己承認deadlockに陥らない形にします。`node scripts/verify-human-merge-boundary.mjs --repo tara-sooo/Angle_Incremental --pr 105`で対象PRのbaseとlive boundaryを読み取ります。
- **Required-check registration**: `main`/`release/**`のrulesetで`regression`をGitHub Actions integration `15368`へsource-pinし、別integrationによるstatus偽装を受け付けません。
- **Worker credentials**: PR #101時点の`tara-sooo` OAuthはadmin-capableな広い権限であり、最小権限worker credentialとはみなしません。同一OAuthではGitHub上でworkerとsolo maintainerをactorとして完全分離できないため、現行のinterim boundaryは、workerからのRelease `workflow_dispatch`をworkflow自体から削除し、`main`/`release/**`をPR・`regression` check・thread解決・merge commit・no-bypassで保護し、IDD routeをhumanに固定することです。将来はActions workflow-execution policyまたは別worker identityでactor分離を追加します。`--admin` fallbackは`hold-and-report`で禁止します。
- **Merge credentials**: maintainerが別途管理
- **Issue-author approval**: enabled-by-default、承認者はowners/maintainersのみ
- **Helper runtime**: `instructions-only`。IDD npm依存関係は追加しない
- **Issue-authoring companion**: not installed
- **Worktree guard**: 有効。`core.hooksPath=.githooks`をローカルで設定する

## No-advisory verification boundary

The repository relies on CI, branch protection/rulesets, unresolved review
conversations, review-currency snapshots, and the branch-aware merge route.
Eligible ordinary issue PRs targeting `next` may use the normal F3 merge path
only after all IDD gates pass. `main`, `release/**`, transition PRs, and
unknown bases remain human-controlled; release/tag/GitHub Release operations
never become autonomous IDD work.

The active no-advisory surfaces are the review-fix, pre-merge, merge,
review-snapshot, review-triage, merge-handoff, and workflow-guide documents
listed in `profiles/no-advisory/README.md`. If a repository-local
`idd-advisory-convergence` check is configured, it is treated only as an
optional Codex critique/validation signal; this repository does not currently
host or require a workflow with that name, and it is never an external
reviewer request or wait gate.

IDDの標準ラベルは`roadmap`、`status:blocked-by-human`、`status:needs-decision`です。これらは`.github/idd/config.json`とGitHub上のラベル名を一致させます。

## 検証コマンド

- install: `npm ci`
- fix-validate: `npm run check:runtime-order && npm run check:syntax`
- pre-push/post-fix: `npm run validate`

`npm run validate`はruntime順序、構文、version consistency、ESM回帰、browser smoke、performance smokeを実行します。
