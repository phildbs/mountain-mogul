# AI handoff: Mountain Mogul

A shared notebook for the AI assistants working on Mountain Mogul (Claude and ChatGPT). Read it before
substantial work; update it after meaningful work or an important discovery. Keep it short: replace stale
facts rather than appending to them, and trim old notes once they stop mattering. Full history is in git
(`git log -p AI_HANDOFF.md`).

> This repository is public and GitHub Pages serves it, so this file is readable at mtmogul.com/AI_HANDOFF.md.
> Never put keys, passwords, private player data or anything else sensitive here.

## Project overview

**Mountain Mogul** is a browser ski-resort tycoon game at https://mtmogul.com, made by one person (the
owner, Phil) with AI help. Players clear trees, cut trails, build lifts and buildings, and run a resort
through a simulated winter, day by day. Free to play, no install, works on phones.

**Architecture**
- `index.html` (about 18,000 lines) is the whole game: HTML, CSS and one script. three.js r128 and
  supabase-js live in `vendor/`. There is no build step; GitHub Pages serves `main` as is.
- Other pages: `guide.html` (player's guide), `roadmap.html` (public roadmap with votes), `stats.html`
  (the owner's dashboard: players, retention, invited players, errors, feedback), `privacy.html`.
- Supabase backend (accounts, cloud saves, leaderboards, visits, likes, staff picks, feedback, crash
  reports, roadmap votes, referrals, retention). Schema and functions are in `supabase/*.sql`. The publishable
  key in `index.html` is meant to be public; the `service_role` key must never enter the repo.

**Major systems in `index.html`**
- Terrain: each mountain in `MOUNTAINS` (`maple`, `juniper`, `raven`, `twin`; plus player-designed custom
  mountains) defines `height(u, v)`, road, creek, lots and weather. Grids `HT` (height), `GR` (slope) and
  `ROADD`/`CREEKD` (distance fields) back placement checks.
- Building: trails (`evalTrail`/`commitTrail`, rated green/blue/black/expert by steepness; editable overnight),
  glades (`world.areas`, `kind: 'glade'`), lifts (`LIFT_TYPES`, `evalLift`/`commitLift`, `liftLayout`), buildings
  (`BTYPES`, `evalBuilding`/`commitBuilding`, whole-degree rotation), themes (`THEMES`: classic/modern/scandi),
  parking (`lotLayout`, several lots on Twin Notch), land parcels, blueprints (plans).
- Network: `computeNetwork` joins trails to lifts. `t.to.kind` is `'lift'`, `'top'`, `'trail'` or `'base'`.
  Walk and glide transfers link nearby lift stations; glade lines are hidden trails with `virtual: true` and
  `glade: <id>` (learning-area lines are `t.virtual && !t.glade`).
- Simulation: `simStep(dt)` runs the day. Each guest agent stands for `AGENT` real guests. Guests arrive by
  car or bus, choose lifts and trails by ability, eat, warm up, rest, get hurt, cross between bases (Twin Notch),
  and go home. Ski patrol huts have 1–6 patrollers who ride real lifts home. The day ends in a report
  (`state.lastReport`), with advice in What next? (`advice()`) and on the report (`adviceFor`).
- Business: prices, passes, operations plans (weekday/weekend/quiet, editable on building and lift cards),
  events, après and night skiing, snowmaking, loans, payroll and upkeep (`planCosts`), injury claims, goals.
- Saves: localStorage per mountain slot (up to 5 mountains), plus cloud saves for signed-in players, with a
  scenic photo per resort. Old saves must keep loading (see Testing).
- Online: leaderboards, Browse, creator pages, visiting other resorts (read-only), likes, staff picks,
  friend invitations ($100k per qualifying friend, up to 3).

**Development philosophy**
- Plain, friendly language for players. No jargon, and every number means something to a player.
- Show, don't tell: check changes in the real game on phone and desktop.
- Small, safe releases to a live audience; never break existing saves.
- The owner decides what ships. Ideas come from player feedback (stats page, roadmap votes) as much as
  from us.

## Current status (updated 2026-10-30)

**Live: 2.64.1.** Phil approved publication; full GitHub Tests run 41070756026 passed on candidate `f837deccac4b071c5035dff3b5f1a95f61e46fb4`.

**Recently shipped** (newest first; older releases are in `CHANGES`)
- 2.64.1: faster busy days after a Firefox player's report (Skip no faster than 4×). One guest object shape makes a
  busy day about 2.4× faster with identical results; mid-day saves about 40% smaller; big saves autosave every 45 s.
- 2.64: Business → Reputation (More on phones): current score, actual daily gains/losses, 14-day trend and recent changes including overnight borrowing. Older scores retained without invented causes.
- 2.63.1: one rescue coverage reputation penalty, proportional to missed rescues and capped at 0.05 per day; no extra glade or claim penalty. Reports explain coverage and actual loss.
- 2.63: optional saved Friday weekend-plan default in Operations; active text editors retain focus across card updates and take priority over hotkeys. Guide and regression scenario 109 updated.
- 2.62.6: injury claims only follow missed help or long rescue waits (pickups within 30 game-minutes are safe).
- 2.62.5: smarter lift choices: returning skiers compare base lifts, nearby summit lifts share trail entrances,
  ride time and lift speed count.
- 2.62.4: privacy policy link on the title screen and in the menu; updated disclosures.
- 2.62.3: clearer rotate buttons (they turned the wrong way before).
- 2.62.1–2.62.2: food-truck takeaway then a warm-up stop; compare nearby food stops before queuing.
- 2.62: movable, collapsible map cards. 2.61: fine rotation and confirmed bench/table placement.
- 2.60: edit operating plans on building/lift cards; lift colours. 2.59: reliable lunches, price-cut retries.
- 2.58.x: one ski patrol choice with 1–6 patrollers, fair payroll. 2.57.x: unit toggles, night closing, routing.
- 2.47–2.56: Twin Notch, themes, glades, trail editing, invitations, scenic resort photos, venue breakdowns.

**Active**: terrain park builder preview branch awaiting tests and owner review; live remains 2.64.1.

**Upcoming / candidates** (owner to prioritise)
- Decorations (roadmap card "More decorations"): trail map boards, billboards, statues, fountains, flags,
  snowmen, an entrance arch. Also the special decoration earned for 3 invited friends (milestone is saved;
  design deferred by Phil).
- Trail/glade popularity report, split by day and evening, with reasons (requested, not built).
- Custom mountain fixes, so creation can be turned back on (`CUSTOM_OFF`).
- New-player onboarding, and a pass over logged errors on the stats page.
- Roadmap ideas added by Phil: skier obstacle avoidance, paintable base areas (real walkable zones),
  lift mid-stations.

## Work in progress

One row per active branch, so nobody edits the same thing at once. Remove the row when it merges.

| Branch | Who | What | Started |
|---|---|---|---|
| feature/terrain-parks-preview | ChatGPT | Grounded park models and Trails → Trail Features on-map placement with confirm; awaits visual and full-suite testing | Oct 30 |

## Terrain park menu and lateral placement follow-up (Oct 30)

- Replaced text-heavy Trail Features picker with compact two-column icon/name/price grid.
- On-map placement records lateral offset from the exact tap position instead of snapping all items to trail centerline; leaves a footprint clearance from the trail edge. Existing confirmation and ghost preview retained.
- Still no guest interaction or feature-linked operating expenses: needs approach/exit trigger, safe bypass routing, short animations, testing, and balance/reporting. Await owner review and full GitHub tests; do not publish.

## Terrain park slope/placement update (Oct 30)

- Trail feature choices moved from individual trail cards to Trails → Trail features. Select a feature, tap a valid trail, inspect the translucent preview, then Confirm to pay and build. Trail cards retain designation toggle and editing/removal for installed features.
- Models now use four-corner terrain height sampling and a slope-aligned basis; embedded snow features have a lower grounding offset, while rails/boxes remain level with the averaged slope rather than isolated bumps.
- This is a gameplay/placement change requiring full GitHub suite, old-save regression and phone/desktop visual review. Pause for Phil to report test results; do not publish without his approval.

## Terrain park visual refresh (Oct 30)

- New shared `park-models.js` provides six polished feature meshes in both the game and `park-model-viewer.html`: shaped snow kickers/tabletops/roller, metal box, and continuous tube rails.
- No park placement, save, cost, guest movement, or business changes in this visual-only pass. New file loads before the game main script.
- Need phone/desktop visual verification and GitHub suite results from Phil. **Do not publish until he approves.**

## Terrain park preview scope

- Any nonvirtual trail can be designated a terrain park in its card, regardless of placed objects. Toggling designation off keeps features.
- From a trail card while closed, add a roller, box, small jump, straight rail, rainbow rail or tabletop. Controls move the selected object uphill/downhill/laterally or rotate it by 15 degrees. Construction costs deducted, save data persisted in per-trail fields.
- This is an initial placement preview, not the full terrain park simulation: direct map plopping, ghost/confirmation placement, skier feature animations, visitor demand, maintenance and park-specific reporting still need follow-up before claiming full feature delivery.
- Do not publish without Phil approving after GitHub's green tests. Follow the usual pause policy.

## Known issues

- Test `22-topbar` is flaky (fails about 1 in 3 runs at 900 px wide, on `main` as well). Not investigated.
- Custom mountain creation is disabled (`CUSTOM_OFF = true`): Gentle/Easy settings could still make
  cliffs. Existing custom mountains still play.
- Twin Notch has mostly been played in automated runs; watch feedback for balance and pathing.
- `index.html` is one large file. Search by function name rather than line numbers; they move.
- The title-screen "New mountain" flag (`NEW_MTN`) switches itself off on Dec 15, 2026.
- Stray screenshots from Oct 18 are committed in the repo root (`mb-*.png`, `mbp-*.png`, `tc-*.png`) and
  are served publicly. Probably safe to delete; ask the owner first.
- Two scenarios share number 84 (`84-lunch-lots`, `84-movable-trails`). Use the next free number for new tests.
- A lit trail made longer by Edit route keeps its old `litCost`, so the extra lights are free.
- Invitations can't detect fake accounts or made-up day reports (the simulation runs in the browser).
- Dev-only model previews float (`heightAt` is multiplied by `VEX` twice). Not player-facing.

## Development guidelines

**Before starting**
- Read `STYLE_GUIDE.md` for colours, fonts, interface parts, icons, 3D art, writing and behaviour rules.
  New work must match it, or update it on purpose.
- Read this file and check recent commits on `main` and open branches (`git log origin/main`,
  `git branch -r`). The other assistant may be mid-change in another conversation.
- Discuss major architecture, feature or disruptive changes with the owner first.

**Making changes**
- Work on a branch, never directly on `main`. One topic per branch.
- Match the surrounding code: short names, terse comments that explain why, no new libraries or build
  steps without the owner's say-so.
- Every release bumps the top entry of `CHANGES` in `index.html` (that is the version). Fixes use
  `small: true`. Update `guide.html` when gameplay changes, and `roadmap.html` cards when a roadmap item ships.
- Database changes are additive only (new tables, columns or functions); put the SQL in `supabase/`. If the game
  needs new SQL, install it on the live database before publishing the game.

**Testing**
- `cd tests && npm install && node run.mjs <names>` runs scenarios in headless Chromium against a fake
  Supabase (`tests/fake-supabase.js`); nothing touches the real database.
- Run only the scenarios that cover your change, plus screenshots (phone 390x844 and desktop) for anything
  visual. GitHub runs the full suite on every push that touches the game.
- Add or update a scenario in `tests/scenarios/` for new behaviour. Add `32-old-saves` whenever saves or
  loading change.
- Keep slow visual captures behind `SHOTS=1` (or a separate script) so the GitHub run stays quick.
- When a test fixture fails to build (e.g. a lift site is too steep), fix the fixture with checked coordinates.
  Don't weaken assertions or change game code to suit a test.

**Releasing** (see `RELEASING.md`)
- Push the branch and show the owner. Merge to `main` only when the owner says "Publish"; that deploys to the
  live site within minutes.
- Rollback: `./tools/rollback.sh <version>` on `main`.
- After a release, watch the stats page for new errors.

### Before asking Phil to publish (checklist)
Work through this on your branch. Report each item to Phil as done, skipped (and why), or failed.
1. **Start from current `main`.** `git fetch origin main` and branch from it, or rebase onto it. Add your branch to Work in progress.
2. **Changelog.** Add a new entry at the top of `CHANGES` in `index.html`; its `v` is the new version.
   - Format: `{ v: '2.49.1', date: 'Oct 29, 2026', title: 'Short title', items: ['Plain sentence for players.', …] }`.
   - Version: minor (2.50) for a new feature, patch (2.49.1) for fixes. Add `small: true` for a fix-only release.
   - Players see this in What's new and in the update banner. The banner reads the top entry's `v` and `title` with a
     regex, so keep that exact shape and keep `CHANGES` inside `index.html`.
3. **Guide.** If gameplay or building options change, update `guide.html` (Buildings list, Themes line, etc.).
4. **Roadmap.** If the work delivers part of a `roadmap.html` card, mark it. A shipped piece stays **Ongoing**, with a
   crossed-off line, e.g. `<ul class="steps"><li class="did"><s>Added: X</s> <span>in 2.49</span></li></ul>`. Only move
   a card to Done if Phil says so. Never change `data-idea` values: votes are stored against them.
5. **Testing, by size of change** (Phil's call; say which tier you're using):
   | Change | Before Publish | Wait |
   |---|---|---|
   | Docs, wording, roadmap, changelog, guide | nothing | none |
   | Quick bug fix | only the related scenarios (run locally, or by hand on GitHub with their names) | 1–3 min |
   | Feature, gameplay, saves, anything big | full suite: wait for the green tick | ~6–10 min |
   The full suite still runs on GitHub after every game change; if it later fails on a quick fix, fix it or roll back.

   **Tests run automatically on GitHub** (Actions › Tests) for every push that touches the game, in a real browser,
   as four groups side by side. A failed scenario gets one retry, so a red cross is a real failure. Before
   asking Phil to publish, check that your latest commit has a **green tick**: on GitHub, in the commit list or the
   branch page, or with `gh api repos/phildbs/mountain-mogul/commits/<sha>/check-runs`. If it's red, open the
   run's log, fix the failing scenario and push again. Don't ask Phil to publish a red branch. To run the slow
   balance check or chosen scenarios, use Actions › Tests › Run workflow (`all`, or names).
   **While GitHub tests run, tell Phil and pause. Don't poll.** He reports the result and says when to continue.
   Locally, if you can, run `cd tests && npm install && node run.mjs <names>` for the scenarios that cover the change, plus
   `32-old-saves` if saves or loading are touched. Read every line for `FAIL`. A command that just ends with
   `| tail` can hide a failure.
   - For buildings and themes: `18-builder 25-eateries 26-shops 27-services 51-nearest-building 59-bulldoze 54-evenings 82-building-styles 83-themes 32-old-saves`.
   - Add or extend a scenario for anything new.
6. **Check it in a real browser (for your own verification).** Use `openGame(browser, url, { render: true, width, height })` from
   `tests/harness.mjs`. Take phone (390×844) and desktop screenshots, by day and after dark (open a day, set
   `state.time` to about 1000). Place buildings with `evalBuilding` + `commitBuilding`, so they sit on a levelled pad,
   not floating. **If you can't run Chromium, say so plainly**: Phil or Claude must check the visuals before
   publishing. A geometry check alone isn't enough.
7. **Push the branch and send Phil a preview link.** Send a short summary, the test results and a link he can play:
   `https://raw.githack.com/phildbs/mountain-mogul/<commit-sha>/index.html`. Use the full commit SHA, not the branch
   name: branch links can serve an older version for a few minutes after a push. Phil prefers a link over lots of
   screenshots. Send screenshots only when they show something specific, or when you've checked visuals yourself.
   Tell Phil, with every preview:
   - play as a guest, without signing in (signing in can redirect to mtmogul.com, and could sync his real online saves);
   - the preview keeps its own saves, separate from mtmogul.com, so his resorts won't be there;
   - feedback, crash reports and roadmap votes sent from the preview still go to the live database.
   Then update this file: Current status and your note.
8. **Publish only when Phil says "Publish".** Fast-forward `main` (`git merge --ff-only <branch>`) and push. GitHub
   Pages deploys in a minute or two. Then move the work to Recently shipped here and clear Work in progress.
9. **After release,** check `mtmogul.com/stats.html` for new errors. If something broke, roll back with
   `./tools/rollback.sh <version>` on `main`.

### Adding buildings or themes
- **New theme models for existing types:** write model functions with a `Kit`, like the modern and Scandinavian sets.
  - Match the classic model's seats (`k.seat`, same count and order), door position (`door`) and sign (`sign`) exactly;
    guests and placement depend on them. Keep within the `BTYPES` footprint.
  - Windows use `BM.glow`. It's coloured glass by day and lit or dark at night, and it throws light on the ground, so
    put it on the outward faces of windows. See-through glass (rails, shuttle) uses `MODERN_RAIL`, not `BM.glow`.
  - Register the models in a registry (like `MODELS_MODERN`), and add or extend the theme in `THEMES`.
  - `themed()`, the menu picker, saving, blueprints and restyling then work automatically.
- **A new theme:** add `THEMES.<key> = { label, note, models }`. Keys are saved with each building (`B.style`), so
  never rename or remove a key once it has shipped.
- **A brand-new building type** is more work. It needs:
  - a `BTYPES` entry (name, where, cost, sizes, upkeep, desc), a classic model in `MODELS`, and its place in `BGROUPS`;
  - `BICON` (a 24-unit line SVG) and `BBLURB`;
  - `capOf` text, and service behaviour (what guests do there).
  Talk to Phil before adding one.
- Decorations are on the roadmap ("More decorations"). Plain decor (`plop` types like bench, tree or lamp) is the
  simplest kind of new type.

## Decisions and lessons

Lasting points from earlier notes. Add to this list rather than leaving them buried in a dated note.

- **Phil's preferences:** preview links over screenshots; pause (don't poll) while GitHub tests run; he says
  "Publish" for each release separately.
- **Splitting `index.html` into files:** proposed by ChatGPT, not started, and Phil hasn't asked for it. Claude's
  view: real cost, no player benefit. If it ever happens, first solve three blockers: the test harness reaches
  internal names through an injected `eval` in the inline script; the update banner reads `CHANGES` from
  `index.html`; and Pages caching can mix old and new files without a `?v=` on each file and a rollback that
  restores every file. Then CSS first, and reassess.
- **Operations balance (Oct 28):** gutting operations loses money and halves reputation; sensible cuts land
  within noise of running everything. Run-to-run noise is about ±$50k. Not yet checked: big resorts, several
  seasons, and assertions in a slow scenario.
- **Food prices:** a guest who refuses a price only tries that kind of food again after a price cut. At 1.6× food
  prices, food revenue falls by about half; that trade-off is intended.
- **Friday plans:** `state.ops.fridayWeekend` defaults off in old saves; `defaultPlanFor` selects the weekend operating plan for Fridays, including quiet season. Demand and ticket pricing still use the calendar. One-day overrides take priority, except event days always use weekend; open-day snapshots remain unchanged.
- **Text editors:** `renderSheet` defers updates to the same card while an editor is focused, then refreshes after blur. Preserve this protection alongside the composition and text-input hotkey guards.
- **Reputation tracking (2.64):** use `changeReputation` for future score changes; it records actual post-limit changes without altering balance. Optional saved `clock.repLog` holds up to 120 events; optional report `repDay` stores settlement start/end/causes. Overnight borrowing is logged separately. Panel history uses the existing last 14 reports; legacy scores keep their value without invented causes. In browser tests, uppercase CSS changes `innerText` labels; check source labels with `textContent` and visible numeric values separately.
- **Rescue reputation (2.63.1):** one `0.05 * missed / injured` penalty per day, using de-duplicated missed rescues; no extra glade or financial-claim loss. Before the first hut remains protected. Optional report `rescueRep` stores coverage, limit and actual before/after loss at the reputation floor; report points are 100 times the internal factor. Satisfaction remains separate. Historical reputation and old reports are not rewritten.
- **Injury claims:** come from missed help or slow pickups only, not from severity or glades on their own.
- **ChatGPT's environment** has no local Chromium, so it relies on the GitHub run. It once pushed a truncated
  `index.html` through its connector: after pushing, compare the GitHub file's blob SHA with your local copy.
- **Feedback investigations** may read players' public saves, but keep player details out of the repo.
- **Simulation speed (2.64.1):** the biggest cost was guests gaining properties at different times (84 object
  shapes by noon), which makes every property read slow in V8 and SpiderMonkey. `makeGuest` now declares
  late fields as `undefined` (reads the same as missing, and JSON skips it): one shape, a full busy day about
  2.4x faster with identical results. **Add any new per-guest field to that list.** Guests restored from a mid-day
  save still have mixed shapes for the rest of that day. Real public resorts reach 8,000+ guests, 26 lifts and
  110 trails; benchmark with that scale, not the small test resorts. Mid-day saves drop parked cars' road paths
  (rebuilt in `carLeave`) and round guest decimals to thousandths; a save over 1.5 MB autosaves every 45 s
  instead of 15 s. At 4x the day needs about 160 sim steps a second; once a step costs over ~6 ms, 4x and
  Skip run at the same pace, which is what a Firefox player reported.

## AI collaboration notes

Newest first. Start each note with the date and who wrote it. Give findings, recommendations, warnings or
questions, not transcripts. Disagree openly when you think the other assistant is wrong; the owner decides.
Once a note's work has shipped, fold anything lasting into Decisions and lessons and delete the note.

### 2026-10-29 · Claude · Tidied this file
- Phil asked for a tidy-up: the notes had grown to about 600 lines of release logs. I removed the notes for
  shipped work (2.47–2.62.6) and moved what still matters into Current status, Known issues and Decisions and
  lessons. Nothing that's still open was dropped. The full notes are in git history before this commit.
- Corrected the `index.html` size (about 18,000 lines) here and in `CLAUDE.md`.
