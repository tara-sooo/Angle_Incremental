# UI experience

### EXP-UI-001 — Eternity is a runtime-injected main tab

- Status: superseded
- Superseded by: EXP-UI-002
- Scope: main navigation DOM/layout; `src/ui/render-eternity.js`, `runtime.elements.mainTabs`
- Learned from: Issue #211
- Context: the static navigation in `index.html` did not contain Eternity; the Eternity tab was injected after the Infinity tab during runtime and included manually in `runtime.elements.mainTabs`.
- Cause: the original lesson treated Eternity's feature-specific runtime injection and `.eternity-main-tab` class as a special case that future navigation work merely needed to remember.
- Historical lesson: navigation-wide UI changes had to inspect the runtime tab collection and the Eternity injection path because querying only static `.main-tab` elements missed Eternity.
- Why superseded: later work showed that preserving this special case was itself the architectural problem. Eternity has the same semantic role, visibility behavior, active state, keyboard behavior, and runtime collection membership as every other main tab, but it did not participate in the shared `.main-tab` contract. This allowed common fixes to miss Eternity.
- Last verified: 2026-08-31

### EXP-UI-002 — Shared semantic roles must use the shared UI contract

- Status: active
- Scope: shared UI components; runtime-injected DOM; main navigation; visibility/active/accessibility behavior; feature-specific CSS
- Learned from: PR #165; Issue #267; PR #270; post-#270 Eternity visibility regression
- Context: Eternity started as a feature-specific Infinity subtab and was later promoted to a first-class main tab in the 0.12.1 UI hotfix. The implementation retained the feature-specific injection/styling pattern: the generated button used only `.eternity-main-tab`, duplicated the normal `.main-tab` CSS, and was manually inserted into `runtime.elements.mainTabs`. Later, #267 fixed hidden-tab rendering with `.main-tab[hidden] { display: none; }`. That common fix corrected ordinary main tabs but did not apply to Eternity because Eternity still used only `.eternity-main-tab`, so an undiscovered Eternity tab could remain visibly rendered.
- Cause: a feature-specific implementation detail was promoted together with the feature instead of migrating the element onto the existing shared component contract. Runtime injection was treated as a reason to replace the shared base class rather than as an implementation detail orthogonal to the element's semantic role.
- Reusable lesson: when an element belongs to a shared semantic collection and is expected to obey the same state, visibility, interaction, layout, and accessibility rules, it must participate in the same shared UI contract whether it is static or runtime-injected. Feature-specific classes may extend a shared base class when genuinely necessary, but must not replace it or duplicate the shared component's full styling/behavior. A dynamic main tab should therefore use the shared main-tab contract (for example `main-tab` plus an optional narrowly scoped feature class), rather than requiring every future navigation change to remember a parallel implementation.
- Verification: for a changed shared UI surface, enumerate the runtime collection and confirm every member carries the shared base contract; verify common hidden/visible, active, keyboard/focus, and responsive behavior applies to all members; inspect feature-specific CSS for copied shared component rules; and use rendered browser assertions rather than only DOM properties. For main navigation specifically, a common visibility rule such as `[hidden]` handling must affect every element in `runtime.elements.mainTabs`, including runtime-injected entries. Browser fixtures that navigate to a runtime-created tab must establish its legitimate unlock condition first, so a hidden-rendering regression cannot be masked by clicking a tab that should be unavailable.
- Authoritative at: not yet promoted
- Last verified: 2026-08-31
