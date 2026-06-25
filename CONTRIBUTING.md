# Contributing

## Release Model

Angle Incremental ships bundled milestone updates rather than exposing every completed feature immediately.

- `main` represents the currently released, stable, playable version.
- `next` integrates the work planned for the next numbered update.
- A numbered release such as `0.1.0` is a coherent milestone containing multiple related improvements, not a single small feature.
- Before work begins, classify planned items as **required**, **optional**, or **deferred to the following release**. Do not keep expanding a release indefinitely.

## Branch Strategy

### Long-lived branches

- `main` — public, stable, and playable at all times.
- `next` — integration branch for the next planned release. It may contain unreleased work and must not be treated as the public stable build.

### Short-lived branches

- `feature/<topic>` — new gameplay systems or player-facing features.
- `fix/<topic>` — bug fixes discovered during normal development.
- `balance/<topic>` — progression, formula, economy, or tuning changes.
- `docs/<topic>` — specifications, release notes, README, or development documentation.
- `chore/<topic>` — tooling, test harnesses, CI, repository maintenance, or non-player-facing cleanup.
- `release/<version>` — release stabilization only, for example `release/0.1.0`.
- `hotfix/<version>-<topic>` — urgent fix for an already released version, for example `hotfix/0.1.1-save-load`.

Use lowercase ASCII names with hyphens. Keep branches focused on one concern.

## Normal Development Flow

1. Start an ordinary feature, fix, balance, documentation, or maintenance branch from `next`.
2. Implement and verify one focused change.
3. Open a pull request into `next`.
4. Record the change in the release plan if it belongs in the next numbered update.
5. Merge into `next` only after reviewing the diff and relevant checks.

Example:

```bash
git switch next
git pull --ff-only origin next
git switch -c feature/infinity-statistics
```

For JavaScript changes, run at least:

```bash
node --check game.js
```

For UI, gameplay, save, or balance changes, also test the affected flow in a browser. Check desktop and mobile layouts when relevant, existing saves, a new save, and browser console errors.

## Release Flow

When the planned release scope is complete:

1. Create `release/<version>` from `next`, for example `release/0.1.0`.
2. Stop adding new features to that release branch.
3. Allow only release-blocking bug fixes, save migration work, final balance adjustments, version metadata, changelog entries, and release notes.
4. Test the release candidate from a new save and representative existing saves.
5. Merge the release branch into `main` through a pull request.
6. Create an annotated Git tag such as `v0.1.0` and publish the GitHub Release.
7. Merge the finalized release fixes back into `next`, then continue work toward the following milestone.

During release stabilization, work for a later update may continue on `next`. It must not be merged into `release/<version>` unless explicitly approved for that release.

## Hotfix Flow

Use a hotfix branch only for a serious problem in a released version, especially a save-loss, progression-blocking, or startup failure.

1. Create `hotfix/<version>-<topic>` from the released tag or the corresponding `main` commit.
2. Make the smallest safe correction.
3. Verify the fix and open a pull request into `main`.
4. Tag the patch release, for example `v0.1.1`.
5. Merge the hotfix into `next` so the correction is not lost in ongoing development.

## Pull Request Requirements

Every pull request should state:

- **Purpose** — what problem or feature the change addresses.
- **Impact** — gameplay, UI, balance, save-data, or documentation impact.
- **Save compatibility** — unchanged, migrated, or intentionally incompatible.
- **Validation** — commands run, browser checks performed, and anything not verified.
- **Release target** — the intended version, or `deferred` if it is not yet scheduled.

Do not combine unrelated feature work, large refactors, balance experiments, and bug fixes in one pull request unless they are inseparable.

## Versioning

Use `0.x.y` until the game reaches a stable public contract.

- Patch: `0.1.0` -> `0.1.1` for bug fixes and low-risk adjustments.
- Minor milestone: `0.1.x` -> `0.2.0` for a bundled content or systems update.
- `1.0.0` when the core design, expected save compatibility, and baseline quality are considered stable.

Keep the application version separate from the save-data schema version. A documentation or balance-only release may change the application version without changing the save schema. Increase the save schema version only when loading older data requires migration or would otherwise be unsafe.

## Verification Checklist

Minimum check for JavaScript changes:

```bash
node --check game.js
```

For UI or gameplay changes:

- Confirm the target tab or screen renders correctly.
- Check desktop and mobile viewports when layout is affected.
- Confirm existing and new saves load correctly.
- Confirm `window.render_game_to_text()` matches the visible state for gameplay-affecting changes.
- Check the browser console for new errors.

Before opening or updating a pull request:

```bash
git status --short --branch
git log --oneline -5
```
