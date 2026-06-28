# Break Infinite Cap 仕様改訂

この文書は `angle-incremental-spec.md` の **13.2 / 13.4 / 16** を、Break Infinite Cap に関して置き換える仕様改訂である。

## 1. 実行条件

所持スコアが以下に到達すると、Break Infinite Cap を実行できる。

```text
所持スコア >= 1.00e350
```

Break Infinite Cap は恒久的な状態であり、Infinity を含む通常のリセットでは失われない。

到達時期は、Infinity Challenge を全クリアする頃合いを目標とする。ただし、これはバランス調整上の予定であり、IC全クリアを実行条件にはしない。

## 2. スコアソフトキャップの破壊

Break Infinite Cap 前は、所持スコアが `1.80e308` を超えた後、強力なスコアソフトキャップを受ける。

Break Infinite Cap 実行後は、この `1.80e308` 以降の強力なスコアソフトキャップを完全に無効化する。

```text
Break Infinite Cap 前:
  1.80e308 以降に強力なソフトキャップを適用する

Break Infinite Cap 後:
  1.80e308 以降の強力なソフトキャップを適用しない
```

## 3. Infinity 到達条件

Break Infinite Cap 後も、Infinity を実行するには所持スコアが `1.80e308` 以上でなければならない。

```text
Infinity可能条件 = 所持スコア >= 1.80e308
```

Break Infinite Cap はInfinity到達条件を引き下げない。

## 4. Infinity Point 計算式

Infinity Point（IP）の基本獲得量は、Break Infinite Cap の実行前後で以下のように変化する。

```text
Break Infinite Cap 前:
  IP基本獲得量 = max(1, floor(log10(所持スコア) - 307))

Break Infinite Cap 後:
  IP基本獲得量 = max(1, floor(log2(所持スコア) - 307))
```

実装では通常のJavaScript数値上限を超えるスコアも扱うため、Break Infinite Cap 後の `log2(所持スコア)` は次の等価式で計算する。

```text
log2(所持スコア) = log10(所持スコア) / log10(2)
```

ICなどによるIP倍率は、この基本獲得量を求めた後に適用する。
