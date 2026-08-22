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

## IDD experience memory

IDDの実行状態とは別に、再利用価値のあるプロジェクト固有の経験を `docs/idd-experience/` に保存します。共通の実行規則は `.github/instructions/idd-experience.instructions.md` に置き、特定のモデルやセッションの隠れたメモリには依存しません。

- B2/B3では、Issue・Candidate files・予定変更箇所から関連topicを決め、`docs/idd-experience/index.md`経由で関連する経験だけを読みます。全topicの一括ロードは行いません。
- 経験は現在のIssue、maintainer判断、現行spec/code、IDD policy/config、現行test/CIより低い権威です。競合時は現行の権威側を優先し、古い経験を更新またはsupersedeします。
- 再利用できる非自明な知見が得られた場合だけ、Cでdiffが安定した後かつPR submissionへ進む前に経験を追加・更新します。通常の成功だけでは記録を要求しません。
- 同じ知見は重複追加せず既存recordを更新します。安定した規則は通常docs/policyへ、機械化できる規則はtest/helper/CIへ昇格させ、経験recordは`promoted`として権威先を指します。
- F4は既にmergeされたdiffに含まれる経験を報告できますが、experienceのためにpost-merge repository mutationを新設しません。経験記録の有無は新しいhuman gateやcompletion gateではありません。
- private chain-of-thought、完全なagent transcript、credential、外部SaaS memory/databaseは経験ストアの対象外です。

この層はDiscoverの範囲を変更しません。引き続き作業対象は明示されたGitHub Issueだけです。

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

検証は、日常のproduction変更で必ず行うroutine層、研究Issueが明示的に選ぶresearch層、リリース準備などで全層を確認するfull層に分けます。

### Routine production validation

`npm run validate`はruntime順序、構文、version consistency、IDD policy、ESM回帰、browser smoke、ローカル性能ゲートを実行します。TC4などの研究シミュレータはroutine層には含めません。IDDのfix-validate／pre-push／post-fixは、引き続きこのroutine層を使用します。

### Explicit research validation

`npm run validate:research`は、既存の7つのTC4 balance/research simulator checkを同じ順序で実行します。研究シミュレータ本体・その出力・研究専用fixtureを変更するIssue、production helperの意味を研究シミュレータが意図的に再現していて互換性確認が必要なIssue、研究レポートを受入れ証拠に使うIssue、またはIssue本文がresearch suiteを明示するIssueでは、このコマンドを必須検証として実行し、結果をPRの証拠に含めます。無関係なgameplay/UI/docs/maintenance変更は、研究層を実行する必要はありません。

### Full and hosted validation

`npm run validate:full`はroutine validation、Hosted CI向けの絶対性能テスト（`npm run test:performance`）、offline stress（`npm run test:offline-stress`）、research validationを順に実行する明示的な広範囲aggregateです。routine `validate`を重く戻すための別名ではありません。

Hosted regression workflowは、production correctness、local classifier、絶対性能、offline stressを独立したステップとして実行し、性能予算を緩和しません。`npm run test:performance`の絶対予算とoffline/work-budget検証はHosted CIを権威とします。TC4/research evidenceが必要なIssueでは、上記のresearch層またはfull層を追加で実行します。

スクリプトの層分離は`tests/validation-layer-policy.mjs`で機械的に検証します。各層は研究シミュレータのアルゴリズム、結果、production gameplay/balanceを変更しません。
