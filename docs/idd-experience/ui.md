# UI experience

### EXP-UI-001 — Eternity is a runtime-injected main tab

- Status: active
- Scope: main navigation DOM/layout; `src/ui/render-eternity.js`, `runtime.elements.mainTabs`
- Learned from: Issue #211
- Context: the static navigation in `index.html` does not contain Eternity; the Eternity tab is injected after the Infinity tab during runtime and is included in `runtime.elements.mainTabs`.
- Cause: querying only the static `.main-tab` elements misses the dynamically created `.eternity-main-tab`.
- Reusable lesson: navigation-wide UI changes and browser checks must inspect the runtime tab collection and the Eternity injection path, then place dynamic Eternity inside the same scrolling host as the static tabs.
- Verification: run `npm run test:browser` and confirm the desktop/tablet/mobile navigation assertions include `data-tab="eternity"` and keep all non-SET tabs inside `.main-tab-scroll`.
- Last verified: 2026-08-23
