from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count == 0 and new in text:
        return text
    if count != 1:
        raise SystemExit(f"{label}: expected one old match or prepared value, found {count}")
    return text.replace(old, new, 1)


for filename in [
    "src/core/constants.js",
    "version.json",
    "index.html",
    "src/ui/events.js",
    "src/ui/render-eternity.js",
]:
    path = Path(filename)
    text = path.read_text()
    text = text.replace("0.12.0", "0.12.2").replace("0.12.1", "0.12.2")
    path.write_text(text)

index_path = Path("index.html")
index = index_path.read_text()
for old, new, label in [
    (
        "Eternityを独立したメインタブへ移動し、UIレイアウトを修正しました。",
        "Eternityの初回フローとTC4 / Eternityタブ表示を修正しました。",
        "index update summary",
    ),
    (
        "EternityをInfinity内のサブタブから独立したメインタブへ移動しました。",
        "TC4クリア + 1.80e308 IPでEternityが利用可能になり、条件達成だけでは自動実行されなくなりました。",
        "index update first bullet",
    ),
    (
        "InfinityのサブタブをUpgrades / Infinite Angle / Towerの3つに戻し、レイアウト崩れを修正しました。",
        "Milestone 1-1〜1-3はEternity後に取得でき、未使用の取得権は保持されます。TC4タイトルとEternityタブのレスポンシブ表示も修正しました。",
        "index update second bullet",
    ),
    (
        "ゲーム進行・バランス・セーブ形式10に変更はありません。",
        "セーブ形式10は変更ありません。Milestone 1-1文言、Milestone 2〜5、TC4バランスは変更していません。",
        "index update compatibility note",
    ),
]:
    index = replace_once(index, old, new, label)
index_path.write_text(index)

i18n_path = Path("src/data/i18n.js")
i18n = i18n_path.read_text()
for old, new, label in [
    ('updateTitle: "0.12.1 アップデート"', 'updateTitle: "0.12.2 アップデート"', "Japanese update title"),
    (
        'updateSummary: "Tower Challenge 4 / Eternityの0.12.0 UIを修正し、Eternityを独立したメインタブへ移動しました。"',
        'updateSummary: "Eternityの初回フローとTC4 / Eternityタブ表示を修正しました。"',
        "Japanese update summary",
    ),
    (
        'updateResetDock: "EternityをInfinity内のサブタブから独立したメインタブへ移動しました。"',
        'updateResetDock: "TC4クリア + 1.80e308 IPでEternityが利用可能になり、条件達成だけでは自動実行されなくなりました。"',
        "Japanese update first bullet",
    ),
    (
        'updateCanvas: "InfinityのサブタブをUpgrades / Infinite Angle / Towerの3つに戻しました。Eternity条件の1.80e308 IPとMilestone 1-1〜5の仕様に変更はありません。"',
        'updateCanvas: "Milestone 1-1〜1-3はEternity後に取得でき、未使用の取得権は保持されます。TC4タイトルとEternityタブのレスポンシブ表示も修正しました。"',
        "Japanese update second bullet",
    ),
    (
        'updateModalNote: "ゲーム進行・バランス・セーブ形式10に変更はありません。"',
        'updateModalNote: "セーブ形式10は変更ありません。Milestone 1-1文言、Milestone 2〜5、TC4バランスは変更していません。"',
        "Japanese update note",
    ),
    ('updateTitle: "Version 0.12.1"', 'updateTitle: "Version 0.12.2"', "English update title"),
    (
        'updateSummary: "Moved Eternity to its own main tab and repaired the Tower Challenge 4 / Eternity release UI layout."',
        'updateSummary: "Corrected the first Eternity flow and the TC4 / Eternity-tab presentation."',
        "English update summary",
    ),
    (
        'updateResetDock: "Eternity is now an independent top-level tab instead of an Infinity subtab."',
        'updateResetDock: "After clearing TC4 and reaching 1.80e308 IP, Eternity becomes available for manual activation instead of triggering automatically."',
        "English update first bullet",
    ),
    (
        'updateCanvas: "Infinity is back to its three subtabs: Upgrades, Infinite Angle, and Tower. The 1.80e308 IP Eternity requirement and Milestones 1-1 through 5 are unchanged."',
        'updateCanvas: "First-tier Milestones 1-1 through 1-3 are acquired after Eternity, unused acquisition rights persist, and the TC4 title / Eternity responsive tab layout are fixed."',
        "English update second bullet",
    ),
    (
        'updateModalNote: "Gameplay progression, balance, and save format 10 are unchanged."',
        'updateModalNote: "Save format 10 is unchanged. Milestone 1-1 wording, Milestones 2-5, and TC4 balance are unchanged."',
        "English update note",
    ),
]:
    i18n = replace_once(i18n, old, new, label)
i18n_path.write_text(i18n)

browser_path = Path("tests/browser-smoke.mjs")
browser = browser_path.read_text()
browser = replace_once(
    browser,
    '  assert.match(updateModal.summary, /Tower Challenge 4/);\n'
    '  assert.match(updateModal.summary, /Eternity/);\n'
    '  assert.match(updateModal.canvas, /1\\.80e308 IP/);\n'
    '  assert.match(updateModal.canvas, /Milestone 1-1〜5/);',
    '  assert.match(updateModal.summary, /Eternity/);\n'
    '  assert.match(updateModal.summary, /修正/);\n'
    '  assert.match(updateModal.canvas, /Milestone 1-1〜1-3/);\n'
    '  assert.match(updateModal.canvas, /TC4/);',
    "browser update-modal assertions",
)
browser_path.write_text(browser)

Path("docs/releases/0.12.2.md").write_text(
    """## Angle Incremental 0.12.2

### Eternity

- 現在の周回でTC4をクリアし、`1.80e308 IP`に到達するとEternityが利用可能になり、明示的なボタン操作で実行する方式へ変更しました。
- 条件達成時にEternityが自動実行される挙動を廃止しました。
- Milestone 1-1 / 1-2 / 1-3の事前予約を廃止し、成功したEternity後に未取得のMilestoneを取得する方式へ変更しました。
- 未使用のfirst-tier取得権は失われず、`min(Eternity回数, 3) - 取得済みTier1数`から導出されます。
- 旧`eternityMilestoneChoice`はセーブ互換用に保持しますが、ゲーム進行には使用しません。

### UI

- TC4のタイトル`TC4 既存品の代替`を復元しました（英語: `TC4 Substitute for Existing Products`）。
- タブレット/モバイル幅でEternityメインタブだけ大きくなる0.12.1のレスポンシブ表示を修正しました。

### 互換性・対象外

- `SAVE_VERSION`は10のままです。
- Milestone 1-1の文言は変更していません。
- Milestone 1-3は再確認の結果、現行実装が仕様通りのため変更していません。
- Milestone 2〜5の監査・変更は0.12.2では実施していません。
- TC4の係数・価格・数式・専用強化UIは変更していません。
- Eternity Point / EP、Break Eternityは導入していません。

関連Issue / PR: #166, #167, #168, #171, #170, #172, #173
"""
)

Path(".github/workflows/prepare-0.12.2-release.yml").unlink(missing_ok=True)
Path("scripts/prepare-0.12.2-release.py").unlink(missing_ok=True)
Path(".prepare-0.12.2-trigger").unlink(missing_ok=True)

Path(".github/workflows/regression.yml").write_text(
    """name: Regression Suite

on:
  pull_request:
    branches:
      - main
      - next
      - \"release/**\"
  push:
    branches:
      - main
      - next

jobs:
  regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install dependencies
        run: npm ci
      - name: Verify ESM entrypoint order
        run: npm run check:runtime-order
      - name: Check syntax
        run: npm run check:syntax
      - name: Check version consistency
        run: npm run check:version
      - name: Check IDD review policy
        run: npm run check:idd-policy
      - name: Run ESM regression suite
        run: npm run test:regression
      - name: Install Chromium for browser smoke test
        timeout-minutes: 5
        run: npx playwright install chromium
      - name: Run browser ESM smoke test
        run: npm run test:browser
      - name: Test local performance gate classifier
        run: npm run test:local-performance-gate
      - name: Run performance smoke test
        run: npm run test:performance
      - name: Upload test diagnostics
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-diagnostics
          path: |
            browser-smoke-report.json
            output/performance-smoke.json
            regression-failure.txt
          if-no-files-found: warn
"""
)
