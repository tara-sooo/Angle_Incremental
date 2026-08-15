# Angle Incremental のIDDポリシー

このリポジトリは、明示されたGitHub Issueを起点に作業する Issue-Driven Development (IDD) を使用します。IDDテンプレートは `kurone-kito/idd-skill` v0.6.0 から導入しています。

## 運用境界

- 作業対象は明示的に指定されたIssueに限定します。自律的なIssue選択は行いません。
- DiscoverはA0-T（明示的なIssue指定）だけを使用し、対象がない場合は停止して指定を求めます。設定の`issueScope: roadmap`はスキーマ互換の機械可読フォールバックであり、自律選択を許可しません。
- workerは`issue/*`の隔離worktreeで作業し、`next`と`main`へのマージはmaintainerが行います。
- `main`はリリース済みの安定版、`next`は次回リリースの統合ブランチです。
- リリース、タグ、デプロイ、マージの判断は自動化しません。
- 通常のIssue PRは`next`を対象にし、`next`から`main`へのリリースPRは既存の手動境界で管理します。
- 初回導入は`direct-import`、以後は通常のIssue→branch/worktree→PR→CI→reviewフローを使います。

## IDDポリシー設定

- **Merge policy**: `human_merge`
- **PR review policy**: `no-advisory`
- **External advisory reviewer**: none. IDD does not request or wait for
  an external review bot; Codex critique passes remain
  internal work/review checks with their existing bounded convergence guards.
- **Review-thread resolution**: `fast-agent-resolve`
- **Critique loop**: distributed defaults
- **Claim timing**: stale age 24時間、heartbeat 12時間
- **CI wait**: 実行30分、生成待ち10分、`rerun-once`
- **Up-to-date-head ruleset**: 無効（現在ruleset/branch protectionは未設定）
- **Required-check registration**: 未適用。`contexts`のpinning設定も行わない
- **Worker credentials**: merge権限なし
- **Merge credentials**: maintainerが別途管理
- **Issue-author approval**: enabled-by-default、承認者はowners/maintainersのみ
- **Helper runtime**: `instructions-only`。IDD npm依存関係は追加しない
- **Issue-authoring companion**: not installed
- **Worktree guard**: 有効。`core.hooksPath=.githooks`をローカルで設定する

## No-advisory verification boundary

The repository relies on CI, branch protection when configured, unresolved
review conversations, review-currency snapshots, and human review rules
outside IDD. `human_merge` remains the final integration boundary: workers
never merge pull requests. Ordinary issue pull requests target `next`, while
`main` remains the stable release boundary and release PRs keep their existing
manual flow.

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
