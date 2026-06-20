# Contributing

## Branch Strategy

This repository uses a lightweight stable-main workflow.

- `main` is the stable playable branch.
- Keep `main` in a state that can be opened and played at any time.
- Do feature work on short-lived branches, then merge after verification.
- Do not keep long-lived `develop` or `release` branches for normal work.

Recommended branch names:

- `feature/<topic>` for new gameplay systems.
- `fix/<topic>` for bug fixes.
- `balance/<topic>` for tuning and formula changes.
- `ui/<topic>` for layout and visual changes.

Examples:

- `feature/infinity-upgrades`
- `fix/settings-select-loop`
- `balance/pre-infinity-pace`
- `ui/mobile-angle-fit`

## Workflow

Before starting work:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/<topic>
```

During work:

- Keep each branch focused on one topic.
- Commit small, reviewable changes.
- Do not mix balance, UI, and unrelated bug fixes in one branch unless the same issue requires them.

Before merging to `main`:

```bash
node --check game.js
git status --short
```

If the change affects UI, gameplay, saves, or balance, also verify it in the browser with the Playwright game client or an equivalent Firefox/Playwright scenario.

After verification:

```bash
git switch main
git pull --ff-only origin main
git merge --no-ff feature/<topic>
git push origin main
```

Delete the finished local branch when it is no longer needed:

```bash
git branch -d feature/<topic>
```

## Direct Commits To Main

Direct commits to `main` are allowed only for small low-risk changes:

- Documentation-only edits.
- Small typo fixes.
- Emergency one-line fixes after verification.

Even for direct commits, run the relevant checks before pushing.

## Release Tags

Use tags as stable recovery points when a playable milestone is reached.

Examples:

- `v0.1.0-core-loop`
- `v0.2.0-infinity`

Suggested command:

```bash
git tag -a v0.1.0-core-loop -m "Core loop playable"
git push origin v0.1.0-core-loop
```

## Verification Checklist

Minimum check for JavaScript changes:

```bash
node --check game.js
```

For UI or gameplay changes:

- Confirm the target tab or screen renders correctly.
- Check desktop and mobile viewports when layout is affected.
- Confirm `window.render_game_to_text()` matches the visible state for gameplay-affecting changes.
- Check the browser console for new errors.

Before pushing:

```bash
git status --short --branch
git log --oneline -5
```
