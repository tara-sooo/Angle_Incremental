# Angle Incremental 仕様書

対象リリース: **0.1.0**

この文書はゲーム仕様の基準文書である。実装・UI・テストに変更を加える場合は、この仕様書も同時に更新する。

## 1. ゲーム概要

**Angle Incremental** は、画面中央の正多角形 **The Angle** を強化し、Point の周回によってスコアを増やすインクリメンタルゲームである。

プレイヤーは通常強化で進行を加速し、Generation、Core Boost、Infinity の順に上位リセットを実行する。Infinity 到達後は Infinity Point（IP）で Infinity Upgrade（IU）を購入し、Infinity Challenge（IC）と Break Infinite Cap を目標に進行する。

## 2. 用語

| 用語 | 説明 |
| --- | --- |
| The Angle | 画面中央に描画される正多角形。ゲームの中心要素。 |
| Point | The Angle の外周を周回する点。 |
| 核 | The Angle の最上部の頂点。Point が到達するとスコアを獲得する。 |
| スコア | 通常強化に使う基本リソース。 |
| Generation（GR） | 累計スコアを条件に解放される第1リセット層。 |
| Core Boost（CB） | Generation より上位の第2リセット層。 |
| Infinity | 第3リセット層。IP と IU を解放する。 |
| Infinity Point（IP） | IU 購入および Infinite Angle 変換に使うリソース。 |
| Infinity Upgrade（IU） | IP を使って購入する恒久強化。 |
| Infinity Challenge（IC） | 制約付き Infinity 到達チャレンジ。 |

## 3. 初期状態

| 項目 | 初期値 |
| --- | --- |
| 現在スコア | 0 |
| 累計スコア | 0 |
| The Angle | 三角形 |
| 頂点数 | 3 |
| Point 数 | 1 |
| Generation | 未解放 |
| Core Boost | 0 |
| Infinity | 0 |

## 4. 基本ループ

1. Point が The Angle の外周を周回する。
2. Point が頂点を通過するたび、現在のスコア獲得量が増加する。
3. Point が核に到達すると、現在のスコア獲得量に応じたスコアを得る。
4. スコアを消費して通常強化を購入する。
5. 上位リセットを実行し、恒久的な進行加速を得る。

### 4.1 頂点通過による獲得量増加

```text
スコア獲得量 += 頂点通過ごとの増加値
```

初期の頂点通過ごとの増加値は `+0.01` とする。通常強化、Core Boost、IU、実績、Infinite Angle、Infinity Challenge 報酬がこの値または最終スコア獲得量を強化する。

### 4.2 The Angle の式

頂点数が4以上の場合、The Angle 由来の基礎獲得量には次の式を適用する。

```text
獲得スコア = (x / y) ^ y
y = min(floor(sqrt(頂点数)), 10)
```

`x` は基礎獲得量、`y` は頂点数から決まる項数である。頂点数3の開始状態では `y = 1` であり、追加の多項式化は発生しない。

## 5. 通常強化

| 強化名 | 効果 |
| --- | --- |
| ラップスピード強化 | Point の周回速度を上げる。 |
| 角の追加 | 頂点数を1増やす。 |
| 頂点獲得量強化 | 頂点通過ごとの増加値を上げる。 |

通常強化コストは log10 値でも管理し、JavaScript の通常数値上限を超える価格でも表示・購入判定を継続する。

### 5.1 初期追加スケーリング

```text
周回速度: Lv20超過分から 追加log10コスト += 超過Lv^2 × 0.00035
角追加: Lv15超過分から 追加log10コスト += 超過Lv^2 × 0.00140
頂点獲得量: Lv12超過分から 追加log10コスト += 超過Lv^2 × 0.00065
```

さらに高コスト帯では、通常強化共通の段階スケーリングを適用する。

```text
コストlog10 > 30:
  追加log10コスト += (コストlog10 - 30)^2 × 0.020

コストlog10 > 100:
  追加log10コスト += (コストlog10 - 100)^2 × 0.006
```

### 5.2 ラップスピードのソフトキャップ

生ラップスピードは伸び続けるが、実効ラップスピードには複数段階のソフトキャップを適用する。これにより、速度強化だけで上位レイヤーへ過度に早く到達することを防ぐ。

## 6. Generation

### 6.1 解放条件

```text
累計スコア >= 1,000,000
```

### 6.2 リセット

Generation 実行時、現在スコア、通常強化、世代中のスコア、頂点数をリセットする。累計スコア、Generation 回数、Generation 由来の補正は保持する。

### 6.3 報酬

Generation は次の恒久補正を与える。

- スコア獲得量への乗算・指数補正
- 通常強化コスト増加分の軽減

再 Generation は、今回の世代スコアが前回 Generation 実行時の世代スコアを超える場合のみ実行できる。

## 7. Core Boost

### 7.1 解放条件

```text
所持スコア >= 1.00e20
```

### 7.2 リセット

Core Boost は Generation 以下の進行をリセットする。Core Boost 回数とその恒久補正は保持する。

### 7.3 報酬

基本式は以下とする。

```text
頂点通過ごとの増加倍率 = 1 + Core Boost回数 × 0.5
スコア獲得量指数 = 1 + Core Boost回数 × 0.02
```

IU 7-1 購入後は、頂点通過ごとの増加倍率だけが次の式へ変化する。

```text
頂点通過ごとの増加倍率 = 1 + Core Boost回数 × 1.0
```

### 7.4 次回要求量

Core Boost を獲得するたび、次回要求量は指数的に上昇する。必要スコアは log10 値で管理し、通常数値上限を超える要求量も判定できるようにする。

## 8. Infinity

### 8.1 解放条件

```text
所持スコア >= 1.80e308
```

初回 Infinity は条件達成時に自動実行する。2回目以降は、条件を満たした状態で任意のタイミングに実行できる。

### 8.2 ソフトキャップ

Break Infinite Cap 前は、`1.80e308` 以降の所持スコアに強力なソフトキャップを適用する。所持スコアは `scoreLog10` でも保持し、通常数値上限を超えた進行を扱う。

### 8.3 リセット

Infinity 実行時、Infinity 未満の進行度を初期化する。

| 項目 | リセット後 |
| --- | --- |
| 現在スコア | 0 |
| 通常強化 | 初期化 |
| Generation | 初期化 |
| Core Boost | 初期化 |
| Infinite Score | 0 |

Infinity 回数、IP、IU、IC クリア状況、Break Infinite Cap 状態、実績はリセットされない。

### 8.4 Infinity Point

Infinity 実行時に IP を得る。Infinity 条件を満たしていない場合、IP は得られない。

Break Infinite Cap 前:

```text
IP = max(1, floor(log10(所持スコア) - 307))
```

Break Infinite Cap 後:

```text
IP = max(1, floor(log2(所持スコア) - 307))
```

実装では `log2(所持スコア)` を `scoreLog10 / log10(2)` として計算する。IC 報酬などの倍率は、基本獲得量に乗算した後で整数化する。

## 9. Infinity Upgrade

Infinity Upgrade（IU）は IP を消費して購入する恒久強化であり、Infinity リセットでは失われない。

- 各IUは、前提IUをすべて購入してから取得できる。
- 同じ段の複数IUは、同じ前提を満たしていれば任意の順で購入できる。
- 今後のアップデートで新しいIUを追加できる。

| IU | 必要IP | 前提 | 効果 |
| --- | ---: | --- | --- |
| 1-1 リセットは負ではない | 1 | なし | 頂点通過ごとの増加が `Infinity回数 + 1` 倍される。 |
| 1-2 はじめてのQoL | 1 | なし | 通常強化の自動購入を解放する。 |
| 2-1 最速タイム | 1 | 1-1, 1-2 | ラップスピードが `×1.5` される。 |
| 3-1 スコア革命 | 3 | 2-1 | GR スコア倍率が `^1.5` される。 |
| 3-2 コスト革命 | 3 | 2-1 | GR コスト倍率が `×0.95` される。 |
| 4-1 縛り縛られ | 5 | 3-1, 3-2 | Infinity Challenge を解放する。 |
| 5-1 スタートダッシュ | 10 | 4-1 | ラップスピードが `×3` される。 |
| 5-2 親が地主 | 10 | 4-1 | Generation、Core Boost、Infinity、IC開始・中止によるリセット後、スコア100で開始する。開始時スコアは累計スコア・世代スコアには加算しない。 |
| 6-1 ほんのりした甘味 | 50 | 5-1, 5-2 | GR スコア倍率がさらに `^1.2` される。 |
| 6-2 澄んだ視界 | 50 | 5-1, 5-2 | GR コスト倍率の下限が `×0.70` になる。 |
| 7-1 権力の集中 | 150 | 6-1, 6-2 | Core Boost 由来の増加分だけが2倍になる。式は `1 + Core Boost回数 × 1.0`。 |
| 7-2 庶民の幸せ | 150 | 6-1, 6-2 | Infinity 回数に応じて通常強化コストを指数的に下げる。 |

### 9.1 IU 7-2: 通常強化コスト軽減

IU 7-2 購入後、通常強化コストの最終log10値に次のコスト指数を掛ける。

```text
通常強化コスト = 通常強化コスト ^ コスト指数
```

Infinity 回数を `I` とする。

```text
I <= 50:
  コスト指数 = 1 - 0.002 × I

I > 50:
  コスト指数 = 0.8 + 0.1 × exp(-0.005 × (I - 50))
```

50回目の Infinity でコスト指数は `^0.9` に到達する。以降は効果が逓減し、`^0.8` に漸近する。これは `^0.9` 到達後のソフトキャップとして扱う。

## 10. Infinity Challenge

Infinity Challenge（IC）は、制約付きで Infinity 到達を目指す要素である。IU 4-1 購入後に解放される。

| IC | 制約 | 報酬 |
| --- | --- | --- |
| IC1 改悪された計算式 | 基礎獲得式の除数が10倍になる。 | 除数を撤廃する。 |
| IC2 現実的に書ける範囲で | 頂点数は200を超えない。 | 通常強化コストが `^0.95` される。 |
| IC3 ナメクジよりは早い | ラップスピードが `^0.8` され、周回速度強化のコスト増加が2倍になる。 | ラップスピード `×1.1`。 |
| IC4 うん、それ以上もそれ以下もないよ | 頂点獲得量が `^0.5` される。 | 頂点獲得量が `^1.1` される。 |
| IC5 環境配慮 | Core Boost を実行できない。 | Core Boost の獲得指数 `+0.01`。 |
| IC6 最初だけ強い | 頂点通過ごとの増加は0.001で固定される。 | Infinity 獲得量 `×2`。 |
| IC7 倹約家もどき | **価格が1e30を超える通常強化**を購入できない。 | 購入価格以上のスコアがある通常強化は、購入時にスコアを消費しない。 |
| IC8 反出生主義 | 頂点数は3で始まり、角追加を購入できず、Generation と Core Boost で頂点数がリセットされない。 | 頂点数が Generation と Core Boost でリセットされない。 |

IC 中に Infinity 条件を満たして Infinity を実行すると、その IC はクリア済みになる。IC 自動完了がオンの場合、この Infinity 実行は自動化できる。

## 11. Break Infinite Cap

### 11.1 実行条件

```text
所持スコア >= 1.00e350
```

### 11.2 効果

Break Infinite Cap は恒久的な状態である。実行後は `1.80e308` 以降の強力なスコアソフトキャップを除去する。

Infinity の実行条件そのものは引き続き `1.80e308` のままである。Break Infinite Cap は現在、IC全クリアを追加条件としない。

## 12. Infinite Angle

Infinite Angle（IA）は IP を Infinite Score に変換する恒久進行要素である。

- 変換コスト: `1.00e20 IP`
- 変換量: `+10 Infinite Score`
- Infinite Score は頂点通過ごとのスコア獲得量増加を強化する。
- Infinity 実行時、Infinite Score は0に戻る。
- IU は Infinity 実行後も保持される。

## 13. 自動化と統計

IU 1-2 購入後、通常強化の自動購入を使用できる。

- 全体オン/オフと、周回速度・角追加・頂点獲得量ごとの個別オン/オフを持つ。
- 自動購入は0.1秒ごとに購入を試行する。
- IU 4-1 購入後は、IC 自動完了をオンにできる。

統計タブでは総プレイ時間、現在のInfinity周回、最速Infinity、過去10回のInfinity記録を表示する。

## 14. 実績

実績はすべてのゲーム内リセットを超えて保持される恒久要素である。

```text
実績増加倍率 = 1.01 ^ 達成済み実績数
```

実績には追加報酬を持つものがある。代表的な進行条件は、頂点数増加、Generation、Core Boost、Infinity、IU購入、ICクリア、累計プレイ時間である。

## 15. セーブ

セーブデータはローカルストレージへ自動・手動保存する。セーブコードは `ANGLE_SAVE_V2:` で始まり、AES-GCM を用いた暗号化形式で書き出し・読み込みできる。

主要な保存項目には、スコアとそのlog10値、Generation、Core Boost、Infinity、IUマスク、IC状態、Break Infinite Cap、Infinite Score、実績、自動化設定、統計値が含まれる。

## 16. バージョン管理

公開バージョンは Semantic Versioning 形式を採用する。

```text
major.minor.patch
```

- `major`: セーブ互換性を壊す大規模変更。
- `minor`: 新レイヤー、新しいIU、新しいICなどの後方互換な機能追加。
- `patch`: バグ修正、調整、文言・UI修正。

現在の対象リリースは `0.1.0` とする。ランタイムの `APP_VERSION` と `version.json` の `appVersion` は常に同じ文字列に揃える。更新検知機構はこの一致を前提にしている。

## 17. 推奨データ構造

```text
score
scoreLog10
totalScore
totalScoreLog10
generationScore
generationScoreLog10
vertices
speedLevel
gainLevel
currentGain
currentGainLog10
generationCount
generationScoreMultiplier
generationScoreMultiplierLog10
generationCostFactor
coreBoostCount
infinityCount
infinityPoints
infinityPointsLog10
infinityUpgradeMask
activeChallenge
completedChallenges
infiniteCapBroken
infiniteScore
infiniteScoreLog10
achievementMask
automationEnabled
autoBuySpeed
autoBuyVertex
autoBuyGain
autoCompleteChallenges
currentInfinityRunTime
fastestInfinityTime
lastInfinityRuns
```

## 18. 今後の拡張

- IUの新しい段と分岐
- 新しいInfinity Challenge
- Infinite Angle の独立した図形表示
- 後半の複数 Point
- 実績の個別追加報酬
- バランス調整に伴う通常強化・リセット報酬の数値改定
