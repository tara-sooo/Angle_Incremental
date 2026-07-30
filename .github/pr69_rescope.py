from pathlib import Path

ROOT = Path('.')


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:80]!r}')
    write(path, text.replace(old, new, 1))


def replace_all(path: str, old: str, new: str, minimum: int = 1) -> None:
    text = read(path)
    count = text.count(old)
    if count < minimum:
        raise RuntimeError(f'{path}: expected at least {minimum} occurrences, found {count}: {old!r}')
    write(path, text.replace(old, new))


replace_once('angle-incremental-spec.md', '対象リリース: **0.9.1**', '対象状態: **開発中（次期リリース未定）**')
replace_once(
    'angle-incremental-spec.md',
    'TFはオンライン中だけ消費でき、Infinityを含むリセットを超えて保持される。初期TFは0秒、初期容量は30分とする。TF獲得量とコストの式は次の通り。容量は指数式ではなく、段階表で定義する。',
    'TFはオンライン中だけ消費でき、Infinityを含むリセットを超えて保持される。初期TFは0秒、初期容量は30分とする。TF獲得量と容量の式は次の通り。',
)
replace_once(
    'angle-incremental-spec.md',
    '1時間あたりのTF獲得量 = 3600 * (獲得量レベル + 1) / (獲得量レベル + 10) 秒\n獲得量強化コスト',
    '1時間あたりのTF獲得量 = 3600 * (獲得量レベル + 1) / (獲得量レベル + 10) 秒\nTF容量 = 1800 * 2^容量レベル 秒\n獲得量強化コスト',
)
replace_once(
    'angle-incremental-spec.md',
    '''容量レベルごとの容量は次の秒数表を使用する。レベルは0〜59で、Lv59の14日を上限とする。Lv59では容量強化を購入できず、UIは`MAX`を表示する。獲得量レベルにはこの変更による明示的な上限を設けない。\n\n```text\n[1800, 3600, 7200, 14400, 28800, 57600, 115200, 172800, 216000, 259200,\n 302400, 345600, 388800, 432000, 460800, 489600, 518400, 547200, 576000, 604800,\n 626400, 648000, 669600, 691200, 712800, 734400, 756000, 777600, 799200, 820800,\n 842400, 864000, 878400, 892800, 907200, 921600, 936000, 950400, 964800, 979200,\n 993600, 1008000, 1022400, 1036800, 1047600, 1058400, 1069200, 1080000, 1090800, 1101600,\n 1112400, 1123200, 1134000, 1144800, 1155600, 1166400, 1177200, 1188000, 1198800, 1209600]\n```\n\n既存セーブは容量レベルを0〜59へ丸め、同じレベルの新しい容量を適用する。この移行により、旧仕様で高い容量レベルや大きなTF残高を持っていたセーブでは、容量・残高が減少する場合がある。TF残高は新容量以下なら維持し、容量を超える分だけ新容量へ丸める。補償・返金・満タン化は行わない。サーバー時刻が有効なオフライン報酬には固定7日上限を設けない。ローカル時刻へフォールバックした場合と旧セーブのローカル時刻を使う場合は、引き続き7日を上限とする。Time Fluxの残高は従来どおり容量を超えない。\n\n''',
    '',
)
replace_once(
    'angle-incremental-spec.md',
    '0.9.1時点では、`APP_VERSION = 0.9.1`、`SAVE_VERSION = 10` である。',
    '現行公開版0.9.0では、`APP_VERSION = 0.9.0`、`SAVE_VERSION = 10` である。',
)

replace_all('index.html', '0.9.1', '0.9.0')
replace_once('index.html', 'セーブ保護、オフライン進行、Time Flux容量、チェックポイント処理を改善しました。', 'セーブ復旧、IU 13-1、Tower Challenge 1/2、チャレンジ最速記録を追加しました。')
replace_once('index.html', 'ロード失敗時も通常セーブを保持し、復旧UIから再試行や隔離セーブの復元ができます。', 'セーブコードのインポート前バックアップとチェックポイントからセーブを復旧できます。')
replace_once('index.html', '段階式Time Flux容量へ移行しました。既存セーブでは容量や残高が減少する場合があります。サーバー時刻基準の長時間オフライン進行と時計逆行時の復旧も改善しました。', 'IU 13-1、Tower Challenge 1/2、再挑戦、IC/TC最速クリア統計を追加しました。')

replace_once(
    'progress.md',
    '- Prepared the 0.9.1 release candidate with checkpoint clock-rollback fixes, staged Time Flux capacity (which may reduce legacy capacity or balance), unrestricted trusted-clock offline progress, and load-failure save protection while keeping SAVE_VERSION 10 unchanged; TC3/TC4 and official IC6-IC8 designs remain deferred.\n',
    '',
)

replace_once('src/core/constants.js', 'const APP_VERSION = "0.9.1";', 'const APP_VERSION = "0.9.0";')
replace_once(
    'src/core/constants.js',
    '''const TIME_FLUX_CAPACITY_SECONDS_BY_LEVEL = Object.freeze([\n  1800, 3600, 7200, 14400, 28800, 57600, 115200, 172800, 216000, 259200,\n  302400, 345600, 388800, 432000, 460800, 489600, 518400, 547200, 576000, 604800,\n  626400, 648000, 669600, 691200, 712800, 734400, 756000, 777600, 799200, 820800,\n  842400, 864000, 878400, 892800, 907200, 921600, 936000, 950400, 964800, 979200,\n  993600, 1008000, 1022400, 1036800, 1047600, 1058400, 1069200, 1080000, 1090800, 1101600,\n  1112400, 1123200, 1134000, 1144800, 1155600, 1166400, 1177200, 1188000, 1198800, 1209600,\n]);\nconst TIME_FLUX_MAX_CAPACITY_LEVEL = TIME_FLUX_CAPACITY_SECONDS_BY_LEVEL.length - 1;\n''',
    '',
)
replace_once('src/core/constants.js', 'expose("TIME_FLUX_CAPACITY_SECONDS_BY_LEVEL", () => TIME_FLUX_CAPACITY_SECONDS_BY_LEVEL);\n', '')
replace_once('src/core/constants.js', 'expose("TIME_FLUX_MAX_CAPACITY_LEVEL", () => TIME_FLUX_MAX_CAPACITY_LEVEL);\n', '')

replace_once(
    'src/core/save.js',
    'runtime.state.timeFluxCapacityLevel = runtime.clampTimeFluxCapacityLevel(data.timeFluxCapacityLevel);',
    'runtime.state.timeFluxCapacityLevel = Math.max(0, Math.floor(runtime.sanitizeNumber(data.timeFluxCapacityLevel, 0)));',
)

replace_all('src/data/i18n.js', '    max: "MAX",\n', '', minimum=2)
replacements = {
    '    updateTitle: "0.9.1 アップデート",': '    updateTitle: "0.9.0 アップデート",',
    '    updateSummary: "セーブ保護、オフライン進行、Time Flux容量、チェックポイント処理を改善しました。",': '    updateSummary: "セーブ復旧、IU 13-1、Tower Challenge 1/2、チャレンジ最速記録を追加しました。",',
    '    updateResetDock: "ロード失敗時も通常セーブを保持し、復旧UIから再試行や隔離セーブの復元ができます。",': '    updateResetDock: "セーブコードのインポート前バックアップとチェックポイントからセーブを復旧できます。",',
    '    updateCanvas: "段階式Time Flux容量へ移行しました。既存セーブでは容量や残高が減少する場合があります。サーバー時刻基準の長時間オフライン進行と時計逆行時の復旧も改善しました。",': '    updateCanvas: "IU 13-1、Tower Challenge 1/2、再挑戦、IC/TC最速クリア統計を追加しました。",',
    '    updateTitle: "Version 0.9.1",': '    updateTitle: "Version 0.9.0",',
    '    updateSummary: "Improved save protection, offline progress, Time Flux capacity, and checkpoint handling.",': '    updateSummary: "Added save recovery, IU 13-1, Tower Challenges 1/2, and fastest challenge records.",',
    '    updateResetDock: "Normal saves are kept after load failures, with retry and quarantined-save recovery controls.",': '    updateResetDock: "Restore saves from the pre-import backup or periodic and event checkpoints.",',
    '    updateCanvas: "Migrated Time Flux capacity to staged levels; existing saves may have lower capacity or balance. Also improved long server-clock offline progress and clock rollback recovery.",': '    updateCanvas: "Added IU 13-1, Tower Challenges 1/2, replay support, and fastest IC/TC clear statistics.",',
}
for old, new in replacements.items():
    replace_once('src/data/i18n.js', old, new)

replace_once(
    'src/systems/time-flux.js',
    '''function clampTimeFluxCapacityLevel(value) {\n  return Math.min(\n    runtime.TIME_FLUX_MAX_CAPACITY_LEVEL,\n    Math.max(0, Math.floor(runtime.sanitizeNumber(value, 0))),\n  );\n}\n\n''',
    '',
)
replace_once(
    'src/systems/time-flux.js',
    '''function timeFluxCapacitySeconds(level = runtime.state.timeFluxCapacityLevel) {\n  return runtime.TIME_FLUX_CAPACITY_SECONDS_BY_LEVEL[clampTimeFluxCapacityLevel(level)];\n}''',
    '''function timeFluxCapacitySeconds(level = runtime.state.timeFluxCapacityLevel) {\n  const safeLevel = Math.max(0, Math.floor(runtime.sanitizeNumber(level, 0)));\n  const capacity = runtime.TIME_FLUX_INITIAL_CAPACITY_SECONDS * (2 ** safeLevel);\n  return Number.isFinite(capacity) ? Math.min(Number.MAX_SAFE_INTEGER, capacity) : Number.MAX_SAFE_INTEGER;\n}''',
)
replace_once(
    'src/systems/time-flux.js',
    '''function timeFluxCapacityUpgradeCost(level = runtime.state.timeFluxCapacityLevel) {\n  const safeLevel = clampTimeFluxCapacityLevel(level);\n  if (safeLevel >= runtime.TIME_FLUX_MAX_CAPACITY_LEVEL) return Infinity;\n  return timeFluxCapacitySeconds(safeLevel) * runtime.TIME_FLUX_CAPACITY_COST_FACTOR;\n}''',
    '''function timeFluxCapacityUpgradeCost(level = runtime.state.timeFluxCapacityLevel) {\n  return timeFluxCapacitySeconds(level) * runtime.TIME_FLUX_CAPACITY_COST_FACTOR;\n}''',
)
replace_once(
    'src/systems/time-flux.js',
    '''function canBuyTimeFluxUpgrade(kind) {\n  if (kind === "capacity" && clampTimeFluxCapacityLevel(runtime.state.timeFluxCapacityLevel)\n    >= runtime.TIME_FLUX_MAX_CAPACITY_LEVEL) return false;\n  const cost = timeFluxUpgradeCost(kind);\n  if (!Number.isFinite(cost) || cost <= 0 || runtime.state.timeFlux < cost) return false;\n  return kind === "gain" || kind === "capacity";\n}''',
    '''function canBuyTimeFluxUpgrade(kind) {\n  const cost = timeFluxUpgradeCost(kind);\n  if (!Number.isFinite(cost) || cost <= 0 || runtime.state.timeFlux < cost) return false;\n  if (kind === "capacity" && timeFluxCapacitySeconds() >= Number.MAX_SAFE_INTEGER) return false;\n  return kind === "gain" || kind === "capacity";\n}''',
)
replace_once('src/systems/time-flux.js', 'expose("clampTimeFluxCapacityLevel", () => clampTimeFluxCapacityLevel, (value) => { clampTimeFluxCapacityLevel = value; });\n', '')

replace_once('src/ui/events.js', 'numeric-stability.js?v=0.9.1', 'numeric-stability.js?v=0.9.0')
replace_once(
    'src/ui/render-time-flux.js',
    '''  const capacityAtMax = runtime.clampTimeFluxCapacityLevel(state.timeFluxCapacityLevel)\n    >= runtime.TIME_FLUX_MAX_CAPACITY_LEVEL;\n  elements.timeFluxCapacityLevel.textContent = capacityAtMax\n    ? runtime.t("max")\n    : `${runtime.t("level")} ${state.timeFluxCapacityLevel}`;''',
    '  elements.timeFluxCapacityLevel.textContent = `${runtime.t("level")} ${state.timeFluxCapacityLevel}`;',
)
replace_once(
    'src/ui/render-time-flux.js',
    '''  elements.timeFluxCapacityCost.textContent = capacityAtMax\n    ? runtime.t("max")\n    : `${runtime.t("cost")} ${formatFluxTime(runtime.timeFluxCapacityUpgradeCost())}`;''',
    '  elements.timeFluxCapacityCost.textContent = `${runtime.t("cost")} ${formatFluxTime(runtime.timeFluxCapacityUpgradeCost())}`;',
)

replace_all('tests/browser-smoke.mjs', '0.9.1', '0.9.0')
replace_once('tests/browser-smoke.mjs', 'assert.match(updateModal.summary, /セーブ保護/);', 'assert.match(updateModal.summary, /セーブ復旧/);')
replace_once('tests/browser-smoke.mjs', 'assert.match(updateModal.canvas, /既存セーブでは容量や残高が減少/);', 'assert.match(updateModal.canvas, /Tower Challenge/);')
start = '  const maxCapacityContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });\n'
end = '  const serverClockContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });\n'
text = read('tests/browser-smoke.mjs')
if text.count(start) != 1 or text.count(end) != 1:
    raise RuntimeError('tests/browser-smoke.mjs: max-capacity test markers not found uniquely')
left, rest = text.split(start, 1)
_, right = rest.split(end, 1)
write('tests/browser-smoke.mjs', left + end + right)

replace_once('tests/performance-smoke.mjs', 'angle-incremental-seen-version", "0.9.1"', 'angle-incremental-seen-version", "0.9.0"')
replace_once('tests/save-recovery-module-runtime.js', 'runtime.reloadForRemoteUpdate("0.9.1")', 'runtime.reloadForRemoteUpdate("test-update")')

text = read('tests/time-flux-module-runtime.js')
start = '  assert.equal(runtime.TIME_FLUX_MAX_CAPACITY_LEVEL, 59, "Time Flux capacity should have 60 staged levels");\n'
end = '  state.timeFlux = 1350;\n'
if text.count(start) != 1 or text.count(end) < 1:
    raise RuntimeError('tests/time-flux-module-runtime.js: staged-capacity test markers not found')
left, rest = text.split(start, 1)
_, right = rest.split(end, 1)
write('tests/time-flux-module-runtime.js', left + end + right)
replace_once(
    'tests/time-flux-module-runtime.js',
    '''  runtime.applySaveData({ timeFluxCapacityLevel: 8, timeFlux: 123 }, 10);\n  assert.equal(state.timeFluxCapacityLevel, 8, "legacy capacity levels within the table should be preserved");\n  assert.equal(state.timeFlux, 123, "legacy TF below the new capacity should be preserved");\n  runtime.applySaveData({ timeFluxCapacityLevel: 60, timeFlux: 1500000 }, 10);\n  assert.equal(state.timeFluxCapacityLevel, 59, "legacy capacity levels above MAX should clamp to MAX");\n  assert.equal(state.timeFlux, 1209600, "legacy TF above the new capacity should clamp to fourteen days");''',
    '''  runtime.applySaveData({ timeFluxCapacityLevel: 60, timeFlux: 1500000 }, 10);\n  assert.equal(state.timeFluxCapacityLevel, 60, "existing TF capacity levels should remain unchanged");\n  assert.equal(state.timeFlux, 1500000, "existing TF balances should remain unchanged when below the legacy capacity");''',
)

replace_once('version.json', '"appVersion": "0.9.1"', '"appVersion": "0.9.0"')

for pattern in ('pr69-rescope.patch*', 'pr69_rescope.py'):
    for path in (ROOT / '.github').glob(pattern):
        path.unlink()

for path in ROOT.rglob('*'):
    if not path.is_file() or '.git' in path.parts:
        continue
    try:
        text = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        continue
    forbidden = ('0.9.1', 'TIME_FLUX_CAPACITY_SECONDS_BY_LEVEL', 'TIME_FLUX_MAX_CAPACITY_LEVEL', 'clampTimeFluxCapacityLevel', '段階式Time Flux', 'staged Time Flux')
    hits = [token for token in forbidden if token in text]
    if hits:
        raise RuntimeError(f'{path}: stale deferred-release references remain: {hits}')
