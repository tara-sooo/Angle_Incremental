# Angle Incremental UI contract

This is the canonical UI contract for the 0.13.0 work landing on `next`.
It defines shared roles and ownership so feature work can extend one interface
instead of inventing a page-specific layout contract.

The contract governs hierarchy, information priority, responsive behavior,
interaction, accessibility, and player-facing state. It does not prescribe a
theme, copied assets, exact layouts, or feature balance.

## Screen contract

- The screen is the default grouping surface. Use spacing, typography,
  headings, alignment, restrained dividers, compact rows, action groups, and
  state accents before adding a bordered or filled card.
- Color communicates action or state. Purchasable, selected, completed,
  destructive, disabled, active, and unavailable states must remain legible;
  color is not a reason to fill every row with a large gradient.
- Each ordinary page has one declared primary vertical scroll owner. The page
  surface owns normal document scrolling on desktop and mobile. Horizontal
  navigation and genuinely spatial controls may own horizontal scrolling, but
  must not create a competing vertical scroll contract.
- Responsive layouts preserve gameplay meaning and information priority.
  Spatial trees remain spatial, and horizontal pan/scroll is preferred over
  destroying topology when topology carries meaning.
- Main navigation and short subtab groups use their available rail
  deliberately while retaining compact identities, usable touch targets, and
  horizontal reachability on narrow screens.
- High-frequency gameplay actions should not require unnecessary travel into an
  information-only tab. A feature Issue owns the exact relocation or action
  surface; this contract establishes the navigation principle only.

## Shared roles

The following hooks are the shared vocabulary. Existing feature classes may
extend a role, but must not replace it or copy the role's complete behavior.

| Role | Canonical hook | Ownership/invariant |
| --- | --- | --- |
| Page | `.ui-page[data-scroll-owner="primary"]` | One primary vertical scroll surface for the active screen. |
| Main navigation | `.ui-main-nav` with `.ui-scroll-x` on its scroll host | Compact main tabs stay in one reachable horizontal strip. |
| Subtab strip | `.ui-subtab-strip.ui-scroll-x` | Equivalent subtab controls share target, focus, active, and horizontal-scroll behavior. |
| Section | `.ui-section` or existing `.dense-section` | Group by hierarchy and spacing; avoid redundant nested boundaries. |
| Dense row | Existing `.dense-row` | Keep label/value alignment and readable state emphasis. |
| Action row | `.ui-action-row` or existing `.dense-action-row` | Group related actions without making each action a dominant card. |
| Purchase row | Existing `.upgrade-row` | Prefer `name | level/effect | cost | action` information order. |
| Tree | `.ui-tree` | Preserve spatial relationships and provide controlled horizontal space where needed. |
| Tree node | `.ui-tree-node` | Keep identity, cost, and state compact; move long detail to the selected surface. |
| Selected detail | `.ui-selected-detail` | Make the selected identity and primary action easy to reach. |
| Playfield | `.ui-playfield` | Keep the CSS display box and canvas backing geometry intentional and consistent. |

`.ui-scroll-x[data-scroll-owner="horizontal"]` is a horizontal-only
exception. It uses `overflow-x: auto` and `overflow-y: hidden`; it never
becomes the page's vertical owner.

## State and interaction contract

- Shared controls keep keyboard focus visible and retain practical touch
  targets. Disabled controls communicate inoperability through more than color
  alone.
- Equivalent actions use the same concise verbs and state vocabulary across
  systems. Player-facing UI shows final values and decisions, not routine
  implementation diagnostics.
- Routine purchase rows use the shared compact vocabulary. `Buy All` belongs
  in a compact section action area rather than becoming another dominant card.
- Tree nodes are materially smaller than detail surfaces when their content
  allows it. Descriptions, formulas, prerequisites, and current-effect detail
  belong in the selected detail surface.
- Help uses one topic-selection model and one focused content surface. Its
  progression-aware visibility and scroll behavior follow the page contract.
- Borders are reserved for meaningful selection, active/action state, danger,
  focus, and major structural boundaries. Prefer spacing or one divider over
  nested boxes.

## Responsive and language contract

- Desktop and mobile keep the same information priority: resource/state, core
  action, then supporting information. Repositioning is allowed; silently
  changing what is primary is not.
- Main navigation and subtabs may scroll horizontally. Tree surfaces may pan
  horizontally when that preserves topology. Ordinary page content remains
  vertically reachable through the page owner.
- ANGLE and Infinite Angle playfields use an explicit responsive geometry
  contract. A feature-owned geometry change must keep CSS dimensions and
  canvas backing-store dimensions in agreement, including device-pixel-ratio
  handling.
- Japanese and English remain usable for the same UI roles, actions, states,
  and progression visibility.

## Verification contract

Representative browser checks must inspect rendered outcomes at desktop and
mobile viewports, not only classes or internal state. At minimum, verify:

- static and runtime-injected members carry their shared role;
- the active page declares exactly one primary vertical owner;
- horizontal navigation is reachable without vertical overflow;
- controls retain focus/touch behavior and hidden members leave layout;
- tree/detail/playfield roles preserve their rendered boundaries;
- expected content reaches the viewport and `window.render_game_to_text()`
  remains available;
- console and HTTP errors remain empty.

## Foundation boundary

Issue #298 establishes this document, the shared role hooks, and the base
ownership/primitive CSS. It does not implement every violation that motivated
the contract. Feature-specific migrations remain bounded follow-up Issues:

- #299 ANGLE/IA hierarchy and action-color refinement;
- #300 navigation-width balancing;
- #301 Help information architecture and scrolling redesign;
- #302 challenge wording and completion summaries;
- #303 shared prestige-action placement;
- #304 playfield geometry;
- #305 Timeline/IU tree density and topology layout;
- #306 cross-screen scroll, border, and responsive migration.

Those Issues must consume these roles and preserve this contract. Gameplay,
balance, save, progression, and unlock semantics are outside this foundation.
