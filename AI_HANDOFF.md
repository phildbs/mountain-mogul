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

## Current status (updated 2026-11-03)

**Live: 2.87.1** (base shuttles go to the longest wait and scale up to 6 buses; published Nov 3, GitHub run green on 0fa71aa). Before it, **2.87** (overnight jobs and removing in matches without pausing the live day; published Nov 3, GitHub run green on bbfdd9b). Before it, 2.86 (building in matches without pausing). Before it, **2.85** (hotel restaurants in medium/large hotels, lunch on the way home, trail stops compare all services, hotel ticks; published Nov 3, full GitHub run green on cf4ee84). Before it, **2.84.5** (rival chairs follow zoom in `updateChairs`; on Crown Peak `hazeAt` treats every slice as land; no invite pop-up or Invite friends in matches; published Nov 3, GitHub run green). Before it, 2.84.4 (rival slices drawn like real resorts: own trail ribbon without shadows, trees on their runs/lift lines hidden on screen only via `rivalTreesCut`, moving chairs, skiers drawn with `figMeshes` after your guests; published Nov 3, GitHub run green). Before it, 2.84.3 (match buildings keep size and style; nothing vanishes as a new day starts; published Nov 3, GitHub run green). Before it, 2.84.2 (match bar is one crown button with a menu; What's new keeps King of the Mountain-only changes, tagged `kotm: true`, in their own closed section and never headlines them). Published Nov 3 (full GitHub run green on 5ab056c). Tag every future match-only CHANGES entry with `kotm: true` right after its title (the reload banner's regex reads it there).

**Recently shipped** (newest first; older releases are in `CHANGES`)
- 2.87.1: base shuttle. Published Nov 3 (full GitHub run green on 0fa71aa). From feedback on Cedar Point (Ridgeback, 2 bases, 7 stations): "guests leave hungry with prices set low and easy access". Their report: 509 missed lunches, 508 "nowhere to eat at the base". Replayed their save (pulled through the Supabase tool, trimmed: `mountains.save` without photo/history; the agent proxy blocks the REST URL, but `execute_sql` output too big for the chat lands in a file in tool-results): 1,226 missed, nearly all standing at stations in `xbq` at closing, waiting up to 5 hours. Causes: a loop bus with nobody waiting at its stops swapped `stn`/`to` forever, so it only served its first pair of stations, and `loopStep` capped buses at 2; `crossCost` for the shuttle was a flat 1.6 however long the line. Now: an empty bus goes to the longest wait at a stop no other bus is heading to (`loopNext`, `loopDest`); `loopStep` adds a bus per 40 waiting, or for a stop uncovered for over 16 min, up to `LOOP_MAX` 6; `crossCost` grows with `loopWait[zone]`. Cedar Point replay: 1,226 → 65 missed; Twin Notch, 4 stations: worst wait 447 → 37 min. Scenario 155. (Claude, Nov 3)
- 2.87: published Nov 3 (full GitHub run green on bbfdd9b). step 2 of no-pause matches. `shut()` = closed, or `matchLive()`: replaces the closed-resort guards for overnight jobs (clear tool and its painters, dozeAt, editArea/commitArea, hubLevel, levelB, snowmaking, lights, base snowmaking, land, growLot, patrol staff, opsDay). They run on the live world and send their orders as before. Cash: the frame loop and `replaySync` now undo only the sim's own takings (`keep` around simStep) instead of pinning cash, so anything you spend sticks; `matchView.replay.cash` is just the starting figure. Removing during the live day (`removeYes`) sends the `remove` order and leaves the thing for today (`matchRemoveTonight`, `matchView.going`, "Removed tonight" in `removeBlock`); after the day, `matchApplyPending` replays it. New learning areas/glades are closed today (`matchSoon('area')`); guest areas are there at once. `MATCH_PAUSE` is now only `shrinkLot`. Scenarios 150 and 153 updated. (Claude, Nov 3)
- 2.86: published Nov 3 (full GitHub run green on 87f6769). King of the Mountain: the lift, trail and building tools no longer pause the live day (`MATCH_LIVE_TOOLS`). `planning()` is false during the live day in a match (`matchLive()`), so placing commits straight away and sends the order as before. `matchBuilt` (called from commitLift/Trail/Building) lowers `matchView.replay.cash` (the frame loop pins state.cash to it) and closes the new thing for today via `matchSoon`: lifts `open=false, planOff=true` + `runOps.lifts[id]='off'`, trails `open=false`, buildings `runOps.bld[id]='closed'`. `matchApplyPending` records what it builds in `matchView.soon`, and `startReplay` closes those too, so pending builds aren't used in the watched day. Clear tool, Trail tool's area/glade/hub tabs (`matchHold`), parking and MATCH_PAUSE actions still pause (step 2: queue them as "happens tonight" instead). Scenario 150 extended. (Claude, Nov 3)
- 2.85: published Nov 3 (full GitHub run green on cf4ee84; reaches King of the Mountain from the next match day, since the match server follows `main`). from Adum888's three notes on Aspen Heights (Juniper). Their last report: 167 missed lunches, 137 "nowhere to eat at the base". Cause: `wantsMeal` is false once `g.leaving`, so guests whose leaving time fell at or after `lunchAt` walked past open base food to the car, and `hungerCause` then named the base. Fix: `lunchOnWayOut(g)` in `baseDecision`'s leaving branch (base eatery via `bestVisit`, while lifts run), and `g.homeAt` (set once in `goCar`) so guests who set off before lunch aren't counted missed. Juniper starter day, seed 77: missed 28 → 8 (the rest: price, one injury). Trail stops (`updateSki`) now compare nearby stops for every need, not only lunch (feedback: "check if an identical service is close before standing in line"). Hotel card and placement preview: `hotelChecks(hotelSpot(door))` ticks ski-in/out and names `HOTEL_EATS` within `HOTEL_NEAR`; `hotelPull` uses the same `hotelSpot`. Scenario 154; 125 extended. Not reproduced: "a max-size lodge in place of a café is ignored". In a test swap the large lodge served ~90 lunches where the café served ~99 snacks; the one measurable change is more price refusals (4 → 17) because lodge meals ($16) cost more than café snacks ($11), and `willing()` turns down ~10–25% at default prices. Also: a meal price below default gives no pull in `bestVisit`/`mealRoute` (`max(0, ratio − 1)`), only more willingness. Ideas left for Phil: show a clicked guest's planned route; a per-building "where guests came from" view. Phil then asked for food inside hotels: medium and large tiers got `seats`/`stalls` and higher upkeep (2,600 → 3,300; 7,000 → 8,400); `hotelDines(B)` makes `offers` return `HOTEL_OFFERS` (dine, apres, rr), and it joins `isEatery`, `apresType`/`apresSvc`, `VENUE_CLOSE` (10 PM), racks via `ownRack`, `bldServiceBreakdown` and the live card. `lunchOnlyOk` stays type-based so rooms never go lunch-only. Own guests get +2 in `tastes` and +3 for après there. A large hotel on the Juniper starter: 81 lunches, 22 après. (Claude, Nov 3)
- 2.84: King of the Mountain: settings, removing, money and land as match orders (see the multiplayer note). Published Nov 3 (full GitHub run green on cab227e). Players with the old page open get "not supported yet" for the new kinds until they reload. Next candidates: moving lifts/trails, trail edits, lift upgrades, mid-stations, terrain parks. (Claude, Nov 3)
- 2.83.8: match cash stays real during the live day. Published Nov 3. (Claude, Nov 3)
- 2.83.7: a full localStorage no longer traps players on one mountain. Published Nov 3 (full GitHub run green). From James Rothman's report: 4 big resorts (Elk Pines ~0.9 MB online, more locally with the day in progress) filled the ~5 MB quota, so Play on a mountain needing an online pull couldn't write the slot list and the reload came back. `storeSet` now frees room by dropping local copies of other mountains saved online at least as recently (never the one opened or the one left); if nothing can go, the switch is refused with a message. Scenario 152. (Claude, Nov 3)
- 2.82.3: title screen scrolls on iPad. Published Nov 2 (Phil checked it on iPad; quick-fix tier: 144, 01, 13, 74 passed). From player reports. `#title` was `pointer-events: none` (children
  `auto`) so taps fell through to the 3D view; iPad Safari won't touch-scroll a box like that, and gaps between cards hit the canvas.
  `#title` now takes touches itself (canvas input ignores everything until `state.started`); `#title.out` goes back to `none` while it
  fades. Chromium scrolled either way when the finger was on a card, so the Safari side was checked by Phil on iPad.
  Scenario 144. (Claude, Nov 2)
- 2.82.2: a clear road and a driveway. Published Nov 2 (full GitHub run green on 0987f86). From Phil's screenshot: pads beside the road
  graded across it (levelRect's 2.5 margin), burying it in snow. `roadKeep`/`groundKeep` stop all grading (pads, lots, trails, brush)
  within ROAD_HW+0.3 of the centre, blending to full at +0.65; `restoreTerrain` resets that band to HT0 for old saves. Road ribbon has
  5 vertices across, never below `meshHeightAt` (the drawn triangles), and is transparent with renderOrder 2.5 so it draws over trails.
  Lift stations/towers can't stand on the road. `LOT_DRIVE`: the road's last ~4 units are a tapered plain driveway (Bezier) meeting the
  main lot square on at its first aisle, plus a lane down its edge; cars use `MAIN_DRIVE`. Side and branch-end lots unchanged. Scenario 143.
  Lifts or trails already built on the road stay as they are. (Claude, Nov 2)
- 2.82: dinner under the lights. Published Nov 2. From Phil: casual restaurants join `NIGHT_OPEN`; `apresType` keeps a
  restaurant only when `B.isBase` (base or village), so a mountain one closes at `nightEnd() + 15`. Night skiers' snack need
  becomes a sit-down `dine` at a restaurant after closing (`svcFor`), which counts as their snack; stay-on day guests reset
  `snacked`. Store and gift kiosk still close at lift close (Phil may want them open at night). Test 142-night-dinner. (Claude, Nov 2)
- 2.81.1: days that never ended. Published Nov 2. From player feedback (Aspen Heights, Juniper): the only open trail off a painted
  summit area ended back in it, so leaving guests circled forever, and the night clear-out kept pushing `dayHardEnd` back. Leaving
  guests now skip hub-to-same-hub trails and hike out after 3 laps (`today.noWayDown`, day report note); the clear-out stops at
  `nightEnd() + 90`. Test 141-no-way-down. Not fixed: hub `returns` can be true via a lift top whose bottom is the base, so a
  summit with no open way down isn't flagged in the build tips. (Claude, Nov 2)
- 2.81: more decor. Published Nov 2 (feature tier: full GitHub run green on 518212c). Trail map boards, string-light chains, holiday trees,
  floodlights; easier tapping on thin objects; tighter tree clearing for every building. See Claude's Nov 2 decor note. Rollback past
  2.81 drops these pieces from saves that have them. Flaky: 109 sometimes throws in `refreshTimebar` (`EVENTS[ev.type]` undefined),
  and 136 then fails once. Not looked into. (Claude, Nov 2)
- 2.80: condos. Published Nov 2 (feature tier: full GitHub run green on 0d0743c; scenario 139 and related scenarios incl. 32-old-saves passed locally). Chalet/duplex/townhomes in three themes, base or slopeside (lower third, trail by the door), sell or rent, owner mood with slow real consequences, buyers limited by resort size. See Claude's Nov 2 note. Rollback past 2.80 breaks saves with condos. (Claude, Nov 2)
- 2.79: leaderboard on demand. Published Nov 2 (full GitHub run green on cd2c18e). Only ~61 of ~650 weekly players visited a resort, yet every game open downloaded the full board (~250 KB) and `social_counts` (~88 KB). `supabase/board.sql` (applied on live Nov 2): `board_peek(mt, me, best)` (~300 bytes), `record_board_open(what)` → `analytics_private.board_opens`, owner-only `admin_board_opens(days)`. Game: `loadPeek`/`boardStanding()` drive the title card and Leaderboard button; full `loadBoard` only from `cmTab` (not Profile) and the in-game sheet, with a skeleton while loading (`CLOUD.boardLoaded`). Title Community card restyled (rank, cup icon, top 3 plus you). stats.html: Leaderboard and Browse section. Scenario 138; 75 updated. Check the stats section after a few days to decide on the leaderboards' future. (Claude, Nov 2)
- 2.78.2: less egress. Published Nov 2 (full GitHub run green on 09b83b8). Free-plan egress was 5.23 / 5 GB. Since Oct 16 the board query (~250 KB, 500 public summaries) ran 79k times and `social_counts()` (~88 KB, every resort) 97k times. `cloudSave` no longer force-reloads the board after each upload; `loadBoard` throttle 20 s → 60 s; `socialBonus` asks `social_counts` for one row with `.eq('mountain_id', id)` (fake client's `rpc` supports `.eq`). Not tried against live from the container (proxy blocks supabase.co); PostgREST supports filters on table-returning functions. Scenario 137 extended. If egress stays high: page the board, or add a slimmer board summary. (Claude, Nov 2)
- 2.78.1: fewer online saves. Published Nov 2 (full GitHub run green on 40e085d). Supabase warned the project was using up its Disk IO budget; `pg_stat_statements` put ~9.2 GB of WAL on the `mountains` upsert (52k calls, ~180 KB each) against under 0.2 GB for everything else. Routine uploads now wait `CLOUD_GAP` (2.5 min) after the last one, and `endDay` uploads at once only outside that gap (else `scheduleCloud`). Title screen and hiding the page still upload at once. Scenario 137; 24-devices updated. Watch Disk IO over the next days. If it's still high, next step is a smaller save (e.g. send the photo only when it changes). (Claude, Nov 2)
- 2.78: source tracking. Published Nov 2 (feature tier: full GitHub run green on 50eb90c; related scenarios passed locally). First visit on a device notes `{src, campaign, host, invite, app}` in localStorage `mm.source` (src from `?src=` or `utm_source`, campaign from `utm_campaign`; both tidied off the address; host is the referrer's host name only) and sends it once via `record_source` (`sendSource()` in `initCloud`), then stores `'sent'`. Server keeps one row per account in `analytics_private.player_sources` and ignores accounts older than 2 days, so existing players aren't misfiled as Direct. Stats Overview › Where players come from (`admin_sources(days)`, 7/30/all), named by `SITES` in stats.html. `supabase/sources.sql` applied on live Nov 2. Privacy page updated. Scenario 136. Phil's request. (Claude, Nov 2)
- Stats page (no game version): tabs (Overview, Feedback, Resorts, Health; remembered, or `stats.html#feedback`). Feedback is one list with All/Ideas/Feedback filters, each note showing the sender (profile name, else resort creator; Guest; Deleted account), "All N from them", what they were doing (version, resort, season, lifts, device) and a Visit button. New owner-only `admin_feedback(lim)` in `supabase/feedback.sql`, applied on live Nov 1. Published Nov 1 (Phil said Publish; docs tier). Notes store no resort id, so it matches the sender's save on the same mountain (same name first), else their latest; 94 of 101 notes matched. Page falls back to admin_stats' lists if the function is missing. Possible follow-up: add the cloud resort id to `feedbackContext()` for exact matches. Phil's request. (Claude, Nov 1)
- 2.77.3: guests with no runs yet stay past their planned leaving time (until close at most), and late arrivals plan 120–210 minutes. Was the cause of daily no-ride refunds. Scenario `135-no-ride-refunds`; probe `tests/refund-probe.mjs`. Changelog carries an apology, at Phil's request. (Claude, Nov 1)
- 2.77.2: online saves carry `music` (on now) and `musicEver` in the summary; stats.html shows Music on and Tried music tiles (per player, latest save, 7 days with 30-day fallback). `admin_stats` updated on live. Phil's request. (Claude, Nov 1)
- 2.77.1: guests spread across all parking lots (weighted by lift fit × free spaces) instead of filling the main lot first. Player request. (Claude, Nov 1)
- 2.77: lift mid-stations, one per chairlift or gondola: get off or on partway up. See Claude's Nov 1 note.
- 2.76.2: learning areas follow the snow (faded/brown when thin, hidden in summer) instead of always drawing white. Player report.
- 2.76.1: roomier ski racks after player feedback: placed racks hold 40, building racks a pair per seat, gift kiosks ski-in/ski-out.
- 2.76: background music, menu › Music (play/pause, next song, volume; off by default). Nine songs by Phil made with
  Google Flow Music, credited in the guide and changelog. See Claude's note. (Claude, Nov 1)
- 2.75: ski racks. Skiers rack skis before going indoors and walk in boots; Decor › Ski rack (12 pairs). See Claude's Nov 1 note.
- Site card: `og-image.jpg` is now Frost Run at night (lit trails, fireworks), from Phil's promo trailers. The meta tags
  load it as `og-image.jpg?v=2` so sites refresh cached previews; bump the number when the image changes. No game change,
  no version. (Claude, Nov 1)
- 2.74: spring bonus days run to May 31 (`SPRING_LAST = 181`) while the average trail base holds 18". `CLIMATE` warms
  to 58/35 by May 31, May demand ×0.6, and snowmaking (trails, base, painted areas) stops after Apr 30 (`GUNS_LAST`,
  `gunsPacked`). Sims: normal Auto snowmaking reached May on 1 day in 9 seasons; guns on full all winter stay open all
  May but lose ~$100k there (weekdays −$5–10k, weekends +$2–4k). What's new is folded by day for the last 7 days and by
  week before that (`openWhatsNew`, `wnGroupOf`). Scenarios 130, 131. Idea left open: a spring weekends-only option
  (skiing doesn't wear snow, so closing midweek only saves money, not snow). (Claude, Nov 1)
- 2.73: leaving a drawn, unbuilt trail or lift (card X/Done, toolbar, keys 1–5, Escape, list items) asks first: Build /
  Throw it away / Keep editing (`unbuiltDraft`, `leaveDraft`, shown in the `#crisis` modal; scenario 129). Village gondolas
  over a hump (ground more than 2 units above the station line) follow the ground in `liftLayout` instead of running level
  on giant towers; layouts are rebuilt on load, so existing ones fix themselves.
- 2.72: Ridgeback (`ridgeback`): one long ridge from an expert summit (NE, bare above the trees) down to a beginner
  summit (W); heights come from the nearest point on the crest (`RB`), so the crest is a green all along (goal Ridge run).
  Town off the south edge (S3 not sold); one road splits at a crossroads: main lot growing west (`lotWest`, entered from
  its east side) and East lot. Title: orange New 3D mountains button (`NEW_MTN.ids`, gone once both are tried, until
  Feb 28, 2027); list puts `is3d` mountains first, tags 3D / Classic; cards show game snapshots `img/<id>.jpg`
  (`M.photo`, `paintThumbs`). Shaped with Phil in preview (saddle ridge -> smooth green ridge; west town -> south).
- 2.71.1: the Lone Pine Hill feature card hides once the player has a resort there (`mm.seen.<id>` in localStorage, so it stays hidden after deleting it).
- 2.71: Lone Pine Hill (`lonepine`), a fifth mountain: a big lone hill filling most of the land, ~590 ft, gentle sunny south
  and steeper shady north (bowl, rock band). Two roads from a town off the west side (scenery houses, church, water tower;
  the W2 parcel isn't sold): `road` to the main lot (south) and `branch`, forking in town, to a North lot. `BRANCH_WORLD`,
  `ROUTES`, `routeNear` and `roadBetween` route cars, buses and base shuttles; `baseOf` uses plain distance when a
  mountain has a branch. Title screen: a large feature card (`#featMtn`, `NEW_MTN.feature`, photo `lone-pine-hill.jpg`)
  with a thank-you to players. Phil shaped it in preview: first a ring road (looked odd), then two roads, then a bigger hill.
- 2.70.1: ski school practice snow drawn with a solid texture, so the sky no longer shows through it (see Decisions and lessons: see-through textures).
- 2.70: terrain parks (Trail › Terrain park): rollers, flat box, small jump, rails, big jump and halfpipe; park fans ride them, others go
  around; Park report page, What next? advice, blueprints while open, moving features. Rebuilt by Claude; see Claude's Nov 1 note.
- 2.69.1: pond skim and race-finish crowds face the action (a flipped sign in `drawCrowd`); pond waders face the way they walk. See Claude's note.
- 2.69: hotels: base-only, three sizes (12/40/120 rooms) in all three themes; rooms booked each morning; hotel guests need no parking, ride
  first chair, can rest in their room once a day and head out again; room price in Business › Prices. See Claude's note.
- 2.68: popular trails and batch closing: Popular sort, glades in the Trails list, Close icy and thin / Reopen good ones, report Trails
  page, whole-day traffic map. See Claude's note.
- 2.67.1: guest areas: guests walk around buildings; a full seat keeps guests in their area and off-area guests step back on (no more
  summit "hike outs"); a bare base always shows on the day report. See Claude's note.
- 2.67: widen and shape trails (drag edge dots per section; pay only for new ground; blueprint while open); grooming and snow guns
  scale with width (Medium unchanged); Edit route grades only new ground. See Claude's note.
- 2.66.1: guest areas on any slope (amber hint, optional leveling, slower uphill walking); fixed hungry skiers looping
  at lift tops inside guest areas, which froze big resorts. See Claude's note.
- 2.66: no lines at benches, picnic tables and fire pits (a free seat nearby, or rest later); skiers switch to a lift loading
  beside a long line, before joining or from far back in it; time bar stays on one row at 900 px (the `22-topbar` flake). See Claude's note.
- 2.65: paintable guest areas at the base, mid-mountain and summit (started by ChatGPT, finished by Claude). Guests walk
  freely inside them; 30% walking limit with a Level button; 15 free acres per resort then $5,000/acre; base-only shops
  allowed in areas touching the base; arrivals reach village lifts through the area. See Claude's 2026-10-30 note.
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

**Active:** nothing in progress. ChatGPT's `feature/terrain-parks-preview` is superseded by 2.70; delete it if Phil agrees.

**Upcoming / candidates** (owner to prioritise)
- Decorations (roadmap card "More decorations", now Ongoing with ski racks): Phil's Nov 1 calls for the rest: small gameplay effects are
  fine (with diminishing returns), custom sign words OK only from word lists like resort names, seasonal pieces change only when the
  player chooses. Brainstormed first batch: entrance arch with the resort's name, drawn fences, string lights, snowmen and ice
  sculptures, Adirondack chairs and patio heaters, flags in resort colours, a summit photo spot. Trail map boards, billboards, statues, fountains, flags,
  snowmen, an entrance arch. Also the special decoration earned for 3 invited friends (milestone is saved;
  design deferred by Phil).
- Trail/glade popularity: 2.68 preview adds the report page and day/evening split; "reasons" are only a generic quiet-trail hint so far.
- Custom mountain fixes, so creation can be turned back on (`CUSTOM_OFF`).
- New-player onboarding, and a pass over logged errors on the stats page.
- Roadmap ideas added by Phil: skier obstacle avoidance, paintable base areas (real walkable zones),
  lift mid-stations (one per lift shipped in 2.77; section wind holds and night lighting, riding down, more stops left open).

## Work in progress

One row per active branch, so nobody edits the same thing at once. Remove the row when it merges.

| Branch | Who | What | Started |
|---|---|---|---|
| `ccr-373e923a-qdafh9` | Claude | **2.83 to 2.83.5 King of the Mountain beta published Nov 2.** The Hetzner match server follows the branch named in `match/server-branch.txt` (`main` from Nov 2, 23:5x UTC): it writes a systemd override (`/etc/systemd/system/mm-match.service.d/branch.conf`) and restarts when that file names another branch. So only published code runs live matches. First Beta Cup lobby is live in the DB, starting Nov 2 23:00 UTC (6 pm EST). Multiplayer groundwork: test match runner (`match/`), server setup, Crown Peak 3-player match map (`?matchMap=1`, wedge-shaped land via `MOUNTAIN.area`, never saves). Not for release yet. | Nov 2, 2026 |
| `feature/terrain-parks-preview` | ChatGPT | **Superseded** by Claude's rebuild above (Phil's call, Nov 1). Left as it was; don't merge it. Delete it once 2.70 ships, if Phil agrees. | Oct 30, 2026 |

## Known issues

- Custom mountain creation is disabled (`CUSTOM_OFF = true`): Gentle/Easy settings could still make
  cliffs. Existing custom mountains still play.
- Twin Notch has mostly been played in automated runs; watch feedback for balance and pathing.
- `index.html` is one large file. Search by function name rather than line numbers; they move.
- The title-screen New 3D mountains button (`NEW_MTN`) switches itself off on Feb 28, 2027.
- Stray screenshots from Oct 18 are committed in the repo root (`mb-*.png`, `mbp-*.png`, `tc-*.png`) and
  are served publicly. Probably safe to delete; ask the owner first.
- Two scenarios share number 84 (`84-lunch-lots`, `84-movable-trails`). Use the next free number for new tests.
- A lit trail made longer by Edit route keeps its old `litCost`, so the extra lights are free.
- Invitations can't detect fake accounts or made-up day reports (the simulation runs in the browser).
- `node tests/building-styles.mjs` (standalone, not in the GitHub run) fails on `main` at "hotel/0: exact door calls": the modern
  hotel's door calls differ from the classic one. Older than 2.75; not looked into.
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
- **See-through textures (2.70.1):** the renderer has `alpha: true`, so any opaque material whose texture has alpha
  below 1 writes that alpha into the canvas, and the CSS sky gradient shows through (blue by day, grey on grey days,
  purple at dusk). That was the ski school's "funny snow": it used the trail texture `CORD`, whose edges fade out.
  Keep alpha textures on `transparent` materials only; buildings use solid textures like `SCHOOL_CORD`.
  `gl.readPixels` reads the canvas before the sky is mixed in, so check colours in a screenshot.
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

### 2026-11-02 · Claude · Multiplayer plan (idea stage, nothing built)

- Phil wants persistent multiplayer: 2–4 signed-in players, official lobbies only (2–3 at a time, set up by Phil),
  about a real week per match, one game day per real hour, most season profit wins, build any time (big builds open
  next morning), several matches per player, badges for winners. Its own section with its own saves.
- Plan doc: https://claude.ai/artifact/JQgtJHs64mifbu15Qb1o7Y (Phil's, ask him for access to comment).
- `tests/catchup-bench.mjs` times whole headless days. Starter resort (~250 guests): 0.3–0.5 s a day, 1.6–2.3 s with
  CPU throttled 4×. Big resort (26 lifts, 110 trails, ~1,400 guests): 9–10.5 s, 53–60 s throttled. So phones can't
  catch up missed days; the plan is a small rented server running `index.html` headless (as the tests do) once an
  hour, writing results to Supabase. Supabase edge functions are too short-lived for a whole day.
- Step 1 done: `match/runner.mjs` plays 2–4 starter resorts in step (one page each, in parallel), one shared forecast
  (`state.wx` copied from player 1), and splits the town's skiers each morning (`splitSkiers`: town = biggest
  stand-alone demand + 0.4 × the rest, shared by demand^1.5), injected by swapping `demandForDay` around `openDay`.
  No `index.html` changes. 4 players × 21 days at $45/65/85/105: $65 won (+$77K), $45 was capped at ~250 guests a
  day by the starter's size (+$65K), $105 lost $107K. Whole match day for 4 small resorts: 0.3–1.2 s.
- Runner now plays Crown Peak (`?matchMap=1`, 3 players) from opening day. Season pass buyers are split like day
  skiers (`passBuyers` swapped around `openDay` too), and a resort that turned skiers away is offered only what it
  held next day (spill goes to rivals), probing +15% a day after. 21 days at $45/65/85, all $399 passes: $65 won
  (+$54K), $45 +$17K (340 turned away), $85 -$1K. With passes $299/399/499 the $299 pass sold $102K vs $33K at $499.
  Starter resorts roughly break even on ordinary days, so short tests are decided by pass money; a full-season
  match spreads it out.
- Database: `supabase/multiplayer.sql` is LIVE (Phil ran it in the SQL editor, Nov 2). Six match_* tables (RLS on,
  read-only for clients except own orders) and match_join / match_leave / admin_match_lobby / admin_match_close.
  Checked by `tests/sql/multiplayer.sql` (23 checks) on a throwaway local Postgres, not on live. Advisor warnings
  for these are the expected kinds (signed-in can call the security-definer functions; guests can read).
- Match server: `match/server.mjs` (loop each minute: start due lobbies with computer resorts in empty slots, play due
  days, apply `match_orders` overnight, finish with badges), shared rules in `match/market.mjs`, DB layer `match/db.mjs`
  (REST with service key, or in-memory). `node match/server-test.mjs` plays a 3-day match on the in-memory DB (22
  checks). Season profit = sum of daily operating profit, so building isn't a loss. The REST layer is untested against
  live from here (this container can't reach supabase.co); first real test is on the Hetzner box via
  `match/server-install.sh`.
- Live view (Phil's choice, Nov 2): the server plays each day in ~1.5 s per resort at the start of its hour and saves.
  The client replays the day in step with the clock (8 am at the hour, close ~45 min later, then night) as its own
  visual simulation of its slice and rivals' slices, from the saved resorts and that day's skier share. The server's
  numbers stay official; the replay only has to look right. No live streaming of skier positions.
- Live test, Nov 2: "Test Cup" lobby 731afdbb-... (Phil + 2 computers, 6 days of 10 min) on the Hetzner box. First
  install hit an empty-reply bug (fixed in db.mjs); the box now self-updates when the branch moves (verified).
- Match length (Phil, Nov 2): 30-minute days (:00 and :30; the last 5 min of each is night). Beta lobbies: 168 days
  (3.5 real days, one season). Normal: 7 days = 336 days, two seasons with a summer between; short-season option
  168. Summer and the second season are untested on the server: test before the first 336-day lobby.
- Chat (Phil, Nov 2): `supabase/match-chat.sql` (DRAFT until Phil runs it). One board per match; players post as their
  resort, signed-in spectators as their public profile name or "Spectator"; guests read only. match_say checks sign-in,
  chat bans, 10 s rate limit, 200 chars and `match_clean` (word list in match_blocked_words, DB only; whole words plus
  joined single letters, words of 5+ letters also inside others). Finished matches keep chat, closed to new posts.
  Six reaction emoji, reports, private mutes, admin_chat_reports / hide / ban. match_join now filters resort names.
  Server posts news (start, builds, ticket changes, powder days, final standings). 31 checks in tests/sql/match-chat.sql.
- Name (Phil, Nov 2): multiplayer is called **King of the Mountain** (title card and window).
- Late joining (Phil, Nov 2): `supabase/match-late.sql` (DRAFT until Phil runs it; 13 checks in tests/sql/match-late.sql).
  Per-lobby settings: `computers` (fill empty slices, or leave them dormant until someone joins), `keep_profit` (a
  takeover keeps the computer's season profit, or starts at $0), `late_days` (cut-off; default a quarter of the
  match), `late_bonus` $15,000 a missed day up to `late_bonus_cap` $1M, paid as cash (not profit) by the server at the
  next overnight. match_join_late takes a computer slot first, else an empty one. Server-test covers both kinds.
- Client (Nov 2): title card + window (lobby list, join, late join), match screen (your saved resort; rivals drawn
  turned onto their slices in `rivalGroup`, never in `world`), building in your own running match (`matchPlay`:
  visiting is null, saves blocked, commits become `match_orders`, prices synced, MATCH_ACTIONS allow-list), chat
  panel (`MC`, realtime channel plus 20 s poll), the live day (`startReplay`, automatic; a build tool pauses it, Explore resumes; plays day N locally with the server's
  share from match_days, paced so 8:00 to 17:15 fills the first 25 of each 30 min; ends with the server's own day report; Reports opens Money history).
  Scenarios 146 to 150. Not yet: skiers on rivals' slices, the Plans/remove/land/ops orders, stats.html tools.
- Match orders (2.84, Claude, Nov 3): the sheet click handler is now `sheetAct(b)`, wrapped by `matchGate` (allow-list, pause) and
  `matchBefore`/`matchAfter`. Settings (`MATCH_KNOBS`, `ops*`/`pk*`) send their new values as `ops` `{ set: { T<id>: [...], L<id>, A<id>,
  B<id>, ops, baseSm } }` (`matchKnobs`/`matchSetKnobs`), never toggles. One-off actions (`MATCH_ACTS`) send `other`/`remove`
  `{ ds, sel, on }`: the server's `matchDo` re-finds the object (`matchFind`: id, checked against position) and presses the same
  button with a stand-in (`sheetAct({ dataset })`); success = `matchSig()` changed. Land: `land` with `{ area }` (painted cells +
  areaBuild/hubLevel) or `{ brush }` (level/plant path, rounded to 0.01). Bulldozer: `remove` `{ doze }` via `dozeApply`. Actions
  needing the resort closed pause the live day (`matchPause`, then re-press the button). Panels show Remove and overnight buttons
  in a match during the day (`overnightOk()`). Not in matches yet: moving lifts/trails/buildings, trail shape/route, lift
  upgrades, mid-stations, terrain parks, blueprints (every match build already waits for the night). Scenario 153; server-test day 2.
- Order timing (2.84.3, Claude, Nov 3): the server marks a day's orders applied before it plays the day, and saves the
  resorts ~15 s later. `matchApplyPending` therefore also replays orders marked for a day newer than the copy shown
  (`applied_day` in shown+1..shown+2, without errors); before, things vanished in that gap and the cash shown was stale, so
  players ordered things the server then refused (Snowy's parking). Building orders now carry `tier` and `style`.
- Rule (Phil, Nov 2): in a match players must be able to do everything whenever they're on, even if it only queues for the next overnight. Build tools pause the live day; panel actions like parking (`lotBuildable()`) pause it too. Keep this for every new match action.
- Boundaries: for now each player's resort is its own copy of the map, and its property line is their boundary.
  A shared map needs one main lot, road and base per player inside their area; the engine assumes one main lot
  per resort, so a purpose-made match map (each player's page a window onto one range) is the likely route. Signed: Claude

### 2026-11-02 · Claude · Night lights refund (shipped in 2.82.1)

- Before 2.81.1 a day could run for game-weeks (guests circling a loop trail), and `nightCost` charged lights and
  crew for every clear-out minute. A live resort (Aspen Heights, Juniper) was charged $2.64M and $259K on two
  nights against a usual ~$14K–$24K.
- `maybeNightRebate` runs once per save (`state.nightRebated`; saves without the field get 0). It works out the
  most a real night could cost now (all lit trails and lifts, extra staff, until 9 PM plus 90 minutes), doubles it,
  and refunds any night in history above that down to the resort's median normal night, with a popup.
  Only the kept history (`HISTORY_DAYS`) is checked. Scenario `142-night-rebate`. Signed: Claude

### 2026-11-01 · Claude · Lift mid-stations (shipped in 2.77)

- One mid-station per chairlift or gondola (`L.mid = { s }`, the share of the way up; saved with the lift, so old saves
  are unchanged). Placed overnight from the lift panel (`openMidTool`, tool `'midstn'`, `midTap`, `midProblems`); at
  least `MID_GAP` (12 units) from each end. Costs `midCost` (30% of the type's base); running cost ×(1 + `MID_OP`).
- The network sees it as two stops (`syncMid`): `L.midLo` (a "top": trails start there, `departing`/`transfers`) and
  `L.midUp` (a "bottom" with its own `queue`; trails end there). Both have string ids (`'ml5'`, `'mu5'`) that
  `liftById` resolves, and getters that follow the lift (open, wind, type, name). `midParts()` lists them; tops are
  lifts + `midLo`s, loaders are lifts + `midUp`s. Riding guests keep `g.L` = the real lift.
- `stepLift` calls `midStop` when a chair passes `L.midP` (cable distance): riders compare `exitsV(midLo)` with staying
  on (`exitsV(L)` minus the upper ride) and may get off; then the mid line fills free seats. `L.midFree` tracks the
  share of free seats, which sets the mid line's capacity estimate. `vLift` counts getting off at the mid-station.
- Left for later (Phil's call): wind holds and night lighting by section, riding down from the mid-station, more than
  one per lift, angle stations. Phil didn't want extra stops on the village gondola.
- Scenario `134-mid-stations`. `tests/express-routing.mjs` extracts functions by name, so `midParts` and `exitsV` are
  plain `function`s and in its list.

### 2026-11-01 · Claude · Background music (shipped in 2.76)

- Menu › Game › **Music** (`mMusic`, a switch) shows a small player under it: play/pause, next song, volume (`mMusicBox`).
  Off by default; `mm.music` in localStorage keeps `{ on, vol }`. Clicking Music leaves the menu open so the volume can be set.
- Songs are listed in `MUSIC` (`{ file, title }`) and live in `music/`. Nothing downloads until music is on (`preload = 'none'`,
  the audio element is made on first use). Shuffled each session, then played in order.
- Songs play straight from the `<audio>` element (Phil heard nothing on Android with everything routed through Web Audio).
  Only iPhones with `navigator.audioSession` use a Web Audio gain node (they ignore `audio.volume`), with the session set to
  `'playback'` so the silent switch doesn't mute it; older iPhones play directly and hide the slider. Browsers need a tap before sound,
  so music left on starts on the first `pointerdown`/`touchend`/`keydown` (title screen included). Hidden tab: pause; back:
  resume unless the player paused by hand (`music.held`). If every song fails to load, music turns itself off with a toast.
- Songs are Phil's, made with Google Flow Music (credited in `guide.html` and the 2.76 changelog; keep it). First one: `alpine-arcade.mp3` (Alpine Arcade, 2:23). Re-encode each to 128 kbps
  without cover art (`ffmpeg -i in.mp3 -map 0:a -map_metadata -1 -b:a 128k music/<name>.mp3`), about 2.3 MB a song.
  Second: `first-chair.mp3` (First Chair, a slower take of the same tune, lowered 2.5 dB to match),
  `pixel-chalet.mp3` (−1.5 dB) and `snowy-save-point.mp3` (−2.8 dB), both 2:44;
  `powder-day.mp3` (Phil's Pixel Powder, −2.2 dB) and `fresh-tracks.mp3` (Pixel Slopes, −1 dB), both upbeat, about 2:42;
  `cold-snap.mp3` (Frostbite Peak, −3.7 dB, 2:54) and `last-run.mp3` (another Alpine Arcade take, −2 dB, 2:56). Then `apres-jam.mp3`
  (Pixel Jamboree, −2.3 dB, 2:52). Nine songs, about 24 minutes, Phil's full set for now. Match loudness with
  `-af volumedetect` (mean about −20 dB). Next song hides while there's only one. Scenario 133-music.

### 2026-11-02 · Claude · More decor (shipped in 2.81)
- Phil asked for trail map signs, string lights, seasonal lights and floodlights for extra-wide trails. New decor types (all `decor`,
  `plop`, `noPad` except `flood`): `tmap`, `strlight`, `xtree` (holiday tree), `flood`. Decor tab order: tree, bench, picnic, rack,
  tmap, firepit, lamp, strlight, xtree, tlight, flood.
- **Bulb colours:** `BULB_SETS` (warm white / holiday colours / icy blue), saved as `B.hue` (absent = warm, so old saves are fine).
  Picked on the card (`bulbHue`), free any time; `bulbPick` makes new ones match the last pick. Seasonal = the player's choice only,
  per Phil's Nov 1 call. Bulbs use shared `bulbMat(hex)` materials, dimmed by day and brightened at dusk in `bulbGlow`.
- **Trail map:** one shared canvas texture (`TMAP`, `drawTrailMap`), redrawn from `computeNetwork` only when its signature changes.
  Painted looking uphill (the way the lifts climb), hillshade, forest dots, trails by rating, lifts dashed, lot and buildings.
- **Floodlight:** `faceTrail` also sets `floodAt` (up to 8 units toward the nearest trail centre) and `floodR` (trail half-width + 2.5,
  6.5–9.5) for the light map. Night power: `FLOOD_POWER` (2.5) trail lights each. Placed lights only light the picture; there's still
  no gameplay effect of dark snow (auto poles sit at hw+0.55 on alternating sides, so trails wider than ~Wide show a dark middle).
- **Small effect:** `lightsNearVenues()` (string lights and holiday trees within 14 units of an après venue door, cached per game hour)
  adds 0.01 each to `apresChance`, capped at 0.04. Trail map boards have no effect yet (idea: fewer lost/mismatched trail picks).
- **Phil's preview feedback (Nov 2), addressed:** string lights are now a chain of tapped poles (`chainTap`, `evalChain`, `B.pts` local
  offsets from the first pole, `CHAIN_SPAN` 4 units, `CHAIN_MAX` 16; one building, one card; cost per pole + per unit of string;
  plans carry `pts`). Floodlights turn like buildings (lamps face +z; `aimFlood` lights 6 units ahead; `floodAimRot` faces the
  nearest trail until the player turns it, `draft.aimSet`). Selecting: `pickBldAt` raycasts building models (skipping ones behind
  the hill), then thin decor within 16/26 px on screen, before `pickFeature`'s ground box. Tree clearing: `footprintTrees` clears
  trees whose trunk is on the rotated footprint or within 0.35 (0.15 for decor), instead of a 1-unit grid of 0.95 brushes
  reaching ~1.5 units past the box.
- Headless renders need `patchNightMaterials()` before a night screenshot (it otherwise runs every 90 frames). Scenario 140.

### 2026-11-01 · Claude · Ski racks (shipped in 2.75 and 2.76.1)
- **2.76.1, after a player's feedback the same day:** placed racks looked as big as building racks but held 12 (now 40, drawn
  filling up the same way); placing them clears trees in their square (fewer are needed now: `RACK_SHARE` 1, a pair per seat +
  stall); gift kiosks are ski-in, ski-out (dropped from `RACK_TYPES`). Their "racks right by the kiosk, skis in the snow" didn't
  reproduce (4 kiosks with 2 racks each on the busy resort: none); most likely 12-pair racks filling behind a long kiosk line.
  Scenario 132 now checks the next free rack is used before the snow. Busy test resort with no placed racks: 174 guests with skis
  in the snow (122 at one overloaded café), down from 422 at 0.75; starter resort 0. The tuning numbers below are from 2.75.
- **Idea:** Phil's, from the decorations brainstorm: skiers take skis off before going indoors and walk in boots; too few racks and
  guests complain. Built as its own release before any other decor.
- **Rules:** `RACK_TYPES` (lodge, café, restaurant, fine, bar, store, gift, both restrooms) have a built-in rack for
  `RACK_SHARE` (0.75) of seats + stalls. Decor type `rack` holds 12 and serves any of those doors within `RACK_R` (3 units, 30 m).
  `startVisit` routes a skier to `pickRack(B)` (own rack first, then the nearest placed rack with room), `rackStop` drops the skis
  and walks to the door, `resumeGuest` → `fetchSkis` walks back for them. All full: skis in the snow by the door (`g.rack = -B.id`),
  −3 satisfaction and `complaints.rack`, once per guest per day (`g.snowSkis`); 4% of snowbank pickups find the wrong pair (−5).
  No sting for the first 5 operating days of season 1 (`rackGrace`, report flag `racks.easy`). Exempt: rental/tuning, truck, school,
  kids, clinic, hotel, decor; guests without skis (`sight`, `local`, `needsRental`).
- **State:** only `g.rack` and `g.snowSkis` (declared in `makeGuest`, so one guest shape). Rack use (`rackUse`) is recounted from
  guests every game minute (`rackCount`), so it can't drift; `goQueue`/`startSki` put skis back on if a pickup was ever skipped.
  Report: `r.racks = { n, at[top 3], easy }`, `today.rackAt`. Buildings save no new fields; `rackSpots` rebuilds positions on load.
- **Look:** figure skis are a separate instanced mesh (`figMeshes.skis`), hidden while racked. Racked skis are one InstancedMesh
  (`drawRacks`, redrawn when `rackVer` changes). The built-in frame sits in front of the model, clear of decks: `buildingVisual`
  measures ground-level parts (`b.rackZ`), so all three themes work. A building's rack is drawn shorter than it holds and shows
  fullness; a placed rack shows each pair.
- **Tuning (busy 1,400-guest Juniper test resort, one day):** built-in share 0.5 / 0.75 / 1.0 left 723 / 411 / 143 guests with skis
  in the snow; the 250-guest starter resort had 15 / 0 / 0. With 0.75, four racks per busy building took it from 422 to 0. Same
  sim speed. Scenario 132.

### 2026-11-01 · Claude · Terrain parks rebuilt (shipped in 2.70)
- **Why a rebuild:** Phil asked me to review ChatGPT's paused branch and to rebuild if needed. It was 35 commits behind `main`. Since then
  2.67 had shaped trails into per-section widths (`t.ws`, `sampleHW`), so its fixed `TRAIL_WIDTHS[t.width].hw` placement no longer
  matched trails. It had no guests using the features, no costs and no demand. Its models (`park-models.js`) were about 4× the skiers'
  scale (a 9 m-tall small jump). What I kept from it: the six feature types, its menu flow (pick → tap a trail → preview → confirm),
  slope-hugging placement and its icon ideas (redrawn at stroke 1.8). Nothing was merged from it.
- **Data:** `t.feats = [{ id, type, at, off }]`. `at` is the fraction down the trail and `off` is −1..1 of the room either side, so features
  survive Edit route and reshaping. Saved only when non-empty, so old saves are untouched. Derived on `buildFeats(t)` (called from `addTrail`
  and `refreshTrailMesh`): `t.fx` spots (`s0/s1/lat/hw/room/fr`), `t.fxPts[ability]`, `t.fxGroup` models. A trail with features is a park; there's no separate toggle.
- **Types** (`FEATS`): rollers, flat box, small jump (Small: intermediates and up), rail, rainbow rail (Medium), big jump/tabletop and halfpipe
  (Large). Medium and Large need ability 2 (`featAb`). Costs $6k–$250k, shaping $40–$900/night.
- **Models:** draped on the ground with `featGround` = max(`heightAt`, `meshY`). `meshY` matches the terrain's actual triangles. On curved
  ground they sit up to ~0.3 above `heightAt`'s bilinear blend; that's the pre-existing white patches you see poking through trail ribbons.
  Worth reusing anywhere small things must sit on the visible ground. Blue dye lines trace snow features (white on white was unreadable).
  Rails are painted dark, because bare steel vanished in sunlit snow. The halfpipe follows the trail's samples.
- **Guests:** new shape field `fs` (park fan: 18% of intermediates, 30% of advanced/experts). `trailFit`: fans +min(3.5, 0.6·fxPts),
  others −min(1.5, 0.3·count). `ridesFeat` uses a deterministic hash (85% of eligible passes), so the sim and the drawing agree.
  `updateSki` → `featHit` at each feature's end: +0.5·RUN_W, a small fall risk (×1.6 Large for non-experts, ×1.6 icy), thoughts.
  `guestPos` → `featPose`: riders line up, follow the shape, fly with a 360 on jumps, slide rails sideways and swing wall to wall in the pipe;
  others steer around. Non-fans finishing a park trail: −0.3·RUN_W.
- **Business:** `parkDraw` adds up to +8% to `amen` (0.008 × points of open park trails). Shaping is paid in `finishNight` inside the
  grooming bill (`state.nightCost.park`, `today.exp.park`). The report splits out "Terrain park shaping", and the Trails page notes rides.
- **Measured** (Juniper starter, Saturday, 6 features + a halfpipe): about 40 fans of 235 guests, 180–270 feature rides by 11 AM, 1–3 falls.
  Scenarios 112 (sim speed), 32 (old saves), 81, 84, 122, 124 and 125 pass. Not measured: a big resort with many parks (guestPos cost is
  per skier on a park trail, looping that trail's features).
- **Also fixed:** `76-roadmap-new` expected Hotels `ongoing`, but Hotels moved to Done on Nov 1, so it failed on `main`. It now checks
  Ski-in/ski-out, and sorts the tagged cards.
- **Finishing pass (Phil picked items 1–5 of the brainstorm, then roadmap card to Done):**
  - Report `r.park` (`parkReport`): fans by ability (`today.parkFans`), first-ride counts (`today.parkRode`, using guest field `fsr`),
    `featRides` by feature id, `parkFalls`, `parkCruise` (non-fan runs per park trail). Shown on a Park tab (`parkPageHtml`).
  - `parkAdvice` in What next?: no park but ≥15 fans asking (`complaints.noPark`, set in `parkArrival` with no satisfaction cost),
    falls with no patrol hut within 45 units, over 40% of fans riding nothing, cruisers outnumbering fans on a park trail.
  - Blueprints while open: plan kind `feat` (`trail, name, type, at, off`), `buildFeatPlan`, a blueprint-tinted `featModel`. Move:
    `parkMove` → `parkDraft.moving`, fee `featMoveFee` (20%), keeps the feature id. Moving and removing are overnight only.
- **Left for later (Phil: future updates):** park open/closed switch, wear and shaping levels, a slopestyle event, a freestyle crowd,
  and features hidden in summer (they follow the trail ribbon's visibility).
- Tools: scenario 126 (picker, placement rules, build/remove, undo, save, riders/avoiders, day, report, phone).

### 2026-10-31 · Claude · Event crowds faced away (shipped in 2.69.1)
- **Player report:** pond skim spectators all faced away from the pond. Cause: a flipped sign in `drawCrowd` (shared by race day
  and pond skim since they shipped). Figures face +z at yaw 0 (goggles at +z in `FIG_GEO.head`), and `raceLine`'s normal is
  `(-dz, dx)`, so the `+normal` side needs `yaw + PI/2` to look in; it had `-PI/2`. Same flip made pond waders walk out backwards.
- **Measured** (crowd = last 26 figures from `drawRace`/`drawPond`, facing vs direction to the centre line): main 0/26 facing in
  on both events (every one exactly away), branch 26/26; waders 0/19 facing their way on main, 19/19 after. Big 110-trail resort,
  pond day with forced 8,000 demand (lot caps it at 1,423): 26/26 at 11:40, 12:40, 1:40 and 2:40, 61 runs, no errors.
  Scenario 46 now checks both crowds and the waders, and fails on main.
- **Not changed, worth knowing:** event figures are drawn after every guest inside `MAX_G` (5,000). A resort with over 5,000 guests
  out at once would lose the crowd and skimmers first. Big test resorts never got near it (Juniper's lot), so it's unmeasured.

### 2026-11-02 · Claude · Condos (shipped in 2.80)
- **Phil's decisions:** sell *and* rent; owner mood has real consequences but builds slowly; slopeside from the start, but only low on
  the mountain; all nine models at once. Three sizes: Ski chalet (1 home), Duplex (2), Row of townhomes (5).
- **Type:** `BTYPES.condo` (`where: 'low'`, tiers with `units`, `value` per home, `dues` a day per sold home, `title` for the menu name via
  `tierName`). $220k/$360k/$800k. Models `modelCondo`, `modelCondoModern`, `modelCondoScandinavian` (helpers `classicHome`, `modernHome`,
  `scandiHome`, `woodpile`); test 139 checks footprints. Build tab `stay` is now "Lodging" (hotel + condo).
- **Placement:** `condoSpotProblem(door)`: base / base guest area, or `heightFrac(door) <= CONDO_LOW` (1/3) with a trail within
  `trailHW + CONDO_REACH` (5) of the door. Levelling a very low pad can drop the door into the base band, so a "slopeside" pick can
  come out as a base condo (owners then walk, like hotels); harmless.
- **Network:** `condoHomes()` (end of `computeNetwork`): `C.slope`, `C.home = {tid, at}` (nearest trail sample, also pushed to
  `T.homes`), `C.homeTrails` (trails that reach that sample: joins above it, branches onto it) and `C.homeLifts` (lifts without a hubTop
  whose departing trails are in the set).
- **Guests:** owners and renters are hotel-style guests (`g.hotel = condo id`); owners also `g.owner` (pass, own gear, no ticket). Slopeside:
  `skiOut` glides onto the home trail in the morning (falls back to `arrivalFlow`); going home `toHotel` → `toCondo` queues for the nearest
  home lift, then `homeBound(g)` makes `topDecision` and branch choices in `updateSki` follow `homeTrails`, and `skiHome` (called in
  `updateSki` before stops) sends them to the door at `T.homes`. Tired guests passing their door go in for a rest (`goNap`). `hotelWake`
  skis slopeside guests back out. Walk fallback after 3 tries or close. Busy Saturday probe: 48 owners, 51 ski-ins (incl. rests), 3 walks.
- **Money:** `condoMorning(room, short)` in `openDay` after `bookHotels`: sales (`CONDO_SELL` 7%/day per listed home × mood × reputation ×
  ski-in × market), dues (`today.rev.condo`, held back below mood 50), owner visits (weekend/holiday/powder × mood) pushed to
  `today.hotelOut` with `owner: true`. `bookHotels` also rents unsold homes (`CONDO_RENT` 2.5× room price, `CONDO_GUESTS` 4, inside the
  `HOTEL_MARKET` cap). Sales go to cash only, **not** into the day's revenue/profit (leaderboards unchanged); dues and rentals are
  `rev.condo`, report line "Condo dues and rentals". `condoMarket()`: about one home per 20 average recent guests; past that, sales slow
  to 3% and prices drop up to 30% (stops slopeside townhomes being an endless money printer: each nets ~$700k otherwise).
- **Mood:** `state.owners = { mood }` (default 70, saved in `clock`). `condoEvening` in `endDay`: mood += (owners' average sat − mood) × 0.06,
  only on days owners went home. Below 40: reputation −up to 0.004/day; ≥80: +0.001. Price × (0.7 + 0.5 × mood/100). Toast on falling
  under 50. Measured in test 139: 3 bad days 70 → ~60s; a bad month → under 40.
- **Saves:** buildings carry `sold`, `sales`, `keep` (not for sale); all optional. A sold condo can't be moved or removed (card hides it).
  **Rollback warning:** versions before 2.80 don't know `condo` buildings; tell Phil before rolling back past 2.80.
- Tests: new 139-condos; 82-building-styles counts 22/44 → 25/50; 76-roadmap-new expects Condos `ongoing`.
- Ideas not done: condos on bought land parcels as a "village" bonus, owners eating dinner/après at home, a resale market when owners
  sell up, mid-mountain condos (need a lift down at night).

### 2026-10-31 · Claude · Hotels (shipped in 2.69)
- **Phil's decisions:** rooms fill night by night (no guests kept overnight), three fixed sizes, base only, all nine models now,
  room deals later with a marketing update. Plan and reasoning: `HOTELS_BRAINSTORM.md`.
- **Type:** `BTYPES.hotel` (`where: 'base'`, tiers Small/Medium/Large: 12/40/120 rooms, $300k/$900k/$2.4M via `sizeCost`, upkeep
  $900/$2,600/$7,000). New build tab `stay` ("Hotels"). Models `modelHotel`, `modelHotelModern`, `modelHotelScandinavian` (tier
  arg) with helpers `roomRows`, `modernFloors`, `scandiRooms`/`scandiBlock`; no seats; all fit their footprints (test 125 checks).
  No upgrade path between sizes (Phil: fixed sizes).
- **Sim:** `bookHotels(n, short)` in `openDay` (after `initBldSim`, which moved up): `hotelShare(B)` = day-of-week × room price ×
  ski-in/ski-out (`skiInOut`, base lift bottom or trail end within `SKI_IN_R` 10 of the door, ×1.25) × eatery nearby (×1.08) ×
  reputation. Total hotel guests capped at `HOTEL_MARKET` 0.6 × the day's demand; day visitors trimmed so the total stays under
  `MAX_G`. Rooms are paid at opening (`today.rev.lodging`, `B.today.rooms`), `ROOM_GUESTS` 2 per room. Schedule entries
  `{ hotel: id }` → `hotelOut` (like `busUnload`, no car). Leaving: `goCar` → `toHotel` → `then.k: 'hotel'` → gone. New guest field
  `hotel` is in `makeGuest`'s shape list. Room price: `state.prices.room` (default 180; old saves get it from `PRICE_DEFAULTS`).
- **Rest in the room (Phil's follow-up):** once a day (`napped`), with time left to ski (`napOk`: before `closeTime() - 100` and 45 min before
  `leaveAt`), a hotel guest heads in to rest: `goNap` marks `nap` and reuses the going-home route (`goCar` → `toHotel`); `arrive` with
  `nap` → `hotelNap` (hidden, `st: 'room'`, 40–75 min, no needs ticking) → `hotelWake` (−60% fatigue, warmed, restroom reset, +5) →
  `baseDecision`. Triggers: legs worn out (`updateLeaving`, instead of going home) or tired at the base (fatigue > 60%, 20% chance per
  base decision). Big-resort Saturday: 461 of 774 hotel guests rested; most would otherwise have gone home. New guest fields `nap`,
  `napped` are in the shape list. `today.naps` → `r.hotel.naps`.
- **Report:** `r.hotel = { rooms, all, guests, naps }`, "Hotel rooms" revenue line, a "hotels were N% full" note (priority 2), `B.yday.rooms`.
- **Rollback warning:** a version before 2.69 doesn't know `hotel` buildings (`nextBuildingName`, `MODELS` lookups would fail).
  Tell Phil before rolling back past 2.69.
- **Measured** (`tests/hotel-bench.mjs`, the 110-trail Juniper resort, Saturday, same seed; its 576-space lot turns ~3,600 away):
  no hotels = identical to main (1,384 guests, profit $1,161,025). With 3 large + 1 medium ski-in hotels (400 rooms): 97% full, 774 hotel
  guests, 2,179 guests, 794 fewer turned away, profit +$118k that day, satisfaction 99 → 99, save 176 → 183 KB, day sim 7.5 → 11.4 s
  (57% more guests). Weekday share is about 45% with ski-in. Room money alone pays a hotel back in roughly 2.5–4 seasons; faster where
  the lot is full, because hotel guests also buy tickets and food. Tune `hotelPull`/costs if players find it too strong.
- Follow-ups not done: room deals/packages (Phil: with a marketing update), booking forecast, slopeside hotels, lot-full advice pointing
  at hotels. `76-roadmap-new` now expects Ski-in/ski-out `ongoing` and Condos `plan`; update it if those cards change again.
- Tools: test 125 (models fit footprints, bookings, day, report, closed hotel, reload, phone menu); `tests/hotel-bench.mjs`.

### 2026-10-31 · Claude · Trail popularity and batch closing (shipped in 2.68)
- **Player request:** sort trails by popularity, batch close/open trails and glades for conditions, an end-of-day popularity summary,
  and a whole-day heatmap. Phil approved all of Claude's picks: condition buttons + "all shown" (no tick boxes), heat along each trail,
  rank by runs, no automatic close rule yet.
- **Trails list** (`trailsList`) now lists items from `runItems()`: trails plus glades (`{kind, id, name, t|A, lines}`); use `itemOpen`,
  `itemStatus`, `itemRuns`, `itemRunnable`. New Glades tab, Sort: Popular (second in the cycle; `19-manage` updated). Batch buttons:
  `bulkOpen` with `bad` / `good` / `open` / `close` → `setItemsOpen` (one Undo overnight, one `computeNetwork` for glades).
  **Close icy and thin** marks each with optional saved `snowClosed` (trail and area); **Reopen good ones** brings back only marked
  ones with good snow, so trails closed on purpose stay shut. Opening or closing by hand clears the mark.
- **Whole-day traffic:** `heatSample` runs once a game minute (`today.heatT`) and counts skiers in `HEAT_BINS` (16) sections per
  trail (`today.heat`). At day end `state.dayUse = { day, runs, night, heat }` (saved in clock, about 5 KB on 110 trails, **not** in report
  history). `overlay.traffic` is now `false | 'now' | 'day'`; `cycleTraffic` steps through them. `prepHeat` normalises
  skier-minutes per area to the top 5% (red); `paintHeat` writes ribbon vertex colours and restores a saved copy (`t.baseCol`) when off.
  Glades have no ribbon, so they aren't on the heat map (they are in the list and report).
- **Report:** `r.trailsDay` (top 5, quiet open items under 1% of runs, totals, night runs), a Trails tab, a "Busiest trails" line in
  the summary and a **See today's traffic on the map** button (next morning, Popular sort, Day traffic on).
- **Measured** (`tests/heat-bench.mjs`, the 110-trail resort, same seed; Juniper's lot caps the day near 1,400 guests): guests, satisfaction,
  injuries and profit identical to main; painting the map 8 ms; list render 13 ms; report adds 350 bytes. Test 124.

### 2026-10-31 · Claude · Guest area walking fixes (shipped in 2.67.1)
- **Two player reports (same Twin Notch resort, public save).** Rebuilt it on fresh terrain from its lifts, trails, buildings and
  area cells (read through SQL, kept out of the repo; this container can't reach Supabase or mtmogul.com over HTTP) and ran a 4,400-guest day.
- **"Floating" down from the summit, thought "The lift was closed, so I had to hike out":** `seatTaken` (2.66) sent guests from a full seat in an area
  to a free one within 15 units, even outside the area (325 that day). Leaving it, `hubDecision` ran from off the painted cells, found no choices
  and fell back to `hikeOut` (−12, "stranded", straight walk to the car). All 108 strandings came from three benches beside the summit area.
  Fix: `seatTaken` keeps area guests in their area; `hubDecision` walks an off-area guest back to the nearest cell first (`then.k: 'hubBack'`). 108 → 0.
  `hikeOut` is a generic fallback with a closed-lift thought; worth a more honest message one day.
- **Walking through buildings:** areas walked over every painted cell, buildings included (42% of legs in that west base crossed a building).
  Now `A.walk` = painted cells minus building footprints (`boxOf(B, 0.15)`), plus the door step and a one-square path around each area building (so
  a door facing off the area still connects); `hubRoute`/`hubSees` use it, falling back to all painted cells (`A.routesAll`) if a building cuts
  the only way or a guest stands under one. `basePoint` and `hubBaseCell` now prefer walkable cells (the old base point sat under a ski school,
  so everyone heading home cut through it). 42% → under 0.5%. "Turning around at the door" was mostly restroom stops (30% of fine-dining visits).
- **`17-base-snow` flake fixed (it failed ~40% first try on main too):** on busy first days five or more priority-4/5 notes (goal, rescue,
  operations, lot full, left early) pushed the bare-base note (4, added late) past `NOTES_SHOWN` into "More about today". Now priority 5.
  Same 12 seeded days: hidden 5/12 → 0/12.
- Walkers may now step one square off the painted area around a building. Big 18-area resort: day time and `computeNetwork` unchanged. Test 123.

### 2026-10-31 · Claude · Widen and shape trails (shipped in 2.67)
- **Phil's decisions:** shape section by section (not one width); charge only new ground; grooming and snowmaking scale with
  width (Medium = the old price, so narrow trails got cheaper and wide ones dearer for existing resorts).
- **Data:** optional `t.ws`: half-widths at evenly spaced stations top to bottom (3–12 of them, `HW_MIN` 1.0 to `HW_MAX` 6.0), blended
  with smoothstep into `s.hw` on each sample (`shapeSamples`). No `ws` means the preset all the way; a shape equal to a preset is stored
  as that preset. `measureWidth` sets `t.hwMax`/`t.hwAvg`. Use `trailHW(t)` (widest) for "near the trail" checks and `sampleHW(t, s)`
  per sample; **never `TRAIL_WIDTHS[t.width].hw` on a built trail any more**. `widthFactor(t)` drives `groomCost(t)`, `gunCount(t)` and crowding.
- **Pricing:** `newGroundArea(samples, trails)` counts half-unit points across the new ribbon not already under any trail (0.1 tolerance;
  without it reapplying the same shape cost $2,000). × `GRADE_AREA` (135/unit², about the presets' rate). Plus trees, extra bridge deck
  (`BRIDGE_PER_HW`) and extra snow guns if snowmaking is on. **Edit route** now uses the same new-ground grading (it used to re-charge the
  whole trail) and keeps the shape.
- **Tool:** `startShape(t)` → tool `'shape'`, `draft.shaping`, `draft.ws`; edge dots from `syncShapeHandles`, placed in `updateHandles`.
  Open: a `kind: 'shape'` plan `{trail, name, pts, ws}` (one per trail), built by `buildShapePlan`, refused if the route changed.
- **Rollback warning:** a version before 2.67 would try to draw a saved `'shape'` blueprint as a building and fail. Shaped trails themselves
  load fine there (as their preset width). Say so to Phil before any rollback past 2.67.
- Full GitHub Tests run 41218089205 passed on `0318b61` (the first run failed only `81-glades`, whose expected grooming bill used the old flat formula).
- Test 122 (drag on a real dot at 1280×900 and 390×844, pricing, upkeep, save/reload, blueprint built overnight, Edit route pricing).
  `tests/shape-bench.mjs` measures it on the 110-trail resort (Juniper's lot caps it near 1,400 guests): evaluating a shape takes ~7 ms
  (worst 23 ms) per drag update; unshaped, the day is identical to main (same guests, satisfaction, injuries, revenue); grooming there
  rises $40,559 → $43,422/night from the width scaling; shaping 34 trails cost $203,850.
- Phones: the shape card opens compact (`layoutSheet` placing set). Zoomed out, the edge dots crowd a trail; zooming in fixes it.
- `17-base-snow` is flaky on main too (its report note sometimes loses to others); with the same seed main and this branch give identical days.
- No roadmap card covers this, so the roadmap is untouched.

### 2026-10-30 · Claude · Guest areas on any slope (shipped in 2.66.1)
- **Phil's request:** players with base villages built on slopes before 2.65 couldn't paint them. Steep ground no longer
  blocks painting; it shows amber (`HUB_STEEP_MAT`) and **Level steep ground** stays optional. `climbPace(g)` slows walkers
  on `hubWalk` legs uphill: `1 / (1 + 2.3 × grade)` over the next unit (about 60% pace at 30%, 30% at 100%), full pace
  downhill. No new fields. Test 118.
- **Bug found while testing (live since 2.65):** a hungry skier arriving at a lift top inside a guest area (`hubTop`) ran
  `topDecision → seekMeal({k:'top'})`, whose plan re-entered the area and chose "walk to this top": the same spot, every
  step. Loopers piled up from lunch (39 by 11:45) until a 26-lift resort with areas around every lift froze the browser
  (main too). Fix: start the plan from `outside: skipHub`. Test 121 reproduces it on 2.66 (79 decisions in 40 steps).
- **Big resort with 18 areas (8,151 squares, half steep), 5,000 guests:** whole day runs in about 60 s (it never finished
  before); slow climbing changes satisfaction 86 → 86. About 280 "stranded" complaints appear with or without slow climbing,
  so they come from something else: not investigated yet. Worth a look next.

### 2026-10-30 · Claude · Seats and lift lines (shipped in 2.66)
- **Phil's decisions:** seats have no line at all ("skip the line", not a shared waiting area); for lifts, both a check
  before joining a long mid-mountain line and switching from far back in a slow line.
- **Seats:** `outdoorSeat(B, svc)` (decor + seat pool) and `seatTaken` in `joinBuildingQueue`: a full bench, table or
  fire pit sends the guest to the nearest free one within 15 units (fire pits only for warm-ups and après fires), else a
  café/lodge for warm-ups, else they carry on (`restT` set so they rest again in ~15 min). `bldStep` releases old seat lines
  from earlier saves the same way. No new guest or save fields.
- **Lifts:** `lineAhead(L, k)` (`liftWait` uses it), `liftsBeside(L)` (mid lifts: `liftTransferMode` from the bottom; base lifts:
  same base area within `TRANSFER_R`), `shorterLift` (only for waits of 5+ min, only lifts at least 3 min shorter, compares
  `vLift` so terrain from the top still counts; a +2 margin for losing a place) and `hopLine`. Used at trail ends at
  mid-mountain lifts (`endOfTrail`) and every 3 game-minutes in `case 'queue'` (reuses `g.qLook`, a food-line field).
  `today.lineHops` counts switches (not shown to players yet). Test 120.
- **Measured** (`tests/line-probe.mjs`: big Juniper resort with a transit center, ~5,000 guests, 64 seats and 6 fire pits,
  three seeds): seat waits over 5 min 708–855 → 0, annoyed give-ups 126–153 → 0, seat visits −2%, satisfaction unchanged,
  same speed. Long base-lift joins rose 8–22%: the seat change alone does that (guests ski instead of standing in seat lines).
  That resort's mid-mountain lifts never had long lines, so lift switching (13–42 a day there) is proven by test 120,
  not by a big resort.
- **`22-topbar` flake fixed:** random fresh snow adds "+2″" to the weather, and at 900 px the tightest one-row layout then
  fits with only 16 px spare, short of the 24 px a fresh fit wanted, so `fitTopBar` dropped to `tb-low`. The step before
  `tb-low` now accepts a plain fit. Main failed the first try about 1 in 3; 8 of 8 first-try passes after.

### 2026-10-30 · Claude · Guest areas taken over (`claude/guest-areas`)
- Phil handed ChatGPT's `feature/paintable-areas` to Claude; ChatGPT has stopped on it. Leave that branch as is. Its GitHub
  runs were red; locally 115 raced the 0.6 s title fade (fixed with a wait).
- **Walking:** guests used to step cell by cell along one shared BFS tree per destination (single file, on grid lines).
  `walkHub` now keeps only the corners (`hubSees` line-of-sight over painted cells), shifts corners by a per-walk lane,
  bends long legs and stores a pace `sp` in the walk's `then` (no new guest fields; `case 'walk'` multiplies `WALK`).
  Every leg is checked to stay painted; the destination is exact. Test 117.
- **Phil's decisions:** 30% walking limit (`HUB_MAX_GRADE`, same `GR` the game uses), **lifted in 2.66.1** (see the note above);
  `hubLevel` cut-and-fills the area to 30% with a bank up to 6 points outside (capped at 90% or the original slope,
  whichever is steeper; a 3-point bank made 214% cliffs), never moving trail ribbons, lift
  stations (3.5), buildings, lot, road or creek; cost uses `GRADE_COST`. 15 free acres per resort across all guest areas
  (`HUB_FREE_CELLS`), then $5,000/acre; a free allowance instead of a cash gift, so balances and leaderboards are untouched.
  Base-only buildings (`where: 'base'`) may go in an area with a base edge. Test 118.
- **Integration fix:** guests arriving from the lot used to glide straight to a lift or shop up in a base-touching area
  through the trees (273 moves in test 119's day on the old code, 0 now). `viaHub` sends them to the nearest base-edge
  cell (`A.baseCells`) first; `goCar` walks inside the area down to its base edge. Routes to uncommon cells are computed
  lazily by `hubRoute` and cached until the next `computeNetwork`; don't precompute every base cell (hundreds of floods).
- **Audit results:** network checks see areas first; Twin Notch with painted areas at both bases plays normally (no strandings,
  walkers stay inside); trail/lift/building moves rebuild the network only on confirm. Injured skiers out on a trail still
  walk straight down (existing behaviour, not area-related).
- **Rollback warning:** a version before 2.65 loads `kind: 'hub'` areas as learning areas (groomed nightly, beginner
  routing). If 2.65 ever needs rolling back, say so to Phil first.
- Tools: `tests/big-resort.mjs` builds a 26-lift, 110-trail Juniper resort (about 3 minutes; Juniper's lot caps near 576
  spaces); `tests/hub-bench.mjs` compares main, the old branch and this one on it; `tests/hub-walk-probe.mjs` measures walkers.

### 2026-10-30 · ChatGPT · Painted guest areas (2.65 candidate)
- Further preview edits: fences and selected orange outlines now leave gaps across entire trail ribbons, refreshed on every network rebuild (including new/moved trails). A shared spatial mask avoids repeated full-trail searches for each boundary section.
- Bulldoze targets cached individual fence sections and snow gun models. Optional saved `areas[].noFence` stores canonical edge keys; optional `world.noGuns` stores owner/position keys. Both default empty in older saves and participate in existing Undo. Gun effect positions, operating snowmaking, gun counts and expenses are retained; only instanced models are hidden.
- Added 116 for whole-trail gaps, changing crossings, phone hit testing, free one-section removal, hidden model versus running effect/costs, real reload and Undo. Local Three.js geometry, model visibility and route checks pass; Chromium remains unavailable locally. Full GitHub run is required and Phil will report the result.
- Phil’s preview revisions: preserve ground/snow/trees; remove the filled tint in drafts and built areas; `areas[].fenced` is optional and defaults off. The area card toggles the fence independently of routing. Starting a new paint stroke inside an existing area edits it automatically. Partly blocked successful strokes no longer spam warnings; disconnected patches remain invalid.
- Paint strokes now draw once per pointer sample and keep only draft-cell undo history, avoiding whole-resort snapshots for each draft stroke. Added 115 to exercise actual mouse/touch canvas painting at 390×844 and desktop; expanded 114 for unchanged terrain/trees, extending areas and saved fence switches.
- Prior GitHub run 41098821006: scenario 113 passed; 32-old-saves passed all 48 fixtures. Full run failed in the extracted `tests/express-routing.mjs` setup because new hub dependencies were absent. Updated that setup to load the real hub functions/constants; it now passes locally. Updated full suite still required.
- Local Three.js geometry checks pass for outline-only drafts, extending existing areas and fences on/off. No 2.65 crash records were found during this investigation; the exact wording of any remaining player-visible errors is still needed if they persist. Browser execution remains unavailable locally.
- New branch from current main, ignoring `feature/paintable-guest-hubs-preview`. `kind: 'hub'` areas use the real terrain brush, connected-cell validation, free launch pricing (`HUB_CELL_COST`), rename/edit, per-stroke Undo/Clear, selection outlines and an optional saved boundary fence (off by default).
- `computeNetwork` caches each area’s endpoints, buildings and cell-parent walking routes. Hub reachability/return propagation covers trail/lift chains and base-touching areas. Guests use existing `then`/`resume` fields for serializable walking, with no added per-guest fields. Food routing includes areas; Twin Notch’s base/crossing rules remain in use.
- Area snowmaking uses `gunCount`/`snowmakingCost`, adds ground snow like base guns, and joins the existing snowmaking expense accumulator/report. Saved optional `areas[].sm`; older saves need no migration. Expanding an equipped area charges for additional equipment.
- Added 113 (mid/summit/base transfers, cost/report, reload) and 114 (390×844 and desktop cards, free paint, rename/edit, equipment, visit guard). Optional `SHOTS=1` captures real rendered day/night views in `/tmp/painted-area-shots`.
- Local JavaScript syntax and focused extracted-game-function checks passed (network chains, route values, connected paths, area snowmaking, and food reached via an upper lift). Browser scenarios including `32-old-saves` could not start: Chromium is absent and its download failed. Full GitHub suite is required; phone/desktop visual QA remains pending. Pause for Phil’s test result after pushing; do not merge.

### 2026-10-29 · Claude · Tidied this file
- Phil asked for a tidy-up: the notes had grown to about 600 lines of release logs. I removed the notes for
  shipped work (2.47–2.62.6) and moved what still matters into Current status, Known issues and Decisions and
  lessons. Nothing that's still open was dropped. The full notes are in git history before this commit.
- Corrected the `index.html` size (about 18,000 lines) here and in `CLAUDE.md`.
