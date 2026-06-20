# Angle Incremental 仕様書

## 1. ゲーム概要

**Angle Incremental** は、画面中央に表示される図形 **The Angle** を強化し、スコアを増やしていくインクリメンタルゲームである。

プレイヤーはスコアを消費して The Angle を強化し、より効率よくスコアを獲得する。累計スコアが一定値に到達すると **Generation** が解放され、進行度をリセットする代わりに恒久的なブーストを得られる。

## 2. 用語定義

| 用語 | 説明 |
| --- | --- |
| The Angle | 画面中央に表示される多角形。ゲームの中心要素。 |
| Point | The Angle の外周を周回する点。 |
| 核 | The Angle の一番上の頂点。Point がここに到達するとスコアを獲得する。 |
| スコア | The Angle の強化に使用する基本リソース。 |
| 頂点 | The Angle を構成する角。初期値は3。 |
| Generation | 累計スコア 1,000,000 到達後に解放されるリセット系成長要素。 |

## 3. 初期状態

| 項目 | 初期値 |
| --- | --- |
| 現在スコア | 0 |
| 累計スコア | 0 |
| The Angle | 三角形 |
| 頂点数 | 3 |
| Point 数 | 1 |
| Generation | 未解放 |

## 4. The Angle と Point

### 4.1 The Angle

The Angle は正多角形として扱う。

初期状態では三角形であり、強化によって頂点数を増やすことができる。

### 4.2 Point

Point は The Angle の外周上を一定速度で移動する。

Point は各頂点を順番に通過し、図形を1周する。

### 4.3 核

核は The Angle の一番上の頂点とする。

Point が核に到達するたびに、プレイヤーはスコアを獲得する。

## 5. スコア獲得仕様

### 5.1 基本スコア獲得

Point が核に到達したとき、現在のスコア獲得量に応じてスコアを得る。

```text
獲得スコア = 現在のスコア獲得量
```

### 5.2 頂点通過による獲得量増加

Point が各頂点を通過するたびに、スコア獲得量が増加する。

```text
スコア獲得量 += スコア獲得量増加値
```

初期の増加値は以下とする。

```text
スコア獲得量増加値 = +x0.01
```

実装上は「基礎獲得量に対する +0.01 倍分の補正」として扱う。

例:

```text
基礎獲得量 = 1
頂点通過ごとの増加値 = 0.01
頂点を1つ通過するたびに獲得量 +0.01
```

### 5.3 1周中の獲得量上昇

Point は頂点を通るたびに獲得量を上げるため、頂点数が多いほど1周あたりの獲得量が上昇しやすくなる。

## 6. The Angle の強化

プレイヤーはスコアを消費して The Angle を強化できる。

| 強化名 | 効果 |
| --- | --- |
| ラップスピード強化 | Point が1周する速度を上げる。 |
| 角の追加 | The Angle の頂点数を増やす。 |
| スコア獲得量増加の強化 | 頂点通過時の獲得量増加値を上げる。 |

通常強化コストは log10 値でも扱い、JavaScript の通常数値上限を超えた後も購入判定と表示を継続できるようにする。

Core Boost や Infinity へ早く到達しすぎないよう、通常強化コストには追加スケーリングを適用する。この追加スケーリングは Generation と Core Boost の進行に応じて段階的に緩和される。

```text
周回速度: Lv20超過分から 追加log10コスト += 超過Lv^2 x 0.300
角追加: Lv15超過分から 追加log10コスト += 超過Lv^2 x 1.200
頂点獲得量: Lv12超過分から 追加log10コスト += 超過Lv^2 x 0.550

Generation係数:
  GR 0回 = 1.00
  GR 1回 = 0.90
  GR 2回 = 0.45
  GR 3回 = 0.20
  GR 4回以上 = 0

Core Boost緩和:
  CB 0回 = 1.00
  CB 1回 = 0.35
  CB 2回 = 0.10
  CB 3回以上 = 0

実際の追加log10コスト = 基礎追加log10コスト x Generation係数 x Core Boost緩和
```

### 6.1 ラップスピード強化

Point が The Angle を1周する時間を短縮する。

```text
周回時間 = 基礎周回時間 / ラップスピード倍率
```

ラップスピード倍率が一定値を超える場合、実効倍率にはソフトキャップを適用する。

```text
Generation 0回:
  実効ラップスピード倍率 = 35 × (生ラップスピード倍率 / 35)^0.22

Generation 1回以上:
  ソフトキャップ開始点 = min(200, 60 + (Generation回数 - 1) x 40 + Core Boost回数 x 65)
  ソフトキャップ指数 = min(0.5, 0.24 + (Generation回数 - 1) x 0.06 + Core Boost回数 x 0.10)
  実効ラップスピード倍率 = ソフトキャップ開始点 × (生ラップスピード倍率 / ソフトキャップ開始点)^ソフトキャップ指数
```

これにより、Generation 前はラップスピード強化だけで Core Boost まで到達しにくくし、Generation と Core Boost が進むほど速度投資の価値が戻るようにする。

### 6.2 角の追加

The Angle の頂点数を1つ増やす。

```text
頂点数 += 1
```

頂点数が増えることで、Point が1周中に通過する頂点数が増え、スコア獲得量の増加機会も増える。

### 6.3 スコア獲得量増加の強化

頂点通過時に増えるスコア獲得量を強化する。

```text
頂点通過時の増加値 += 強化量
```

例:

```text
初期値: +x0.01
強化後: +x0.02
さらに強化後: +x0.03
```

## 7. スコア獲得量の多項式化

### 7.1 概要

スコア獲得量は、一定の頂点数を超えると The Angle 由来の基礎獲得量に追加式がかかる。

The Angle 由来の基礎獲得量を `x`、現在の頂点数から決まる項数を `y` とする。

```text
獲得スコア = (x / y) ^ y
```

この式は表示だけでなく、実際のスコア獲得量に適用される。Generation、Core Boost、実績、Infinity 系の補正は、この式を適用した後に乗算・指数補正する。

### 7.2 項数

`y` は現在の頂点数の平方根をもとに決定する。

```text
y = floor(sqrt(頂点数))
```

ただし最大値は10とする。

```text
y = min(floor(sqrt(頂点数)), 10)
```

### 7.3 例

| 頂点数 | sqrt(頂点数) | y |
| --- | ---: | ---: |
| 3 | 1.73 | 1 |
| 4 | 2.00 | 2 |
| 9 | 3.00 | 3 |
| 16 | 4.00 | 4 |
| 100 | 10.00 | 10 |
| 121 | 11.00 | 10 |

## 8. Generation

### 8.1 解放条件

累計スコアが以下に到達すると Generation が解放される。

```text
累計スコア >= 1,000,000
```

### 8.2 役割

Generation は、Generation 未満の進行度をリセットする代わりに強力なブーストを得るシステムである。

リセット後は序盤からやり直すが、Generation 由来の補正により以前より速く進行できる。

## 9. Generation 実行時のリセット

Generation を実行すると、Generation 未満の進行度がリセットされる。

### 9.1 リセット対象

| 項目 | リセット後 |
| --- | --- |
| 現在スコア | 0 |
| The Angle の強化 | 初期化 |
| 頂点数 | 3 |
| ラップスピード強化 | 初期化 |
| スコア獲得量増加強化 | 初期化 |

### 9.2 リセットされない要素

| 項目 | 説明 |
| --- | --- |
| Generation 関連の強化 | 恒久的に保持する。 |
| 累計 Generation 回数 | 保持する。 |
| Generation 由来のブースト | 保持する。 |

## 10. Generation ブースト

Generation によって、以下のブーストが得られる。

### 10.1 スコア獲得量乗算

スコア獲得量に乗算補正をかける。

```text
最終獲得スコア = 通常獲得スコア x Generationスコア倍率
```

### 10.2 強化コスト軽減

The Angle の強化に必要なスコアの増加分を軽減する。

Generation コスト倍率は 1 未満になるほど強力になる。

例:

```text
0.90 = コスト増加分を10%軽減
0.75 = コスト増加分を25%軽減
0.50 = コスト増加分を50%軽減
```

Generation コスト倍率は、強化コスト全体ではなくコスト増加分にのみ適用する。

```text
最終強化コスト = 基礎コスト + (通常強化コスト - 基礎コスト) x Generationコスト倍率
```

## 11. Generation ブーストの強化量

Generation によるブースト量は、その世代中に獲得した累計スコア量によって決まる。

### 11.1 今回の世代スコア

Generation 実行時、現在の世代で稼いだ累計スコアを参照する。

```text
今回の世代スコア = Generation後から現在までに獲得した累計スコア
```

### 11.2 ブースト計算方針

今回の世代スコアが高いほど、次回以降の Generation ブーストが強化される。

計算式はバランス調整対象とする。現行の実装式は以下。

```text
世代深度 = max(0, log10(今回の世代スコア / 1,000,000))
スコア倍率獲得係数 = 1 + min(1.25, 0.12 + log10(1 + 世代深度) x 0.22)
コスト軽減率 = min(0.08, 0.01 + log10(1 + 世代深度) x 0.012)

Generationスコア倍率 = Generationスコア倍率 x スコア倍率獲得係数
Generationコスト倍率が0.6以上の場合:
  Generationコスト倍率 = max(0.6, Generationコスト倍率 x (1 - コスト軽減率))
Generationコスト倍率が0.6未満の場合:
  Generationコスト倍率を維持
```

スコア計算に使う実効 Generation スコア倍率は、蓄積された Generation スコア倍率に指数補正をかける。

```text
実効Generationスコア倍率 = Generationスコア倍率 ^ 2.00
IC3クリア後:
  実効Generationスコア倍率 = Generationスコア倍率 ^ 2.10
実績3達成後:
  実効Generationスコア倍率 = 1 + (実効Generationスコア倍率 - 1) x 2
```

既存セーブで Generationコスト倍率 が 0.6 未満の場合は、その値を維持する。

### 11.3 再Generation条件

2回目以降の Generation は、今回の世代スコアが前回 Generation 実行時の世代スコアを超えている場合のみ実行できる。

```text
Generation可能条件 = 今回の世代スコア > 前回Generation時の世代スコア
```

これにより、前回より弱い Generation を実行して進行が悪化することを防ぐ。

### 11.4 ラップスピードソフトキャップ緩和

Generation を1回以上実行した後は、Generation スコア倍率が伸びるとラップスピードのソフトキャップ開始点が少し上がる。

```text
ソフトキャップ開始点 = 段階開始点 x (1 + min(1.5, log10(Generationスコア倍率) x 0.08))
```

Generation 0回の間は、6.1のGR前ソフトキャップを使う。IC1中は Generation が機能しないため、この緩和も無効になる。

## 12. Core Boost

### 12.1 解放条件

所持スコアが以下に到達すると、1回目の Core Boost を実行できる。

```text
所持スコア >= 1.00e20
```

### 12.2 役割

Core Boost は、Generation より上位の2つ目のリセットレイヤーである。

Core Boost を実行すると、Core Boost 未満の進行度をリセットする代わりに、より強力な恒久ブーストを得る。

### 12.3 リセット対象

Core Boost 実行時、以下を初期化する。

| 項目 | リセット後 |
| --- | --- |
| 現在スコア | 0 |
| 累計スコア | 0 |
| 今回の世代スコア | 0 |
| The Angle の強化 | 初期化 |
| 頂点数 | 3 |
| Generation 回数 | 0 |
| Generation 由来のブースト | 初期化 |

Core Boost の累計獲得量はリセットされない。

### 12.4 Core Boost ブースト

Core Boost によって、以下のブーストが得られる。

| 強化内容 | 効果 |
| --- | --- |
| スコア獲得量増加の増加 | 頂点通過ごとの獲得量増加値を乗算する。 |
| スコア獲得量の指数増加 | 核到達時のスコア獲得量に指数補正をかける。 |

実装上の初期式は以下とする。

```text
頂点通過ごとの増加倍率 = 1 + CoreBoost数 x 0.5
スコア獲得量指数 = 1 + CoreBoost数 x 0.05
最終獲得スコア = (現在の獲得量 ^ スコア獲得量指数) x Generationスコア倍率
```

### 12.5 次回要求量

Core Boost を1回獲得するたびに、次回の必要スコアは2乗される。

```text
次回CoreBoost必要スコア = 今回CoreBoost必要スコア ^ 2
```

例:

```text
1回目: 1.00e20
2回目: 1.00e40
3回目: 1.00e80
```

実装上、JavaScript の通常数値で扱える範囲を超える場合は、必要スコア表示と判定を `1.00e308以上` にキャップする。

## 13. Infinity

### 13.1 解放条件

Infinity は3つ目のリセットレイヤーである。

所持スコアが以下に到達すると、初回 Infinity が強制的に実行される。

```text
所持スコア >= 1.80e308
```

2回目以降は、条件を満たしているときに任意のタイミングで実行できる。

### 13.2 1.80e308 以降のソフトキャップ

1.80e308 以降もスコアは伸びるが、Break Infinite Cap までは強力なソフトキャップを受ける。

実装上は通常の JavaScript 数値範囲を超えるため、所持スコアは `scoreLog10` でも保持し、1.80e308 以降の伸びを log 空間で圧縮する。

### 13.3 Infinity 実行時のリセット

Infinity を実行すると、Infinity 未満の進行度を初期化する。

| 項目 | リセット後 |
| --- | --- |
| 現在スコア | 0 |
| The Angle の強化 | 初期化 |
| Generation | 初期化 |
| Core Boost | 初期化 |
| Infinite Score | 0 |

Infinity 回数、Infinity Point、Infinity Upgrade、Infinity Challenge のクリア状況、Break Infinite Cap の状態はリセットされない。

### 13.4 Infinity Point

Infinity を実行すると Infinity Point（IP）を獲得する。

IP は Infinity Upgrade の購入と Infinite Angle への変換に使用する。

初期実装では、到達スコアの log10 が Infinity 条件をどれだけ上回ったかに応じて IP 獲得量が増加する。

## 14. Infinity Upgrade

Infinity Upgrade は IP を消費して獲得できる恒久強化である。

Infinity リセットでは失われない。

初期実装の強化は以下とする。

| 強化名 | 効果 |
| --- | --- |
| IP倍率 | Infinity 実行時の IP 獲得量を増やす。 |
| IA効率 | IP を Infinite Score に変換するときの獲得量を増やす。 |
| 軟上限緩和 | 1.80e308 以降のソフトキャップを緩和する。 |

## 15. Infinity Challenge

Infinity Challenge（IC）は、縛りを課せられた状態で Infinity 到達を目指す要素である。

IC 中に Infinity 条件を満たして Infinity を実行すると、その IC をクリアした扱いになる。

初期実装の IC は以下とする。

| IC | 縛り | 報酬 |
| --- | --- | --- |
| IC1 Generation停止 | Generation は機能しない。 | IP の獲得量が 2 倍になる。 |
| IC2 核増幅圧縮 | CB ボーナス獲得量が ^0.6 される。 | CB ボーナス獲得量が ^1.1 される。 |
| IC3 逆世代 | Generation の効果が逆転し、Generation によるボーナスが ^0.7 される。 | Generation が少し強くなる。 |
| IC4 二重核 | 核の数は 2 で固定され、スコアは ラップスピード + 10 で割られる。 | スコア獲得量は ^2 される。 |
| IC5 Infinity Upgrade圧縮 | Infinity Upgrade の効果が ^0.1 される。 | Infinity Upgrade 効果が ^3 される。 |
| IC6 粘性軌道 | ラップスピードボーナスが平方根化される。 | ラップスピードボーナスが少し強くなる。 |
| IC7 多角崩壊 | 頂点が多いほどスコア獲得量が割られる。 | 頂点数に応じて頂点通過ごとの増加が伸びる。 |
| IC8 無限圧縮 | 最終スコア獲得量が ^0.45 される。 | クリア済み IC に応じて IP 獲得量が増える。 |

## 16. Break Infinite Cap

所持スコアが以下に到達すると、Break Infinite Cap を実行できる。

```text
所持スコア >= 1.00e333
```

Break Infinite Cap 実行後は、1.80e308 以降の強力なソフトキャップが破壊される。

## 17. Infinite Angle

Infinite Angle（IA）は Infinity 版の新しい図形である。

IP を消費して Infinite Score を獲得できる。

Infinite Score の量に応じて、The Angle の「頂点通過ごとのスコア獲得量増加」が強化される。

Infinity を実行すると Infinite Score は0になるが、Infinity Upgrade によって得た IA 効率などの強化はリセットされない。

## 18. 推奨データ構造

```text
score
scoreLog10
totalScore
generationScore

angleVertexCount
lapSpeedLevel
scoreGainIncreaseLevel

baseScoreGain
currentScoreGain
scoreGainIncreasePerVertex
lapSpeedMultiplier

generationCount
generationScoreMultiplier
generationCostReductionMultiplier

coreBoostCount
coreBoostRequirement
coreBoostGainIncreaseMultiplier
coreBoostGainExponent

infinityCount
infinityPoints
infinityUpgradeLevels
activeInfinityChallenge
completedInfinityChallenges
infiniteCapBroken
infiniteScore
achievementMask
```

## 19. 実績

実績はいかなるゲーム内リセットの影響も受けない恒久要素である。

実績を1つ達成するたびに、頂点通過ごとのスコア獲得量増加に以下の倍率がかかる。

```text
実績増加倍率 = 1.01 ^ 達成済み実績数
```

実績によっては、共通報酬に加えて追加報酬を得る。

| No. | 実績名 | 条件 | 追加報酬 |
| --- | --- | --- | --- |
| 1 | 頂点すなわち角度 | 角の数を増やす | なし |
| 2 | 世代を超えて | Generation を実行する | なし |
| 3 | e(この実績の番号)分のブースト | GR由来の単純なスコア獲得量の乗算値が 1000 を超える | GR の単純なスコア獲得量の乗算の効果が 2 倍 |
| 4 | 角と核はダブルミーニングでもあり | Core Boost 1 に到達 | なし |
| 5 | 目視できない | ラップスピードが 10 を超える | なし |
| 6 | contagon | 頂点の数が 30 を超える | なし |
| 7 | 再びe(この実績の番号)分のブースト | GR由来の単純なスコア獲得量の乗算値が 10,000,000 を超える | なし |
| 8 | スケーリングは始まっている | 所持スコアが e30 を超える | なし |

## 20. ゲームループ

```text
1. Point が The Angle の外周を移動する
2. Point が頂点を通過する
3. スコア獲得量が増加する
4. Point が核に到達する
5. スコアを獲得する
6. プレイヤーがスコアを消費して強化する
7. 累計スコアが 1,000,000 を超える
8. Generation が解放される
9. Generation を実行してブーストを得る
10. 強化された状態で再スタートする
11. 所持スコアが 1.00e20 に到達する
12. Core Boost を実行して、Generation 以下をリセットしつつ恒久ブーストを得る
13. 所持スコアが 1.80e308 に到達する
14. 初回 Infinity が強制実行され、IP を獲得する
15. IP で Infinity Upgrade または Infinite Angle を強化する
16. Infinity Challenge を攻略して追加ブーストを得る
17. 1.00e333 に到達して Break Infinite Cap を実行する
18. 条件を満たした実績が恒久的に解放される
```

## 21. 最小実装範囲

最初の実装では、以下の範囲を満たせば中核ループが成立する。

```text
・三角形の The Angle を表示
・Point が外周を周回
・核到達時にスコア獲得
・頂点通過時にスコア獲得量増加
・ラップスピード強化
・角の追加
・スコア獲得量増加強化
・累計スコア 1,000,000 で Generation 解放
・Generation 実行でリセットと倍率付与
・所持スコア 1.00e20 で Core Boost 解放
・Core Boost 実行で Generation 以下をリセットし、獲得量増加倍率と獲得量指数を付与
・所持スコア 1.80e308 で Infinity 解放
・Infinity 実行で IP を獲得し、Infinity 未満をリセット
・IP による Infinity Upgrade と Infinite Angle 変換
・Infinity Challenge の開始、クリア、報酬
・所持スコア 1.00e333 で Break Infinite Cap
・実績の達成、保存、恒久報酬
```

## 22. 未確定・調整項目

| 項目 | 内容 |
| --- | --- |
| 初期周回時間 | Point が1周する秒数。 |
| 初期スコア獲得量 | 核到達時の最初の獲得量。 |
| 強化コスト式 | 各強化の価格上昇カーブ。 |
| 頂点数の上限 | 無限にするか、一定数で制限するか。 |
| 乗算表記の開始条件 | 何頂点から表示を変えるか。 |
| Generation 倍率式 | 世代スコアから倍率をどう算出するか。 |
| Generation 実行条件 | 1,000,000 到達後いつでも実行可能にするか。 |
| Core Boost 効果式 | CB数から増加倍率・指数をどう伸ばすか。 |
| Infinity Point 式 | 到達スコアから IP をどう算出するか。 |
| Infinity Upgrade | 強化種類、コスト、上限。 |
| Infinity Challenge | IC の数、縛り、報酬、挑戦条件。 |
| Break Infinite Cap | IC クリアを必須条件にするか。 |
| Infinite Angle | 図形として独立描画するか、数値強化から始めるか。 |
| 実績追加報酬 | 既存8種以降の個別報酬をどう拡張するか。 |
| 複数 Point の有無 | 後半要素として追加するか。 |
