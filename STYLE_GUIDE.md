# Mountain Mogul style guide

How the game looks, reads and behaves, so new work matches what's already there. It describes the game as it
is. When something new doesn't fit, follow this guide, or change the guide on purpose and say why in your
handoff note. Exact values live in `index.html`: `:root` for colours and fonts, `BM` for materials, `BTYPES`
for buildings. Use those rather than copying numbers.

## 1. Overall feel

A **painted trail map that comes alive**: a bright winter day on a mountain, seen from above at an angle.
- Clean, calm and friendly. A tycoon game for everyone, not a technical simulator.
- Low-poly 3D with soft light and long shadows. Snow is the canvas, and everything else is colour on it.
- The interface floats over the map in frosted-glass panels. The mountain is always the star.
- Show, don't tell: people, lifts, lights and labels on the map explain things before any text does.

## 2. Colour

Defined as CSS variables on `:root`. Use the variables, never raw hex values in new CSS.

| Token | Value | Use |
|---|---|---|
| `--ink` | `#14243a` (deep navy) | Main text, selected chips and toggles, dark toasts |
| `--ink-2` | `#51627a` | Secondary text, help lines, labels |
| `--panel` | `rgba(247,250,254,.86)` | Frosted panel background |
| `--line` | `rgba(20,36,58,.12)` | Borders and dividers |
| `--accent` | `#df562c` (warm orange-red) | The main action on screen, brand highlight, "new" badges |
| `--accent-soft` | 12% accent | Gentle accent backgrounds |
| `--green` `#2c9a55` · `--blue` `#2565d4` · `--black` `#1a1e26` | | Trail ratings (and only that, plus "on" states for green) |
| `--steep` | `#b8402f` | Danger, errors, "too steep", remove buttons, bad toasts |
| `--sky-1` / `--sky-2` | light blues | Backgrounds behind the map |

Rules:
- **One orange thing per view.** The accent marks the single most important action (Build, Open for the day,
  Publish). Everything else is navy, grey or white.
- **Ratings use the North American signs and their colours:** green circle, blue square, black diamond, double
  black diamond (`ratingSymbol()`). Never use those colours to mean anything else.
- Status pills: on = green tint, off = red tint, slow or warning = amber tint (`.pill.on/.off/.slow`).
- Light theme only (`color-scheme: light`). There's no dark mode. Night is shown in the 3D scene, not by
  restyling the interface.
- Lift colours come from `LIFT_COLORS`; each building type has its own `accent` in `BTYPES`. Reuse those for
  icons, swatches and label dots so a thing keeps one colour everywhere.

## 3. Type

Two fonts, loaded from Google Fonts:
- **Big Shoulders Display** (`--display`, weights 700/800/900): a tall, condensed, outdoorsy display face.
  Uppercase. Use it for panel titles (`.sheet-title h3`, 24px, weight 800), the resort name badge, cash,
  big numbers (rank, podium values) and the wordmark. Never for sentences.
- **Figtree** (`--ui`, 400–700): everything else. Body is 13.5–15px. Help text is 13.5px `--ink-2`, line-height 1.45.
- **Small caps labels:** field labels (`.field-label`) and key/value terms (`.kv dt`) are 10.5–11px, weight 700,
  uppercase, letter-spacing 0.07–0.08em, `--ink-2`.
- **Numbers:** use `font-variant-numeric: tabular-nums` (`.num`) anywhere numbers line up or change.
- The wordmark is "MOUNTAIN" in navy over "MOGUL" in accent, both in Big Shoulders.

## 4. Interface building blocks

Reuse these; don't invent new kinds of control.
- **Panel** (`.panel`): frosted glass. Panel colour, 1px `--line` border, 14px corners, soft navy shadow,
  `backdrop-filter: blur(12px)`.
- **Side sheet** (`#sheet`): the main detail and build panel, 300px wide on desktop, a bottom sheet on phones.
  Order: title row (swatch or icon, name, ✕) → one help line → key facts (`.kv`, two columns) → choices →
  costs (`.costs`) → main button → secondary links → a red "Remove…" link last.
- **Buttons:** `.btn` is the accent button (11px corners, bold, soft orange shadow), used once per view.
  `.btn.secondary` is grey; `.btn.danger` is steep red, inside a confirm only. `.link` is underlined text for
  minor actions.
- **Choices:** segmented control (`.seg`) for 2–5 options of one setting, with an optional `<small>` second
  line per option. Chips (`.chip`, pills) for filters and quick toggles. Switch (`.switch` in a
  `.toggle-row`, with a bold title and grey explanation) for on/off settings. Tabs (`.btabs`) for whole
  sections of a menu.
- **Map labels** (`.flabel`): small white pills on the map with a colour dot or icon, the name, and a live
  count (`<b>12</b> skiing`).
- **Toasts:** dark navy pills at the bottom centre with one sentence, and optionally one white action button.
  Red (`.bad`) for problems.
- **Spacing:** sheets use 12px gaps between blocks; corner radii are 10–14px for panels and inputs, 999px
  for pills and chips.
- **Phones:** 640px is the breakpoint. Panels become bottom sheets; rows of chips scroll sideways rather than
  wrap; touch targets are at least about 30px tall. Check 390×844 for anything new.
- **Motion:** short and gentle (about 0.15–0.25s). Anything that loops (pulses, bobs) must stop under
  `prefers-reduced-motion`.

## 5. Icons

- **Line icons on a 24-unit grid**: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`,
  `stroke-width="1.8"`, round caps and joins. Simple and recognisable at 18–20px. Match the toolbar and
  Manage bar icons (Explore, Trail, Lift, Buildings, Landscape) and the building icons in `BICON`.
- Draw the real object from the side or front (a lodge, a fork and knife, a ski jacket with a cross), not
  an abstract symbol. If a player wouldn't guess it, redraw it.
- In menus, icons sit in a 34px rounded tile tinted with the thing's own colour (see `.bpick i.bi`).
- No emoji in the interface. The trail-rating shapes come from `ratingSymbol()`.

## 6. The 3D world

- **Scale:** 1 world unit = 10 m (about 33 ft; `FT_PER_UNIT`). Heights are shown at 2× (`VEX`), like a painted map.
  People, chairs and buildings are at true size within that.
- **Light:** a warm sun (`#fff3e2`) and a cool sky fill (`#d6e4ff`), with soft shadows and a pale haze in the
  distance. At dusk the scene darkens and warm points of light take over (lamps, windows, fire pits, lot poles),
  drawn through the light map (`drawLightMap`).
- **Terrain and snow:** pale blue-white snow; groomed trails show corduroy stripes; bare ground is a muted
  brown-grey; trails are tinted at their edges by rating. Trees are low-poly evergreens in muted greens with snow.
- **Buildings:** low-poly and chunky, readable from far away.
  - Built from `Kit` parts (`hall`, `door`, `sign`, `deck`, `picnic`, `skiRack`) and shared `BM` materials.
    No new textures without a good reason.
  - Snow on every roof.
  - A sign with the building's word on its colour (`sign()`).
  - Windows always use `BM.glow`: glass by day, lit or dark after dusk, and they throw light on the ground.
  - Doors face the front (+z before rotation); guests walk to the door.
- **Themes** (`THEMES`):
  - **Classic:** log lodges and chalets, warm browns, stone bases.
  - **Modern:** flat or shed roofs, big glass, dark metal with wood.
  - **Scandinavian:** steep narrow gables in painted red, mustard, blue and green, with pale trim.
  A themed model must match the classic one's footprint, seats (same count and order), door and sign.
- **People:** tiny figures in bright jackets. Staff wear their uniform colours (patrol red, school green).
- **Placement feedback:** green footprint means OK, red means a problem; the ghost model sits where it will be built.
- **Decor** (trees, benches, lamps, fire pits) places with a tap and repeats; keep new decor small and cheap.

## 7. Writing

Players are curious, not technical. Write like a friendly resort manager talking to a friend.
- **Plain words, no code or jargon.** Say "skiers", "lift line", "base area", "overnight", "Open for the day".
  Never say "agent", "tier", "node", "spawn", "config" or "null".
- **Numbers that mean something:** "120 seats", "$45,000", "8 min wait", "2,300 ft". Use `money()`, `inch()`,
  `fmtFt()`, and round sensibly.
- **US English**, with curly quotes and apostrophes (’ “ ”). A middle dot ( · ) separates short facts on one line.
- **Sentence case** for buttons and labels ("Build a lift", "Grow the main lot"). Uppercase only via CSS for
  titles and small caps labels.
- **Fixed patterns** (reuse these word for word):
  - Main button: `Build · $45,000`; `Plan it · $45,000` while open; `Need $40,000 more` when short.
  - Toast after an action: `Built Timber Lodge · −$45,000`; a problem toast says what to do next.
  - A problem: say what's wrong and how to fix it in one sentence ("Start the trail at the top of a lift, or
    on another trail.").
  - Empty states: what it is, and the first step ("No trails yet. Build one with the Trail tool: …").
  - Remove: `Remove this lodge`, then a confirm that states the refund.
  - Theme fallback: `Classic look only`.
- **Guests' thoughts** are first person, short and human: "Loved Gemini!", "The lift line took forever."
- **What's new entries:** one plain sentence per change, written for players, starting with what they can do now.
  Fixes start with "Fixed:".

## 8. How things behave

Consistency players can rely on:
- **Building happens overnight.** While the resort is open, anything drawn becomes a blueprint, built in order
  when there's cash. Tools explain this rather than silently doing nothing.
- **Never grey out for money.** Players can always plop, preview and plan what they can't afford; only the
  final Build button waits for cash.
- **Undo** (Ctrl+Z, or the toolbar) covers every build, removal and paint stroke.
- **Removing** returns 25% (salvage). **Moving** costs a fee, much less than rebuilding. **Purely visual
  changes** (themes, a fire pit's stone base, names) are free.
- **Everything has a name** (dice button to reroll), a panel when tapped, and a map label.
- **Anything that costs or earns shows up** on the day report, and if it's a common mistake, in What next?
  with a button that goes straight to the fix.
- **Defaults are safe and friendly:** new things start open, signed, sized for beginners, and explained.
- **Saves never break.** New fields are optional and older saves load with sensible defaults
  (`tests/scenarios/32-old-saves`).
- **Visiting** another resort is read-only; every action checks `visiting`.

## 9. Before you ship

Follow the release checklist in `AI_HANDOFF.md`: tests, What's new, guide and roadmap, a preview link for
Phil, and publish only when Phil says "Publish". If your change bends this guide, update the guide in the
same branch.
