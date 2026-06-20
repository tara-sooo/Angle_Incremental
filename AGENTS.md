# Repository Guidelines

## Project Structure & Module Organization

This is a static browser game. Core files live at the repository root:

- `index.html`: game UI markup and tab/panel structure.
- `styles.css`: responsive layout, colors, and component styling.
- `game.js`: game state, progression logic, rendering, save/load, and debug hooks.
- `angle-incremental-spec.md`: gameplay specification and formulas.
- `CONTRIBUTING.md`: branch strategy and verification workflow.
- `progress.md`: running development notes and future TODOs.

Generated screenshots and Playwright artifacts are written under `output/` and are not source modules.

## Build, Test, and Development Commands

Run locally with any static file server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000/`.

Check JavaScript syntax before committing:

```bash
node --check game.js
```

For UI or gameplay changes, use Firefox/Playwright or the web game client referenced in `CONTRIBUTING.md` to capture screenshots and inspect `window.render_game_to_text()`.

## Coding Style & Naming Conventions

Use plain JavaScript, HTML, and CSS. Keep code dependency-free unless a feature clearly requires a library. Use 2-space indentation in HTML/CSS/JS and prefer descriptive camelCase names for JavaScript functions and state fields, such as `runGeneration` or `coreBoostCount`.

Keep changes scoped. Do not mix balance tuning, layout work, and unrelated bug fixes in one commit. Preserve existing IDs and debug hooks unless a refactor explicitly replaces them.

## Testing Guidelines

There is no formal unit test suite yet. Minimum verification for logic changes is:

```bash
node --check game.js
```

For gameplay changes, verify affected state through `window.render_game_to_text()`. For layout changes, check desktop and mobile screenshots. For save/settings changes, confirm persistence after reload and watch for browser console errors.

## Commit & Pull Request Guidelines

Commit messages use short imperative summaries, matching history examples such as `Fix vertex crossing precision` and `List Infinity Challenges`.

Use short-lived branches:

- `feature/<topic>`
- `fix/<topic>`
- `balance/<topic>`
- `ui/<topic>`

Pull requests should include a concise summary, verification steps, screenshots for UI changes, and notes about balance or save compatibility when relevant. Keep `main` stable and playable.

## Agent-Specific Instructions

Before editing, check `git status --short --branch`. Do not overwrite user changes. Prefer `rg` for searches. Use `apply_patch` for manual edits. If changing UI or gameplay, run the relevant browser verification and inspect screenshots before finalizing.
