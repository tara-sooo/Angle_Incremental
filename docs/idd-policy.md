# Angle Incremental のIDDポリシー

このリポジトリは、明示されたGitHub Issueを起点に作業する Issue-Driven Development (IDD) を使用します。IDDテンプレートは `kurone-kito/idd-skill` v0.6.0 から導入しています。

## 運用境界

- 作業対象は明示的に指定されたIssueに限定します。自律的なIssue選択は行いません。
- workerは`issue/*`の隔離worktreeで作業し、`next`と`main`へのマージはmaintainerが行います。
- `main`はリリース済みの安定版、`next`は次回リリースの統合ブランチです。
- リリース、タグ、デプロイ、マージの判断は自動化しません。
- 初回導入は`direct-import`、以後は通常のIssue→branch/worktree→PR→CI→reviewフローを使います。

## IDDポリシー設定

- **Merge policy**: `human_merge`
- **PR review policy**: `copilot-advisory`
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

IDDの標準ラベルは`roadmap`、`status:blocked-by-human`、`status:needs-decision`です。これらは`.github/idd/config.json`とGitHub上のラベル名を一致させます。

## 検証コマンド

- install: `npm ci`
- fix-validate: `npm run check:runtime-order && npm run check:syntax`
- pre-push/post-fix: `npm run validate`

`npm run validate`はruntime順序、構文、version consistency、ESM回帰、browser smoke、performance smokeを実行します。
