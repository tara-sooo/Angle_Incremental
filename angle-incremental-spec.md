# Angle Incremental 開発仕様書

対象リリース: **0.6.1**

この文書は、現行公開版のゲーム仕様と実装基準をまとめる。プレイヤー向けの遊び方は [angle-incremental-guide.md](angle-incremental-guide.md) を参照する。

実装・UI・テスト・バランスに変更を加える場合は、この仕様書または初心者向けガイドも同時に更新する。

## 1. ゲーム概要

**Angle Incremental** は、画面中央の正多角形 **The Angle** を強化し、Point の周回でスコアを増やすブラウザ向けインクリメンタルゲームである。

進行は次の順に広がる。

1. 通常強化でスコア獲得を伸ばす。
2. Generation で通常進行をリセットし、恒久補正を得る。
3. Core Boost で Generation 以下をリセットし、より強い恒久補正を得る。
4. Infinity で下位進行をリセットし、Infinity Point と Infinity Upgrade を解放する。
5. Infinity Challenge、Infinite Angle、Break Infinite Cap でInfinity後半を進める。

## 2. 用語

| 用語 | 説明 |
| --- | --- |
| The Angle | 画面中央の正多角形。初期状態は三角形。 |
| Point | The Angle の外周を周回する点。 |
| 核 | The Angle の最上部の頂点。Point が到達するとスコアを得る。 |
| スコア | 通常強化と進行条件に使う基本リソース。 |
| 頂点通過ごとの増加 | Point が頂点を通るたびに増える、次回以降の核到達スコアの元。 |
| Generation / GR | 累計スコア 1,000,000 で解放される第1リセット層。 |
| Core Boost / CB | 所持スコア 1.00e20 で実行できる第2リセット層。 |
| Infinity | 所持スコア 1.80e308 で実行できる第3リセット層。 |
| Infinity Point / IP | Infinity Upgrade購入とInfinite Angle変換に使うリソース。 |
| Infinity Upgrade / IU | IPで購入する恒久強化。 |
| Infinity Challenge / IC | 制約付きでInfinity到達を目指すチャレンジ。 |
| Infinite Score / IA | IP変換で得るInfinity内リソース。頂点通過ごとの増加を強化する。 |
| Break Infinite Cap | Infinity後の強いスコアソフトキャップを恒久的に解除する要素。 |

## 3. 基本ループ

1. Point が The Angle の外周を周回する。
2. Point が頂点を通過するたび、現在のスコア獲得量が増える。
3. Point が核に到達すると、現在のスコア獲得量に応じたスコアを得る。
4. スコアで通常強化を購入する。
5. 解放済みのリセット層を使って、下位進行をリセットする代わりに恒久補正を得る。

### 3.1 初期状態

| 項目 | 初期値 |
| --- | --- |
| スコア | 0 |
| 累計スコア | 0 |
| The Angle | 三角形 |
| 頂点数 | 3 |
| 現在の獲得量 | 1 |
| 頂点通過ごとの増加 | +0.01 |
| Generation | 0 |
| Core Boost | 0 |
| Infinity | 0 |
| IP | 0 |

### 3.2 The Angle の獲得式

頂点数が増えると、基礎獲得量は分割式になる。

```text
parts = min(floor(sqrt(実効頂点数)), 10)
divisor = parts
基礎獲得log10 = (baseLog10 - log10(divisor)) * parts
```

`parts <= 1` の場合は分割式を適用しない。IC1中、またはIC1クリア報酬の有無により、式の表示と除数が変わる。GR、CB、実績、IU、IAなどの補正は、この基礎獲得式の後に適用する。

### 3.3 log値管理

スコア、累計スコア、Generation中スコア、現在獲得量、IP、Infinite Score は通常数値と `log10` 値を併用して管理する。JavaScript の通常数値上限を超える場合は `log10` 値を進行の正本として扱う。

## 4. 通常強化

| 強化 | 初期効果 | 主な目的 |
| --- | --- | --- |
| 周回速度 | Pointの周回を速くする。 | 頂点通過と核到達を増やす。 |
| 角の追加 | 頂点数を1増やす。 | 式を強化し、頂点通過機会も増やす。 |
| 頂点獲得量 | 頂点通過ごとの増加を上げる。 | 核到達時の獲得量を伸ばす。 |

通常強化コストは `costLog10(kind, base, level, growth)` で管理する。低い値では通常数値で丸め、高い値ではlog値で扱う。

### 4.1 コストスケーリング

初期追加スケーリングは次の値を基準にする。

```text
周回速度: Lv10超過分から 追加log10コスト += 超過Lv^2 * 0.00140
角追加: Lv8超過分から 追加log10コスト += 超過Lv^2 * 0.00560
頂点獲得量: Lv6超過分から 追加log10コスト += 超過Lv^2 * 0.00260
```

GenerationとCore Boostの進行は、この初期追加スケーリングを緩和する。高コスト帯ではさらに段階スケーリングを適用する。

```text
コストlog10 > 30:
  追加log10コスト += (コストlog10 - 30)^2 * 0.020

コストlog10 > 100:
  追加log10コスト += (コストlog10 - 100)^2 * 0.006
```

IU 7-2購入後は、Infinity回数に応じて通常強化コストに指数軽減を適用する。

### 4.2 周回速度ソフトキャップ

生ラップスピードは伸び続ける。実効ラップスピードには、Generation前後のソフトキャップと、log10速度22以降の強いソフトキャップを適用する。表示では生速度と実効速度の差を示す場合がある。

## 5. Generation

### 5.1 解放条件

```text
累計スコア >= 1,000,000
```

### 5.2 リセット内容

Generation 実行時、現在スコア、Generation中スコア、通常強化、現在獲得量、頂点進行をリセットする。Generation回数、前回Generationスコア、GR由来の倍率とコスト補正は保持する。

IC8中に購入した角追加アップグレードは角を追加せず、IC8中専用の補正レベルとして扱う。この補正レベルはGenerationでリセットする。

### 5.3 報酬

Generation報酬は、そのGeneration中に得たスコアから決まる。

```text
世代深度 = max(0, generationScoreLog10 - log10(1,000,000))
浅いGRスコア補正 = 0.60 * (1 - exp(-世代深度 / 4))
浅いGRコスト補正 = 0.13 * (1 - exp(-世代深度 / 5))
スコア倍率log10 = min(8, log10(1 + 世代深度) * 0.20 + 浅いGRスコア補正)
コスト軽減率 = min(0.24, log10(1 + 世代深度) * 0.040 + 浅いGRコスト補正)
```

IC8クリア後は、GRスコア倍率の式が次のように変わる。コスト軽減率は通常時と同じ式を使う。

```text
スコア倍率log10 = generationScoreLog10 * 0.014 + 浅いGRスコア補正
IP倍率 = max(1, スコア倍率 / 1e21)
```

再Generationは、今回のGeneration中スコアが前回Generation実行時のスコアを超える場合のみ実行できる。

## 6. Core Boost

### 6.1 実行条件

```text
所持スコア >= 1.00e20
```

次回要求量はCore Boost回数に応じてlog空間で増える。

### 6.2 リセット内容

Core Boost はGeneration以下の進行をリセットする。Core Boost回数とCore Boost由来の補正は保持する。IC8中専用の角追加購入レベルはCore Boostでリセットする。

### 6.3 報酬

Core Boostは主に2種類の補正を与える。

```text
頂点通過ごとの増加倍率 = 1 + Core Boost回数 * 0.5
スコア獲得量指数 = 1 + Core Boost回数 * 0.02
```

IU 7-1購入後、頂点通過ごとの増加倍率は次の式になる。

```text
頂点通過ごとの増加倍率 = 1 + Core Boost回数 * 1.0
```

IC5報酬はCore Boostの獲得指数に `+0.01` を加える。

IU 12-1購入後、Core Boost由来の補正は加算ではなく乗算で増える。

```text
頂点通過ごとの増加倍率 = (1 + CBごとの増加分) ^ Core Boost回数
スコア獲得量指数 = 1.02 ^ Core Boost回数
```

IC5報酬の `+0.01` は、IU 12-1の乗算後のスコア獲得量指数に加算する。

IC8中、Core Boost必要スコアは通常の必要スコアを2乗した値になる。log10表記では次のように扱う。

```text
IC8中のCB必要スコアlog10 = 通常CB必要スコアlog10 * 2
```

IC8中の角追加アップグレードは角を追加しないかわりに、頂点通過ごとの増加とスコア獲得量指数を上げる。

```text
IC8中の角追加購入回数 = IC8中専用の角追加購入レベル
頂点通過ごとの増加倍率補正 = 1.13 ^ IC8中の角追加購入回数
スコア獲得量指数補正 = +0.0055 * IC8中の角追加購入回数
```

## 7. Infinity

### 7.1 実行条件

```text
所持スコア >= 1.80e308
```

初回Infinityは条件達成時に自動実行する。2回目以降は、条件を満たした状態で手動または自動化により実行する。

### 7.2 リセット内容

Infinity実行時、Infinity未満の進行をリセットする。

| 項目 | リセット後 |
| --- | --- |
| スコア | 0。ただしIU 5-2購入後は100から開始。 |
| 通常強化 | 初期化 |
| Generation | 初期化 |
| Core Boost | 初期化。ただしIU 10-1購入後は最低2から開始。 |
| Infinite Score | 0 |
| Infinity run time | 0 |

Infinity回数、IP、IU、ICクリア状況、Break Infinite Cap、実績、設定、統計履歴は保持する。

### 7.3 スコアソフトキャップ

Break Infinite Cap前は、Infinity条件を超えたスコアに強いソフトキャップを適用する。

```text
softcappedLog10 = 308.255... + (rawLog10 - 308.255...) * 0.08
```

Break Infinite Cap後は、このInfinity後スコアソフトキャップを適用しない。

### 7.4 IP獲得

Infinity実行時、条件を満たしていればIPを得る。

Break Infinite Cap前の基本式:

```text
通常: IP = max(1, floor(log10(score) - 307))
IU 9-1購入後: IP = max(1, floor(log7(score) - 307))
```

Break Infinite Cap後:

```text
IP = max(1, floor(log2(score) - 307))
```

実績17と実績21は、それぞれIP獲得量を2倍にする。IC6報酬はInfinity回数の増加量を2倍にする。

## 8. Infinity Upgrade

IUはIPで購入する恒久強化である。各IUは前提IUをすべて購入してから取得でき、Infinityリセットでは失われない。

| IU | 必要IP | 前提 | 効果 |
| --- | ---: | --- | --- |
| 1-1 リセットは負ではない | 1 | なし | 頂点通過ごとの増加が `Infinity回数 + 1` 倍される。 |
| 1-2 はじめてのQoL | 1 | なし | 通常強化の自動購入を解放する。 |
| 2-1 最速タイム | 1 | 1-1, 1-2 | ラップスピードが `x1.5` される。 |
| 3-1 スコア革命 | 3 | 2-1 | GRスコア倍率が `^1.5` される。 |
| 3-2 コスト革命 | 3 | 2-1 | GRコスト倍率が `x0.95` される。 |
| 4-1 縛り縛られ | 5 | 3-1, 3-2 | Infinity Challengeを解放する。 |
| 5-1 スタートダッシュ | 10 | 4-1 | ラップスピードが `x3` される。 |
| 5-2 親が地主 | 10 | 4-1 | リセット後、スコア100で開始する。 |
| 6-1 ほんのりした甘味 | 50 | 5-1, 5-2 | GRスコア倍率がさらに `^1.2` される。 |
| 6-2 澄んだ視界 | 50 | 5-1, 5-2 | GRコスト倍率の下限が `x0.70` になる。 |
| 7-1 権力の集中 | 150 | 6-1, 6-2 | CBごとの増加倍率が `+1.0` になる。 |
| 7-2 庶民の幸せ | 150 | 6-1, 6-2 | Infinity回数に応じて通常強化コストを下げる。 |
| 8-1 無限に無限周回 | 200 | 7-1, 7-2 | Infinityの自動化を解放する。 |
| 9-1 法律改正 | 200 | 8-1 | Break前のIP獲得式を `log7(score)-307` にする。 |
| 10-1 親が政治家 | 12000 | 9-1 | リセット後、最低2 Core Boostから開始する。 |
| 10-2 面白くないアップグレードだと思ったでしょうね | 28000 | 9-1 | 所持スコアが `^1.2` される。 |
| 11-1 スポンサーが付く | 200000 | 10-1, 10-2 | 所持IP2000ごとに通常強化3種の効果用レベルを追加する。100000 IP以降は効果なし。 |
| 11-2 分かりづらいよ | 400000 | 10-1, 10-2 | IU 1-1の倍率を `1.005^Infinity回数` にする。Infinity 10000以降は効果なし。 |
| 12-1 ゴールデンヘル | 6660000 | 11-1, 11-2 | CBの効果は加算ではなく `x(1+増加分)` で計算されるようになる。 |

## 9. Infinity Challenge

ICはIU 4-1購入後に解放される。IC中にInfinity条件を満たしてInfinityを実行すると、そのICをクリアする。

| IC | 制約 | 報酬 |
| --- | --- | --- |
| IC1 改悪された計算式 | 基礎獲得式の除数が10倍になる。 | 除数を撤廃する。 |
| IC2 現実的に書ける範囲で | 頂点数は200を超えない。 | 通常強化コストが `^0.95` される。 |
| IC3 ナメクジよりは早い | ラップスピードが `^0.8` され、周回速度強化のコスト増加が2倍になる。 | ラップスピード `x1.1`。 |
| IC4 うん、それ以上もそれ以下もないよ | 頂点獲得量が `^0.5` される。 | 頂点獲得量が `^1.1` される。 |
| IC5 環境配慮 | Core Boostを実行できない。 | Core Boostの獲得指数 `+0.01`。 |
| IC6 下剋上された | 頂点通過ごとの増加は0.001で固定される。 | Infinity回数獲得量 `x2`。 |
| IC7 倹約家もどき | スコアが1e30を超えると、通常強化を購入できない。 | 通常強化購入時にスコアを消費しない。ただし購入価格以上のスコアは必要。 |
| IC8 反出生主義 | 頂点数は3で固定され、CB必要スコアは `^2` される。角追加アップグレードは角を追加せず、頂点通過ごとの増加とスコア獲得量指数を上げる。 | GRスコア倍率式が変化し、GRスコア倍率/1e21がIP獲得倍率にも適用される。 |

IC自動完了がオンの場合、条件を満たしたアクティブICは自動でInfinity実行される。

## 10. Break Infinite Cap

### 10.1 実行条件

```text
所持スコア >= 1.00e350
```

Break Infinite Capは恒久状態であり、Infinityを含む通常のリセットでは失われない。IC全クリアは実行条件ではない。

### 10.2 効果

Break Infinite Cap後は、`1.80e308` 以降の強いスコアソフトキャップを無効化する。Infinity到達条件は引き続き `1.80e308` である。IP獲得式は `log2(score)-307` 系へ変わる。

## 11. Infinite Angle

Infinite AngleはIPをInfinite Scoreへ変換するInfinity内進行である。

| 項目 | 値 |
| --- | --- |
| 変換コスト | `1.00e20 IP` |
| 変換量 | `+10 Infinite Score` |
| 効果 | Infinite Scoreに応じて頂点通過ごとの増加を強化する。 |
| リセット | Infinity実行時に0へ戻る。 |

Infinite Scoreの効果は `1 + log10(1 + Infinite Score) * 0.25` を基準にする。

## 12. 実績

実績は30個あり、すべてのリセットを超えて保持される。

```text
実績倍率 = 1.01 ^ 達成済み実績数
```

実績には追加報酬を持つものがある。追加報酬は主にGR倍率、IP獲得、自動化、GRコストに作用する。

| # | 条件 | 追加報酬 |
| ---: | --- | --- |
| 1 | 角の数を増やす | なし |
| 2 | Generationを実行する | なし |
| 3 | GR由来の実効スコア倍率が1000を超える | GR倍率の増加分を2倍 |
| 4 | Core Boost 1に到達 | なし |
| 5 | ラップスピードが100を超える | なし |
| 6 | 頂点数が30を超える | なし |
| 7 | 所持スコアがe30を超える | なし |
| 8 | Core Boost 3に到達 | なし |
| 9 | Infinityに到達 | なし |
| 10 | Infinity Upgradeを購入 | なし |
| 11 | 累計5時間プレイ | なし |
| 12 | GenerationなしでCore Boost 1に到達 | なし |
| 13 | IU 4-1を購入 | なし |
| 14 | ICを1つクリア | なし |
| 15 | Infinityに10回到達 | なし |
| 16 | IC4をクリア | なし |
| 17 | IC3をクリア | IP獲得量 `x2` |
| 18 | e314スコアに到達 | なし |
| 19 | 最速Infinity時間が2分未満 | GRとCBの自動化を解放 |
| 20 | 100 IPを所持 | GRコスト倍率をさらに `x0.98` |
| 21 | IC5をクリア | IP獲得量をさらに `x2` |
| 22 | GR/CBなしでInfinityに到達 | なし |
| 23 | IU 7-1と7-2を購入 | なし |
| 24 | IU 9-1を購入 | なし |
| 25 | Break Infinite Capを実行 | なし |
| 26 | 100000 IPを所持 | なし |
| 27 | Infinity量が5000を超える | なし |
| 28 | IC7をクリア | なし |
| 29 | スコアが1e628を超える | なし |
| 30 | ICを8つクリア | なし |

## 13. 自動化と統計

### 自動化

| 解放条件 | 自動化 |
| --- | --- |
| IU 1-2 | 通常強化の自動購入。全体オン/オフと3種個別オン/オフを持つ。 |
| IU 4-1 | IC自動完了。 |
| 実績19 | Generation自動実行とCore Boost自動実行。 |
| IU 8-1 | Infinity自動実行。 |

通常強化の自動購入は0.1秒ごとに実行される。Generation自動実行は、スコア倍率増加、コスト倍率改善、最小経過秒数のしきい値を持つ。Infinity自動実行はIP獲得量しきい値を持つ。

### 統計

統計タブでは総プレイ時間、現在のInfinity周回時間、最速Infinity時間、過去10回のInfinity履歴を表示する。Infinity履歴には時間、到達スコア、獲得IP、挑戦中ICを記録する。

## 14. UI、ニュース、設定

メインタブは The Angle、Infinity、Automation、Statistics、Achievements、Help、Settings で構成する。Infinityタブ内には Upgrades、Challenges、Infinite Angle のサブタブがある。

上部バーは設定で次の表示を選べる。

| モード | 内容 |
| --- | --- |
| ニュース | ゲーム内ニュースをスクロール表示する。 |
| 資源量 | Score、IP、IAを表示する。 |
| 進捗状況 | GR、CB、Infinity、実績などの進捗を表示する。 |
| ブランク | 枠だけを表示する。 |
| 隠す | 上部バーを非表示にする。 |

ニュースは自動スクロールするが、スクリーンリーダー向けのライブリージョンにはしない。ニュース本文の切り替えはスクロール完了タイミングに同期する。

設定では、言語、数値表記、時間単位、軽量表示、浮遊テキスト、FPS表示、上部バー表示を保存する。

## 15. セーブと更新

セーブはローカルストレージへ自動保存し、手動保存とリセットも提供する。セーブコードは `ANGLE_SAVE_V2:` で始まり、AES-GCMを使って書き出し・読み込みする。

主要な保存項目には、各リソースとlog10値、Generation、Core Boost、Infinity、IP正確値、IUマスク、IC状態、Break Infinite Cap、Infinite Score、実績、自動化、統計、表示設定が含まれる。

IPは大きい整数を正確に扱うため `infinityPointsExact` を正本にし、表示用に通常数値とlog10値を同期する。

壊れたセーブや復元できないセーブは、可能な限り隔離キーへ退避して新規状態で起動する。

## 16. バージョン管理

公開バージョンは Semantic Versioning 形式を使う。

```text
major.minor.patch
```

- `APP_VERSION`: 公開アプリのバージョン。`version.json` の `appVersion` と一致させる。
- `SAVE_VERSION`: セーブデータの移行が必要な場合に上げる保存形式バージョン。

0.6.1時点では、`APP_VERSION = 0.6.1`、`SAVE_VERSION = 10` である。ドキュメントのみの変更では、原則としてどちらも変更しない。

ブラウザのキャッシュ対策として、CSS/JSのURLにはアプリバージョンのクエリを付ける。起動中クライアントは `version.json` を定期確認し、新しい `appVersion` を検出したら保存してリロードを促す。

## 17. 主要データ構造

主要な保存フィールドは `src/core/state.js` の `SAVE_FIELDS` を正本とする。代表的な項目は次の通り。

```text
score / scoreLog10
totalScore / totalScoreLog10
generationScore / generationScoreLog10
vertices
speedLevel
gainLevel
currentGain / currentGainLog10
generationCount
generationScoreMultiplier / generationScoreMultiplierLog10
generationCostFactor
coreBoostCount
infinityCount
infinityPoints / infinityPointsLog10 / infinityPointsExact
infiniteScore / infiniteScoreLog10
infinityUpgradeMask
activeChallenge
completedChallenges
infiniteCapBroken
achievementMask
totalPlayTime
currentInfinityRunTime
fastestInfinityTime
lastInfinityRuns
automation settings
display settings
```

## 18. 今後の拡張候補

- IUの新しい段と分岐
- 新しいInfinity Challenge
- Infinite Angleの独立した図形表示
- 後半の複数Point
- 実績の個別追加報酬
- 後半バランス調整
