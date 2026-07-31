# Angle Incremental 開発仕様書

対象状態: **開発中（次期リリース未定）**

この文書は、現行公開版のゲーム仕様と実装基準をまとめる。プレイヤー向けの遊び方は [angle-incremental-guide.md](angle-incremental-guide.md) を参照する。

実装・UI・テスト・バランスに変更を加える場合は、この仕様書または初心者向けガイドも同時に更新する。

## 1. ゲーム概要

**Angle Incremental** は、画面中央の正多角形 **The Angle** を強化し、Point の周回でスコアを増やすブラウザ向けインクリメンタルゲームである。

進行は次の順に広がる。

1. 通常強化でスコア獲得を伸ばす。
2. Generation で通常進行をリセットし、恒久補正を得る。
3. Core Boost で Generation 以下をリセットし、より強い恒久補正を得る。
4. Infinity で下位進行をリセットし、Infinity Point と Infinity Upgrade を解放する。
5. Infinity Challenge、Infinity Angle、Tower、Break Infinite Cap でInfinity後半を進める。
6. オフライン進行と Time Flux で、離席中の進行とオンライン中の速度を管理する。

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
| Infinity Point / IP | Infinity Upgrade購入とInfinity Angleの解放・通常強化購入に使うリソース。 |
| Infinity Upgrade / IU | IPで購入する恒久強化。 |
| Infinity Challenge / IC | 制約付きでInfinity到達を目指すチャレンジ。 |
| Tower Challenge / TC | Towerの次階建設を制限するチャレンジ。TC1・TC2を実装済み、TC3・TC4は未実装。 |
| Infinity Angle / IA | e20 IPで解放する、Infinity内の独立した図形進行。 |
| Infinity Score | IAの核到達で得るInfinity内スコア。^0.3後に通常の頂点獲得量へ乗算する。 |
| Tower | IPで建設し、階数に応じてスコア累乗を強化するInfinity後の恒久要素。 |
| Break Infinite Cap | Infinity後の強いスコアソフトキャップを恒久的に解除する要素。 |
| オフライン進行 | 保存時刻との差分を、復帰時に複数の粗いティックとして処理する仕組み。 |
| Time Flux / TF | オフライン進行を無効にしたときに蓄積され、オンライン中のゲーム速度に使う時間資源。 |

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
| Infinity Angle | 未解放 |
| Infinity Score | 0 |

### 3.2 The Angle の獲得式

頂点数が増えると、基礎獲得量は分割式になる。

```text
parts = min(floor(sqrt(実効頂点数)), 10)
divisor = parts
基礎獲得log10 = (baseLog10 - log10(divisor)) * parts
```

`parts <= 1` の場合は分割式を適用しない。IC1中、またはIC1クリア報酬の有無により、式の表示と除数が変わる。GR、CB、実績、IU、IAなどの補正は、この基礎獲得式の後に適用する。IA側はIC、GR、CB、実績、IUの補正を持たず、IA専用の頂点数と現在獲得量だけで同じ基礎式を計算する。

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
IP倍率 = max(1, スコア倍率 / 1e20)
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
| Infinity Angle | 解放状態とIA通常強化レベルを保持 |
| Infinity Score | 0 |
| Infinity run time | ゲーム時間・実時間ともに0 |

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
| 13-1 久々にここを見たなら | `1e51` | 12-1 | Infinity Scoreは`^0.5`されてから頂点獲得量に倍率を与える。 |

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
| IC8 反出生主義 | 頂点数は3で固定され、CB必要スコアは `^2` される。角追加アップグレードは角を追加せず、頂点通過ごとの増加とスコア獲得量指数を上げる。 | GRスコア倍率式が変化し、GRスコア倍率/1e20がIP獲得倍率にも適用される。 |

IC自動完了がオンの場合、条件を満たしたアクティブICは自動でInfinity実行される。

## 10. Break Infinite Cap

### 10.1 実行条件

```text
所持スコア >= 1.00e350
```

Break Infinite Capは恒久状態であり、Infinityを含む通常のリセットでは失われない。IC全クリアは実行条件ではない。

### 10.2 効果

Break Infinite Cap後は、`1.80e308` 以降の強いスコアソフトキャップを無効化する。Infinity到達条件は引き続き `1.80e308` である。IP獲得式は `log2(score)-307` 系へ変わる。

## 11. Infinity Angle

Infinity Angle (IA) は、Infinityタブ内で動き続ける独立した図形である。解放後はIAサブタブを開いていなくても進行し、IAサブタブを開いた時だけ専用キャンバスを描画する。

### 11.1 解放とリセット

| 項目 | 値 |
| --- | --- |
| 解放コスト | `1.00e20 IP` の一回払い |
| 解放後 | Infinity Angleが常時進行する |
| Infinity Score | IAの核到達で増加し、Infinity実行時に0へ戻る |
| IA通常強化 | Infinity実行後も保持する |
| IA用GR/CB | 存在しない |

Infinity実行時は、IAの現在獲得量、Point位置、頂点進行も初期化する。解放状態とIA通常強化レベルは保持する。旧版のInfinite Scoreが保存されている場合は、IA解放済みのInfinity Scoreとして読み込む。

### 11.2 IAの基本ループ

IAのPointはIA専用の頂点上を周回する。通常のThe Angleと同じく、頂点通過ごとに現在獲得量が増え、核到達時にスコアを得る。ただし、スコア計算にはIA専用の通常強化だけを使う。

```text
IA頂点数 = 3 + IA角追加レベル
IA頂点通過ごとの増加 = 0.011 * (IA頂点獲得量レベル + 1)
IA生ラップ速度log10 = IA周回速度レベル * log10(1.22)
IA有効ラップ速度 = The AngleのGeneration前ソフトキャップと強いソフトキャップを適用した速度
```

核到達時のIAスコア獲得量は、The Angleと同じ `(x / y)^y` 型の基礎式を使う。ただし、IA頂点数から求めた式の部品数とIA現在獲得量以外の補正は適用しない。

```text
parts = min(floor(sqrt(IA頂点数)), 10)
IAスコア獲得log10 = IA現在獲得log10                         (parts <= 1)
IAスコア獲得log10 = (IA現在獲得log10 - log10(parts)) * parts (parts > 1)
```

Infinity Scoreはlog空間で加算する。通常の頂点獲得量に適用するIA倍率は次の通りで、Score 0では倍率1になる。

```text
IA倍率 = max(1, Infinity Score ^ 0.3)
```

### 11.3 IA通常強化

IA通常強化はIPで購入し、IA側のレベルだけで独立に計算する。IAの初回価格は解放コストと同じIP帯へ移し、高レベルでもIA Scoreによる加速が機能するよう専用の緩やかなコスト曲線を使う。

| 強化 | 基礎コスト | 成長率 | 効果 |
| --- | ---: | ---: | --- |
| 周回速度 | `1.00e20 IP` | `x1.40` | IAの周回速度レベル +1 |
| 角の追加 | `2.40e20 IP` | `x1.50` | IAの頂点数 +1 |
| 頂点獲得量 | `3.60e20 IP` | `x1.45` | IAの頂点通過ごとの増加レベル +1 |

IAのコストは、基礎コストと名目成長率に成長係数`0.11`を適用し、レベル25を超えた分にだけ次の追加スケーリングを適用する。The Angle側のGeneration、Core Boost、Infinity Challenge、Infinity Upgradeによるコスト補正や段階スケーリングは適用しない。IAタブには、通常の購入順（周回速度→角の追加→頂点獲得量）で購入可能な分をまとめて買う全購入ボタンも置く。

```text
IAコストlog10 = log10(基礎コスト) + IAレベル * log10(名目成長率) * 0.11 + 追加コストlog10
追加コストlog10 = max(0, IAレベル - 25)^2 * IAごとの補正値 * 0.35
周回速度の補正値 = 0.0005
角の追加の補正値 = 0.0010
頂点獲得量の補正値 = 0.0005
```

## 12. Tower

TowerはIPを消費して建設する、Infinityでリセットされない恒久要素である。階数に応じてスコア累乗が強化される。

### 12.1 階数と建設コスト

| 階数 | 必要IPのlog10 | 効果・解放 |
| ---: | ---: | --- |
| 1 | 50 | スコア累乗を解放。Tower累乗は階数ごとに `+^0.05`。 |
| 2 | 60 | なし。 |
| 3 | 70 | TC1を解放し、次の階数からTC1クリアが必要。 |
| 4 | 85 | TC1クリア後に建設可能。 |
| 5 | 100 | TC2を解放し、次の階数からTC2クリアが必要。 |
| 6 | 125 | TC2クリア後に建設可能。 |
| 7 | 150 | なし。 |
| 8 | 175 | TC3を解放し、次の階数からTC3クリアが必要。 |
| 9 | 205 | TC3クリア後に建設可能。 |
| 10 | 235 | なし。 |
| 11 | 265 | なし。 |
| 12 | 295 | TC4を解放し、次の階数からTC4クリアが必要。 |
| 13 | 345 | これより後は階数ごとに必要IPのlog10を `^1.15` 相当で増加。 |

Towerのスコア累乗は次の式で計算する。

```text
Towerスコア累乗 = 1 + Tower階数 * 0.05
実効スコアlog10 = 生スコアlog10 * The Angle側のスコア累乗 * Towerスコア累乗
```

Towerの通常スコア累乗とTC1報酬のInfinity Score累乗は別系統である。TC1をクリアすると、Infinity Scoreの有効累乗は次の式になる。

```text
TC1追加指数 = max(0, Tower階数 - 3) * 0.077
Infinity Score累乗 = (IU13-1未購入なら0.3、購入済みなら0.5) + TC1追加指数
```

このInfinity Score累乗は、IAのInfinity Scoreが通常の頂点獲得量へ与える倍率にだけ適用し、Towerスコア累乗には加算しない。

Floor 13より後の必要IPは、必要IPのlog10を `345 * 1.15^(階数 - 13)` として扱う。必要IPが正確なIP上限を超える場合は建設できない。

### 12.2 Tower Challengeの現行状態

TC1〜TC4はそれぞれFloor 3、5、8、12で解放される。TC1/TC2をクリアするまで対応する次の階数を建設できない。TCはInfinity Challengeと併用でき、開始・中止時にInfinity以下をリセットする。クリア済みのTCも再挑戦でき、恒久報酬は初回クリア時のみ解放される。TC1・TC2の報酬はクリア後、通常プレイと後続TC内で有効になる。

| TC | 制約 | 目標 | 報酬 |
| --- | --- | --- | --- |
| TC1 親友より知り合い | TAの通常強化は購入できず、IU11-1の効果上限は`/5`される。 | `1e308 Score` | 「Infinity Score累乗」を解放。Floor 3以降の追加階層ごとに指数へ`+0.077`する。到達時はTC専用リセットを行い、IP/Infinity回数は増えない。再挑戦時も同じリセットを行う。 |
| TC2 核家族世帯撲滅委員会 | CBは封印され、GRスコア倍率は`^0.1`、GRコスト倍率は`x0.90`を下限とする。 | `1e1555 Score` | 「Core Boost強化」を解放。Floor 5以降、CB要求量の生指数を1階層ごとに`-0.03`し、`1.50`未満では強いソフトキャップを適用する。初回・再挑戦とも通常Infinity報酬を付与する。 |
| TC3 | 未定 | 未定 | 未定 |
| TC4 | 未定 | 未定 | 未定 |

TC2のCore Boost要求量増加指数は、TC2未クリア時またはFloor 5では`2.00`である。TC2クリア後の生指数は次の式で計算する。

```text
CB要求量生指数 = 2 - max(0, Tower階数 - 5) * 0.03
```

生指数が`1.50`以上なら実効指数も同じ値とする。`1.50`未満では、`d = 1.50 - 生指数`として次のソフトキャップを適用する。

```text
CB要求量実効指数 = 1.50 - 0.10 * d / (1 + d)
CB要求量log10 = log10(1.00e20) * (CB要求量実効指数 ^ Core Boost回数)
```

この式は`1.50`で連続し、Floor 22の生指数`1.49`を約`1.499`へ緩和する。Floor 22以降も実効指数は変化し続け、長期的には`1.40`へ漸近する。`1.50`で固定するハードキャップではない。

## 13. 実績

実績は31個あり、すべてのリセットを超えて保持される。

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
| 31 | IAを解放 | IP獲得量 `x100` |

## 14. 自動化と統計

### オフライン進行

ゲームはサーバー時刻を取得でき、保存データにも `serverSavedAt` がある場合、両者の差を離席時間として扱い、固定の7日上限を設けず全量を処理する。サーバー時刻を取得できない場合や、旧セーブに `serverSavedAt` がない場合は `savedAt` とローカル時刻へフォールバックし、離席報酬を最大7日間に制限する。時計の逆行、保存時刻との不整合、数値として扱えない経過時間を検出した場合は報酬を付与しない。オフライン進行は復帰時に既存のゲーム更新処理を指定回数の粗いティックへ分けて実行する。ティック数は500〜1,000,000の範囲で変更でき、通常範囲を超える長時間の処理では既存の頂点・コアヒット集約処理を利用する。ブラウザを長時間ブロックしないため、1回の復帰処理で実行するティック数には10,000回の安全上限を設け、これを超える指定はより粗いティックへまとめる。1ティックあたり24時間という値は長時間集約へ切り替える目安であり、処理時間の上限ではない。

オフライン進行が有効な場合、離席時間はゲーム更新処理として扱うため、ゲーム時間・Infinity周回時間・ゲーム内進行が進む。ただし、離席時間は実プレイ時間には含めない。オフライン進行を無効にしている場合、離席中にゲーム本体、ゲーム時間、実プレイ時間、Infinityなどは進行しない。その代わり、離席時間に応じたTFだけを容量まで蓄積する。したがって、オフライン進行とTF蓄積は同時には発生しない。復帰時には処理時間、ティック数、Infinity増加、IP、TF獲得量をTime Fluxタブのレポートに表示する。

### Time Flux

TFはオンライン中だけ消費でき、Infinityを含むリセットを超えて保持される。初期TFは0秒、初期容量は30分とする。TF獲得量と容量の式は次の通り。

```text
1時間あたりのTF獲得量 = 3600 * (獲得量レベル + 1) / (獲得量レベル + 10) 秒
TF容量 = 1800 * 2^容量レベル 秒
獲得量強化コスト = 1800 * 1.3^獲得量レベル 秒
容量強化コスト = 現在のTF容量 * 0.75 秒
```

ゲーム速度はx1、x2、x3、任意のx4〜x60から選ぶ。x1〜x3は全メインタブ上部のクイックバーから操作でき、任意倍率の入力はTime Fluxタブだけで行う。Time Fluxタブの入力欄は下書きを保持し、任意倍率ボタンを押した時だけ値を範囲内へ補正してセーブし、現在速度へ適用する。クイックバーの任意倍率ボタンはセーブ済みの任意倍率を現在速度へ適用する。設定した任意倍率はx1〜x3へ切り替えても保持され、クイックバーとTime Fluxタブの両方にボタンとして表示する。xNでは実時間1秒ごとに `(N - 1)` TFを消費し、TFが不足または0になった場合は現在速度だけx1へ戻る。任意倍率の設定値は保持する。TF強化はInfinityリセットでも失われない。Time FluxにはOF、TF変換、Time Warpは存在しない。

### 自動化

| 解放条件 | 自動化 |
| --- | --- |
| IU 1-2 | 通常強化の自動購入。全体オン/オフと3種個別オン/オフを持つ。 |
| IU 4-1 | IC自動完了。 |
| 実績19 | Generation自動実行とCore Boost自動実行。 |
| IU 8-1 | Infinity自動実行。 |

通常強化の自動購入は0.1秒ごとに実行される。Generation自動実行は、スコア倍率増加、コスト倍率改善、最小経過秒数のしきい値を持つ。Infinity自動実行はIP獲得量しきい値を持ち、しきい値はlog10で保存する。UIでは現在の数値表記設定に応じた数値または指数表記を入力できる。Infinity Pointの支払可能上限を超えるしきい値は保存・表示できるが、自動実行条件は満たさない。
新規状態のGeneration自動実行しきい値は、スコア倍率増加`2.0`倍、コスト倍率改善`1.0`倍、最小経過秒数`0`秒とする。既存セーブに保存された設定値は保持する。

### 統計

統計タブは概要とチャレンジ記録のサブタブに分かれる。概要では、TF加速分を含むゲーム時間の統計と、オンライン中の実プレイ時間の統計を併記する。総プレイ時間、現在のInfinity周回時間、最速Infinity時間はゲーム時間として従来どおり保持し、それぞれに実プレイ時間の値を追加する。過去10回のInfinity履歴にもゲーム時間と実プレイ時間、到達スコア、獲得IP、挑戦中ICを記録する。旧セーブに実プレイ時間がない履歴は不明として表示する。

チャレンジ記録ではIC1〜8とTC1〜4の最速クリアゲーム時間を表示する。クリアタイムはチャレンジ開始から測定し、TF加速およびオフライン進行で進んだゲーム時間も含める。各チャレンジの最速記録は、より短いクリアタイムでのみ更新する。未クリア・未実装のチャレンジは記録なしと表示する。

## 15. UI、ニュース、設定

メインタブは The Angle、Infinity、Challenges、Time Flux、Automation、Statistics、Achievements、Help、Settings の順で構成する。Infinityタブ内には Upgrades、Infinite Angle、Tower の順でサブタブがある。Challengesタブ内には Infinity Challenge と Tower Challenge の順でサブタブがある。

上部バーは設定で次の表示を選べる。

| モード | 内容 |
| --- | --- |
| ニュース | ゲーム内ニュースをスクロール表示する。 |
| 資源量 | Score、IP、IAを表示する。 |
| 進捗状況 | GR、CB、Infinity、実績などの進捗を表示する。 |
| ブランク | 枠だけを表示する。 |
| 隠す | 上部バーを非表示にする。 |

ニュースは自動スクロールするが、スクリーンリーダー向けのライブリージョンにはしない。ニュース本文の切り替えはスクロール完了タイミングに同期する。

設定では、言語、数値表記、時間単位、軽量表示、浮遊テキスト、FPS表示、上部バー表示、TFクイックバー表示を保存する。TFクイックバーは上部バー表示とは独立して表示・非表示を切り替えられる。

## 16. セーブと更新

セーブはローカルストレージへ自動保存し、手動保存とリセットも提供する。セーブコードは `ANGLE_SAVE_V2:` で始まり、AES-GCMを使って書き出し・読み込みする。

主要な保存項目には、各リソースとlog10値、Generation、Core Boost、Infinity、IP正確値、IUマスク、IC状態、Tower階数、Break Infinite Cap、Infinite Score、実績、自動化、ゲーム時間統計、実プレイ時間統計、表示設定、オフライン進行設定、Time Flux、現在速度、任意倍率、Time Flux強化レベルが含まれる。ローカルセーブには互換用の `savedAt` と、サーバー時刻基準の離席処理に使う任意項目 `serverSavedAt` を保存する。既存セーブに新しい項目がない場合は初回のみ旧時刻で処理して移行し、SAVE_VERSIONは10のまま維持する。

IPは大きい整数を正確に扱うため `infinityPointsExact` を正本にし、表示用に通常数値とlog10値を同期する。

壊れたセーブや復元できないセーブは、可能な限り隔離キーへ退避して新規状態で起動する。

## 17. バージョン管理

公開バージョンは Semantic Versioning 形式を使う。

```text
major.minor.patch
```

- `APP_VERSION`: 公開アプリのバージョン。`version.json` の `appVersion` と一致させる。
- `SAVE_VERSION`: セーブデータの移行が必要な場合に上げる保存形式バージョン。

現行公開版0.9.0では、`APP_VERSION = 0.9.0`、`SAVE_VERSION = 10` である。Tower階数、セーブ復旧チェックポイント、チャレンジタイマー、IC/TC最速記録は既存セーブにない場合に安全な初期値として読み込み、保存形式のバージョンは変更しない。離席報酬の時刻基準はサーバー時刻を優先し、取得できない場合のみローカル時刻へフォールバックする。

ブラウザのキャッシュ対策として、CSS/JSのURLにはアプリバージョンのクエリを付ける。起動中クライアントは `version.json` を定期確認し、新しい `appVersion` を検出したら保存してリロードを促す。

## 18. 主要データ構造

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
infiniteAngleUnlocked
infiniteAngleSpeedLevel
infiniteAngleVertexLevel
infiniteAngleGainLevel
infiniteAngleCurrentGain / infiniteAngleCurrentGainLog10
infiniteAnglePointProgress
infiniteAngleTotalVertexProgress
infiniteAngleLastVertexIndex
towerFloor
infinityUpgradeMask
activeChallenge
completedChallenges
activeChallengeTime
activeTowerChallenge
completedTowerChallenges
activeTowerChallengeTime
fastestInfinityChallengeTimes
fastestTowerChallengeTimes
infiniteCapBroken
achievementMask
totalPlayTime
totalRealPlayTime
currentInfinityRunTime
currentInfinityRealTime
fastestInfinityTime
fastestInfinityRealTime
lastInfinityRuns
offlineProgressEnabled
offlineTickCount
timeFlux
timeFluxCapacityLevel
timeFluxGainLevel
timeFluxSpeed
showTimeFluxQuickBar
automation settings
display settings
```

## 19. 今後の拡張候補

- IUの新しい段と分岐
- 新しいInfinity Challenge
- Tower Challengeの具体的な制約・報酬
- 後半の複数Point
- 実績の個別追加報酬
- 後半バランス調整
