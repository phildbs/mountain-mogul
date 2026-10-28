# AI handoff: Mountain Mogul

A shared notebook for the AI assistants working on Mountain Mogul (Claude and ChatGPT). Read it before
substantial work; update it after meaningful work or an important discovery. Keep it short: replace stale
facts rather than appending to them, and trim old notes once they stop mattering.

> This repository is public and GitHub Pages serves it, so this file is readable at mtmogul.com/AI_HANDOFF.md.
> Never put keys, passwords, private player data or anything else sensitive here.

## Project overview

**Mountain Mogul** is a browser ski-resort tycoon game at https://mtmogul.com, made by one person (the
owner, Phil) with AI help. Players clear trees, cut trails, build lifts and buildings, and run a resort
through a simulated winter, day by day. Free to play, no install, works on phones.

**Architecture**
- `index.html` (about 16,000 lines) is the whole game: HTML, CSS and one script. three.js r128 and
  supabase-js live in `vendor/`. There is no build step; GitHub Pages serves `main` as is.
- Other pages: `guide.html` (player's guide), `roadmap.html` (public roadmap with votes), `stats.html`
  (the owner's dashboard: players, errors, feedback), `privacy.html`.
- Supabase backend (accounts, cloud saves, leaderboards, visits, likes, staff picks, feedback, crash
  reports, roadmap votes). Schema and functions are in `supabase/*.sql`. The publishable key in
  `index.html` is meant to be public; the `service_role` key must never enter the repo.

**Major systems in `index.html`**
- Terrain: each mountain in `MOUNTAINS` (`maple`, `juniper`, `raven`, `twin`; plus player-designed custom
  mountains) defines `height(u, v)`, road, creek, lots and weather. Grids `HT` (height), `GR` (slope) and
  `ROADD`/`CREEKD` (distance fields) back placement checks.
- Building: trails (`evalTrail`/`commitTrail`, rated green/blue/black/expert by steepness), lifts
  (`LIFT_TYPES`, `evalLift`/`commitLift`, `liftLayout`), buildings (`BTYPES`, `evalBuilding`/`commitBuilding`),
  parking (`lotLayout` sections, several lots on Twin Notch), land parcels, blueprints (plans).
- Simulation: `simStep(dt)` runs the day. Each guest agent stands for `AGENT` real guests. Guests arrive by
  car or bus, choose lifts and trails by ability, eat, rest, get hurt, cross between bases (Twin Notch),
  and go home. The day ends in a report (`state.lastReport`), with advice in What next? (`advice()`) and on
  the report (`adviceFor`).
- Business: prices, passes, operations plans, events (torchlight, race, pond skim), après and night
  skiing, snowmaking, loans, goals per mountain.
- Saves: localStorage per mountain slot (up to 5 mountains), plus cloud saves for signed-in players. Old
  saves must keep loading (see Testing).
- Online: leaderboards, Browse, creator pages, visiting other resorts (read-only), likes, staff picks.

**Development philosophy**
- Plain, friendly language for players. No jargon, and every number means something to a player.
- Show, don't tell: changes are checked in the real game with screenshots on phone and desktop.
- Small, safe releases to a live audience; never break existing saves.
- The owner decides what ships. Ideas come from player feedback (stats page, roadmap votes) as much as
  from us.

## Current status (updated 2026-10-29)

**Recently shipped**
- 2.47: Twin Notch, a second-base mountain: two lots on one valley road, guests choose a lot by the lifts
  they like, village gondola and base shuttle between the bases, stranded-guest handling, report lines.
  Lodges are now separate Small/Medium/Large choices (no upgrades); the transit center is its own building.
- 2.47.1: Browse shows three per shelf with See all, shelf chips and a mountain filter; shorter creator pages.
- 2.47.2: build menu with tabs (Food, Shops, Services, Transport, Decor), line icons, short descriptions
  and "You have N".
- Recent before that: roadmap page with votes and a "new" badge, lift upgrades, sandbox mode, Maple Notch as
  the default first mountain, custom-mountain creation paused.

**Active**: nothing in progress. Claim work in the table below before starting.

**Upcoming / candidates** (owner to prioritise)
- Decorations (roadmap card "More decorations"): trail map boards, billboards, statues, fountains, flags,
  snowmen, an entrance arch.
- Custom mountain fixes, so creation can be turned back on (`CUSTOM_OFF`).
- New-player onboarding, and a pass over logged errors on the stats page (ChatGPT's initial review).

## Work in progress

One row per active branch, so nobody edits the same thing at once. Remove the row when it merges.

| Branch | Who | What | Started |
|---|---|---|---|
| (none) | | | |

## Known issues

- Test `22-topbar` is flaky (fails about 1 in 3 runs at 900 px wide, on `main` as well). Not investigated.
- Custom mountain creation is disabled (`CUSTOM_OFF = true`): Gentle/Easy settings could still make
  cliffs. Existing custom mountains still play.
- Twin Notch is new and has only been played in automated runs; watch feedback for balance and pathing
  (crossings, stranded guests, the West lot).
- `index.html` is one large file. Search by function name rather than line numbers; they move.
- The title-screen "New mountain" flag (`NEW_MTN`) switches itself off on Dec 15, 2026.
- Stray screenshots from Oct 18 are committed in the repo root (`mb-*.png`, `mbp-*.png`, `tc-*.png`) and
  are served publicly. Probably safe to delete; ask the owner first.

## Development guidelines

**Before starting**
- Read this file and check recent commits on `main` and open branches (`git log origin/main`,
  `git branch -r`). The other assistant may be mid-change in another conversation.
- Discuss major architecture, feature or disruptive changes with the owner first.

**Making changes**
- Work on a branch, never directly on `main`. One topic per branch.
- Match the surrounding code: short names, terse comments that explain why, no new libraries or build
  steps without the owner's say-so.
- Every release bumps the top entry of `CHANGES` in `index.html` (that is the version). Fixes use
  `small: true`. Update `guide.html` when gameplay changes, and `roadmap.html` cards when a roadmap item ships
  (shipped items have stayed "Ongoing" with a crossed-off line rather than moving to Done).
- Database changes are additive only (new tables, columns or functions); put the SQL in `supabase/`.

**Testing**
- `cd tests && npm install && node run.mjs <names>` runs scenarios in headless Chromium against a fake
  Supabase (`tests/fake-supabase.js`); nothing touches the real database.
- Run only the scenarios that cover your change, plus screenshots (phone 390x844 and desktop) for anything
  visual. The full suite (`node run.mjs`, about 15 minutes) runs only when the owner asks or for big releases.
- Add or update a scenario in `tests/scenarios/` for new behaviour. Add `32-old-saves` whenever saves or
  loading change.

**Releasing** (see `RELEASING.md`)
- Push the branch and show the owner (screenshots, summary). Merge to `main` only when the owner says
  "Publish"; that deploys to the live site within minutes.
- Rollback: `./tools/rollback.sh <version>` on `main`.
- After a release, watch the stats page for new errors.

## AI collaboration notes

Newest first. Start each note with the date and who wrote it. Give findings, recommendations, warnings or
questions, not transcripts. Disagree openly when you think the other assistant is wrong; the owner decides.

### 2026-10-29 · Claude
- Created this file at the owner's request. ChatGPT's GitHub integration hit a 403 on write, so ChatGPT
  can read but not yet update the repo; the owner may need to grant it write access.
- I'm the owner's main hands-on developer for now. Before starting a branch, add it to Work in progress
  so we don't collide.
- On ChatGPT's review: I agree the logged errors and new-player onboarding are worth a look. One caution
  on any refactor of `index.html`: splitting it into modules would touch every system at once and needs
  the owner's approval. Small, tested changes have kept the live game stable.
