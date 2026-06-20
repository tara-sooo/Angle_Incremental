Original prompt: では、中核ループを完成させてください

## Progress

- Created implementation plan for a static browser game using `index.html`, `styles.css`, and `game.js`.
- Scope: core Angle loop, Point orbit, vertex gain growth, score upgrades, Generation unlock/reset/boost, deterministic test hooks.
- Added static game implementation with canvas rendering, upgrade buttons, Generation reset, `render_game_to_text`, and `advanceTime`.
- Ran initial Playwright/canvas and full-page screenshot checks. Desktop and mobile layouts rendered correctly.
- Tuned early upgrade costs down so the first purchases are reachable in a short play session.
- Re-ran Playwright validation after tuning. Confirmed score loop, upgrade purchases, Generation reset/boost, and no console errors.
- Fixed two review findings: high-speed updates now process multiple vertex crossings per frame, and Generation status now distinguishes unlocked from ready.
- Added `localStorage` save/load support with versioned save data, 5-second autosave, immediate saves after purchases/Generation, before-unload save, and a reset-save button.
- Verified autosave writes, manual save survives reload, reset clears storage, and the updated UI renders correctly.
- Localized the visible UI to Japanese and added a Japanese-capable web font so canvas and DOM text render correctly in environments without system Japanese fonts.
- Fixed late-game performance risk by batching very large vertex-crossing updates, and changed very short lap times to sub-10ms display instead of `0.00秒`.
- Fixed vertex-boundary precision drift so exact boundary advances consistently apply the per-vertex gain increase.
- Changed gain display to show the total gain as the primary value, with multiplicative notation as secondary text, so gain upgrades no longer appear to add only 0.01 when vertex count enables split notation.
- Added Core Boost as a second reset layer at 1.00e20 current score, with requirement squaring, lower-layer reset, vertex-gain increase multiplier, and score-gain exponent boost.
- Fixed Core Boost review issues: batched core-hit score now sums nonlinear gains per core hit, and Core Boost requirements use capped log-space comparison to avoid Infinity requirements.
- Bounded Core Boost batch scoring: normal core-hit batches are summed exactly, while extreme batches use a fixed-segment midpoint approximation to avoid browser main-thread freezes.
- Added the Infinity layer with log-space score tracking past JavaScript's normal number range, first-Infinity auto reset, repeatable manual Infinity, IP, Infinity Upgrades, three starter Infinity Challenges, Break Infinite Cap, and Infinite Angle conversion.
- Verified Infinity flows through Firefox/Playwright: forced first Infinity, manual Infinity, IP upgrade purchases, Infinite Angle conversion, IC completion, Break Infinite Cap, desktop/mobile layout screenshots, and no console errors.
- Fixed Infinity review issues: forced first-Infinity resets now abort remaining vertex processing in the current update, and purchases above e308 preserve `scoreLog10` instead of collapsing back to JavaScript's saturated number value.
- Redesigned the UI toward a Revolution Idle-style layout: normal upgrades and core stats on the left, The Angle in the center, Generation/Core Boost in a bottom reset dock, and Infinity systems on the right.
- Verified the new layout with desktop and mobile screenshots plus button-path checks for normal upgrades, Generation, Core Boost, Infinity upgrades, Infinite Angle conversion, and Infinity Challenge start.
- Added Revolution Idle-style right-side tabs for Infinity, Help, and Settings; Settings now includes saved display toggles for floating text, lightweight effects, and detailed numbers.
- Gated Infinity Challenges behind at least one Infinity and corrected old save data that had an active challenge before Infinity.
- Polished side tabs closer to Revolution Idle: icon+abbreviation labels, LOCKED/READY/OPEN Infinity state, a readiness badge, and an Infinity unlock note.
- Converted the UI to full-screen main tabs: The Angle, Infinity, Help, and Settings now swap the main content area while the tab rail stays persistent.
- Recolored the Angle canvas to an indigo playfield and adjusted figure, point, core, and canvas text colors for dark-background readability.
- Added unit/display settings for language, number format, and time unit, with saved preferences and canvas text localization.
- Added a normal-upgrade Buy All button with speed -> vertex -> gain priority, a 1000-purchase cap, and IC1 vertex-purchase skipping.
- Verified the tabbed UI with Firefox/Playwright on desktop and mobile, including settings persistence, Buy All behavior, IC1 skipping, canvas pixel color, and screenshot/overflow checks.
- Rebalanced Generation rewards toward a longer pre-Infinity path without changing Generation/Core Boost/Infinity thresholds: Generation now uses log-based multiplicative score growth and a gentler cost reduction floor for new progression.
- Changed Infinity Challenge UI from a single next-challenge button to a full IC1-IC3 list. Completed challenges can be restarted, active challenges show a stop action, and locked/pre-Infinity rows are disabled.
- Moved the main tab rail from the left side to the right side on desktop, while keeping the compact mobile layout as a top horizontal tab bar.
- Constrained the desktop Angle tab to a single viewport-height screen and moved the mobile tab bar to the bottom with sticky positioning.
- Compressed the mobile Angle tab into one viewport by using a fixed-height two-row Angle layout, 2x2 upgrade controls, compact Stage header, and two-column Generation/Core Boost dock.
- Fixed settings select controls repeatedly reopening on some browsers by avoiding per-frame option/value rewrites while a select has focus.
- Added `CONTRIBUTING.md` documenting the lightweight stable-main branch strategy, short-lived branch naming, verification checklist, direct-main exceptions, and milestone tag guidance.
- Added Achievements as a persistent reset-proof layer with 8 initial achievements, a shared gain-per-vertex multiplier, the GR multiplier doubling reward for achievement 3, save support, an Achievements tab, and spec documentation.
- Verified Achievements through Firefox/Playwright on desktop and mobile: initial locked list, all-achievement unlock path, reward multipliers, generation multiplier doubling, and no console errors.
- Expanded Infinity Challenges from 3 to 8. IC1-IC5 now follow the supplied draft constraints/rewards, while IC6-IC8 are provisional Revolution Idle-style constraints for lap speed, vertex scaling, and final gain compression.
- Verified the 8-IC list, IC5 Infinity Upgrade scaling, core/generation/IP reward calculations, desktop/mobile Infinity tab rendering, and no console errors through Firefox/Playwright.
- Reworked the Infinity page into a Revolution Idle-style subtab layout with persistent Infinity resources and separate Upgrades, Challenges, and Infinite Angle subpanels.
- Added a pre-Core Boost balance softcap to lap speed: speed behaves normally through ×200, then effective speed scales with the square root of additional raw speed.
- Strengthened Generation score multiplier scaling: raw GR score multiplier now contributes at ^1.15, rising to ^1.25 after IC3, while keeping the existing achievement 3 x2 reward.

## TODO

- Future balance pass: playtest the new Generation formula against the intended 3-4 Core Boost path before first Infinity.
- Future balance pass: tune Core Boost gain multiplier/exponent formulas only if Generation-only tuning is still too fast.
- Future balance pass: tune Infinity Point gain, softcap strength, IC penalties/rewards, and Infinite Angle conversion rates.
- Future design pass: replace provisional IC6-IC8 if the game owner provides official designs.
- Future polish: add explicit import/export save text if players need to move saves between browsers.
