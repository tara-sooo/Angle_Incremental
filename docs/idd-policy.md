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
  完結し、任意のruntimeやprofile分岐を要求しません。
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

## 検証

- install: `npm ci`
- fix-validate: `npm run check:runtime-order && npm run check:syntax`
- pre-push/post-fix: `npm run validate`

`npm run validate`はruntime順序、構文、version、IDD policy、回帰、browser smoke、
ローカル性能classifierをroutineとして確認します。research、絶対性能、offline
stress、release E2Eは対象Issueが明示した場合だけ追加します。レイヤー分離は
`tests/validation-layer-policy.mjs`が検証します。

research層は`npm run validate:research`、full層は`npm run validate:full`で明示的に
実行します。browserの責務は`test:browser-smoke`、`test:browser-features`、
`test:render-regression`に分離されています。

## IDD experience memory

Issueごとに`docs/idd-experience/index.md`から関連topicだけを読みます。B2/B3では
関連topicだけを開き、全topicを読みません。再利用価値のある非自明な知見だけを
diff安定後・PR submission前に記録し、通常の成功では追加しません。F4では
post-merge repository mutationを新設しません。experienceは現行Issue、policy/config、
code、testより低い権威です。
