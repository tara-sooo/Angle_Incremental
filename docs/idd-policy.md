# Angle Incremental のIDDポリシー

このリポジトリのIDDは、オペレーターが指定した一つの明示されたGitHub Issueだけを
対象にします。Issueの自律選択、関連Issueの自動クローズ、release操作、
ゲーム本体の変更は通常ルートに含めません。

## 運用境界

- Issueはopen、startable、依存関係解決済みであることを確認してからclaimします。
- `issue/*`の隔離worktreeとworktree-local `idd-claim.lock`を使います。
- 通常のPR baseは厳密に`next`です。`next`だけがIDDの自動merge対象で、
  `main`、`release/**`、transition PR #105/#109、未知のbaseはhuman/fail-closedです。
- `main`は安定版、`next`は次回リリースの統合ブランチです。タグ、デプロイ、
  release PRのmerge判断は自動化しません。

## 設定との対応

- **Merge policy**: branch-aware。`next`は`fully_autonomous_merge`、その他は
  `human_merge`です。
- `main`、`release/**`、未知のbaseは`human_merge`です。
- **PR review policy**: `no-advisory`。外部レビューbotを要求・待機せず、
  内部のbounded critique、human review、CIを使います。
- **Review-thread resolution**: `fast-agent-resolve`。返信または修正が見えるまで
  actionableな未解決threadはmergeを止めます。
- **Claim timing**: stale 24時間、heartbeat 12時間、activation settle 5秒。
- **CI wait**: 実行30分、生成待ち10分、インフラ失敗のrerunは一回だけです。
- **Required-check read**: `ciGate.trustEmptyProtectionReads: true`は空の
  protection設定の読み取り互換性だけを許可し、vacuous greenは許可しません。
- **Helper runtime**: `instructions-only`。通常ルートは文書化された直接コマンドで
  完結します。Hosted CIのprofile routingは小さな決定的classifierで行い、
  外部のhelper runtimeや追加packageは要求しません。
- **Issue-author gate**: `skipIssueAuthorApprovalGate: true`。
- **Worktree guard**: 有効。primary worktreeは`next`に維持します。

## Merge gate

最終live gateは、同じPR headについて次を再取得して確認します。

1. active claim、activation nonce、branch、worktree lockが一致すること。
2. PR baseが厳密に`next`で、headが直近にreviewされたSHAと一致すること。
3. 実CIがそのSHAでgreenであること。空のruleset/protection読み取りだけで
   vacuous greenとはしません。
4. unresolved actionable thread、unreplied actionable comment、humanの
   `CHANGES_REQUESTED`がないこと。
5. PRがmergeableで、admin bypassを必要としないこと。

mergeはmerge commitにし、`--match-head-commit`で検証済みheadに固定します。
`--admin` fallbackは`hold-and-report`で禁止します。設定されたruleset、required
check、bypass actorを読み取れない場合もfail-closedです。現行のrelease境界は
PR必須、`regression` required check、thread解決、merge commit、no-bypassを要求し、
worker credentialはleast-privilegeとはみなしません。

## PRとIssueの関連付け

`next`向けIssue PRは本文に次を一度だけ含め、closing associationを作りません。

```text
Refs #N
<!-- idd-claimed-issue: N -->
```

`main`やその他のbaseではlive branch policyと
`scripts/idd-issue-association.mjs`を確認し、人間へhandoffします。

## 検証プロファイル

依存導入は選択した検証が必要とするときだけ行います。worktree lock取得前の
installは禁止です。`npm run validate`はroutine profileです。変更範囲から下表で
必要な最小profileを選び、複数条件が当たる場合は該当する補助gateをすべて実行
します。対象や影響を確信できない場合はroutine/full側へ昇格します。

| profile | 選択条件 | 必要なローカル証拠 |
| --- | --- | --- |
| `integration-only` | 衝突解決のない、検証済み履歴同期だけ | 期待する両parentの祖先性、conflict-free merge tree一致、`git diff --check`、必要なversion/state sentinel。追加実装や不確実性があれば`targeted`以上へ昇格 |
| `docs-policy` | IDD文書、指示、classifier、該当policy testのみ | `git diff --check`、`npm run check:idd-policy`、変更した実行可能ファイルだけ`node --check` |
| `targeted` | 影響範囲を限定できるコード変更 | runtime-order/syntax（該当時）、影響箇所の直接テスト、触れた契約だけのversion/policy check |
| `routine` | 通常のruntime/UI/gameplay変更、影響範囲が広い変更 | `npm run validate` |
| `performance` | perf-sensitive runtime/budget、または性能Issue | `targeted`または`routine`に加え`npm run test:performance` |
| `offline-stress` | Offline Progress/event schedulingと直接依存 | `targeted`または`routine`に加え`npm run test:offline-stress` |
| `release/full` | 実release候補または明示された高リスク横断変更 | `npm run validate:full`とrelease固有のrequired evidence |

一つのcommandが別checkを含む場合は同一証拠を重複実行しません。性能/offline gateは
該当profileで必須のままです。分類不能、手動conflict resolution、追加実装commit、
provenance不明は重いprofileへ昇格します。`tests/validation-layer-policy.mjs`が
command/profile境界を検査します。

research層は`npm run validate:research`、full層は`npm run validate:full`で実行します。
browserの責務は`test:browser-smoke`、`test:browser-features`、`test:render-regression`
に分離されています。

Hosted CIは変更path、PR base、検証済みmerge provenance、repository policyの高リスク
markerから決定的に分類します。既存の`regression`、`performance`、`offline-stress`
check名を維持します。非該当jobは理由を記録して成功し、dependency/browser setupを
省略します。classifier失敗・未知入力は全gateを実行する重いprofileです。通常の
production codeは従来のregression/browser floorを維持します。

`integration-only`はexact `next`へのmain backmergeに限り、baseをfirst parentとする
2-parent merge、main上のsource parent、extra commitなし、計算したconflict-free merge
treeとの一致、両source headの成功CIが確認できる場合だけです。branch-state/version
sentinelを軽量jobで実行します。どれか不明・不一致なら通常の重いgateへ戻します。

### ローカル性能とHosted CIの境界

変更範囲が`performance` profileに該当する場合は`npm run test:performance`を実行して
レポートを記録します。pre-push/post-fixは選択profileに従い、routineでは
`npm run validate`を使います。ローカルの
timing-budget-only failureやその反復にはHosted CIのrerun／second-failure holdを
適用しません。分類が必要な場合はtrustedな`origin/next`に対する
`npm run test:performance:local`を使い、`local-performance-regression`は停止、
`local-performance-inconclusive`は診断を記録してPRへ進め、Hosted CIを必須にします。
malformed/non-timing report、trusted base不正、claim/worktree ownership failureは
従来どおりfail-closedです。perf profileではcurrent-head Hosted CIのstrict absolute
budgetが必須で、not-applicable profileはclassifier理由付きの成功jobです。rerun/
second-failure/timeout/unknown holdの規則は実際に走ったrequired checkに適用します。

## IDD experience memory

Issueごとに`docs/idd-experience/index.md`から関連topicだけを読みます。B2/B3では
関連topicだけを開き、全topicを読みません。再利用価値のある非自明な知見だけを
diff安定後・PR submission前に記録し、通常の成功では追加しません。F4では
post-merge repository mutationを新設しません。experienceは現行Issue、policy/config、
code、testより低い権威です。
