# Summer season: brainstorm (Nov 9, 2026)

**Phil's decisions so far (Nov 9):** a short playable summer (expand later if players like it); scenic lift rides,
weddings and events, a mountain coaster and mountain biking all ship together as one major release (**4.0**).

A design sketch for Phil to choose from. Nothing is built yet. Written by Claude after reading the season, demand,
sightseer, events and tree code. Numbers marked *first guess* will be tuned in test resorts before release.

## Where the game is now
- Summer exists as a quiet build phase (`state.summer`): the snow goes, the mountain turns green, nothing earns.
- It costs money: 199 days of overhead at 35% plus loan interest, taken in one lump when the next season starts
  (`newSeason`). A 5-lift resort pays about $300k for the summer before interest.
- Already there to build on: sightseers who buy a scenic gondola ride in winter (6% of visitors, with its own price),
  hotels and condos, restaurants and bars, the events system (race weekend, torchlight parade, pond skim), operating
  plans, and the summer weather type (sunny, 72°F).

## The big idea in one line
After the snow melts you play **12 summer days**, from June to the fall colours, with summer guests riding your lifts,
bikes, coaster and filling your venue, so the summer bill becomes summer income.

## 1. How summer is played

### The calendar (first guess)
- Six stops, each a **weekday and a Saturday**: late June, the Fourth of July, late July, mid-August, Labor Day and
  **fall colours** in early October. Twelve days in all, about a tenth of a winter.
- Today's lump summer bill is spread over those days instead, so every day report shows income against upkeep.
- You build between days, just like now. Things built in summer are ready the next morning.
- **Skip to winter** is always there. A resort with nothing for summer plays exactly as it does today: one tap, same
  bill. Nobody is made to play summer.

### Summer guests
- **Sightseers** ride a lift up for the view, wander, eat at the top and ride down. In summer they ride chairlifts
  too, not just gondolas, and chairs carry people down as well as up.
- **Bikers** lap the bike trails like skiers lap ski trails.
- **Coaster riders** are mostly families: a few rides, lunch, the gift shop.
- **Event guests** come for a wedding or festival, fill the venue, the hotel and the bars.
- How many come: reputation and resort size as in winter, then weather, what you offer and your prices.

### Running the resort in summer
- You choose **which lifts run**. Each open lift costs its usual hourly rate, so running the whole mountain for
  forty sightseers loses money. That is the main summer decision.
- A fourth operating plan, **Summer**, sits beside weekday, weekend and quiet: hours and staff for every building.
- Rental shops rent bikes, the tuning shop fixes them, ski patrol becomes bike patrol, and the clinic stays busy.
- Hotels fill by summer draw (events most of all). Condo owners visit and keep paying dues.

### Summer weather
- Sunny, hot, cloudy, rain and **thunderstorms**: lightning stops the lifts for an hour or two, like a wind hold.
- Rain makes bike trails muddy and sends wedding guests under cover.
- **Fall colours:** a share of the trees low on the mountain turn gold and orange for the last stop, and scenic
  rides roughly double. This needs new tree colouring, since today every tree is an evergreen.

## 2. The four attractions

### Scenic lift rides
- Works with what players already have. Uses the existing scenic ride price (default $25).
- More riders with: a restaurant or hut at the top, a **lookout deck** (new small building), a gondola, and height
  gained. Fall colours is the peak.
- Some riders walk down a ski trail instead of riding, so the mountain looks alive.

### Weddings and events
- A new building, the **event pavilion** with a lawn, in all four themes. At the base it's easy to reach; at the top
  of a lift it pays more, and guests ride up, so that lift must run.
- **Bookings come to you** between summer days: "A wedding, 140 guests, on Saturday. Pays $38,000." Accept or decline.
  Bigger and better-paid offers come with reputation.
- What makes it go well: enough room, a restaurant for the catering (yours, or a caterer takes a cut), hotel rooms
  for the guests, parking, and dry weather or a roof. A good one lifts reputation; a washout hurts it.
- You see it: a tent, rows of chairs, an arch, a small crowd, string lights in the evening.
- Bookable summer events, like winter's: **summer concert**, **bike race** (needs a black bike trail) and a
  **fall festival** on the colours weekend. Midweek **company retreats** fill hotels on quiet days.

### Mountain coaster
- You draw the track downhill like a trail, ending by a base. The haul back up is built for you beside it.
- Pay per ride (*first guess* $15). It has a line, a rate of riders per hour and a station building.
- Costs by length, roughly a fixed-grip chairlift (*first guess* $1.5M to $3M).
- **Recommended: it runs in winter too,** as real ones do, with fewer riders. It then earns all year and gives
  non-skiers in a family something to do.

### Mountain biking
- **Recommended: bike trails are their own thing**, drawn with the trail tool but narrow, winding and cheap, with
  hardly any trees cut. Rated green, blue or black by steepness, like ski trails. Real bike parks work this way, and
  it keeps ski trails and bike trails from getting in each other's way.
- **Alternative:** let bikes use ski trails. Much less to build, but straight wide runs make dull, too-steep bike
  trails, and there is nothing new to design.
- Lifts need **bike carriers**, a one-off fitting per lift. Gondolas take bikes as they are.
- A bike park day ticket (*first guess* $55). Bikers rent, eat, drink and get hurt like skiers do.
- Instead of grooming there is a **trail crew**: trails wear with use and rain, and rough trails cost happiness.
- This is the largest piece: a second trail network, riders who look and move differently, and its own upkeep.

## 3. Money (first guess)
- Aim: a resort with everything earns about **15 to 25% of a winter's profit** over the summer, close to real
  resorts. Scenic rides alone should cover about half the summer bill.
- Summer must never beat winter, or the best strategy becomes ignoring skiing.
- A wedding is the best single day; biking is the steadiest earner; the coaster pays back slowly but all year.
- All of this gets tuned with test runs on small, medium and large resorts on each mountain.

## 4. King of the Mountain
- **Recommended: matches keep today's summer for 4.0** (one quiet build turn). Playing summer days in a match means
  teaching the match server a new kind of day and re-balancing every match map. Better as a follow-up.
- Coasters and pavilions can still be built in a match; they simply have no summer to earn in (the coaster earns in
  winter).

## 5. Saves and safety
- Everything is new and optional. An old save changes nothing until the player builds a summer attraction.
- New save fields all get defaults: the summer day, bike trails, coaster, bookings, the summer plan.
- A save made in the middle of summer loads in the middle of summer.
- Bike trails are stored apart from ski trails so the winter network code doesn't trip over them.
- No database changes are needed for the first release.

## 6. How to build it without it going stale
`main` has had about five releases a day this week, all in the one `index.html`. A summer branch left alone for
weeks would clash with all of them.

- **Recommended: build it in pieces behind a hidden switch.** Each finished piece is published to `main` but stays
  invisible to players (only a preview link with `?summer=1` turns it on). Phil plays each piece from a preview link.
  When all four are in and balanced, 4.0 flips the switch: still **one release for players**.
- **Alternative:** one long branch, rebased onto `main` every day. Simpler to explain, but more merge trouble and a
  bigger, riskier single merge at the end.

Order of work either way: summer days with scenic rides and fall colours, then weddings and events, then the
coaster, then biking, then balance, the guide, the roadmap card and the changelog.

## 7. Tests
- New scenarios: a full summer played and skipped; old saves untouched; a mid-summer save; scenic riders on a
  chairlift both ways; a wedding booked, held and paid; coaster rides in summer and winter; bikers lapping with
  carriers fitted; lightning hold; matches unchanged.
- `32-old-saves`, plus a speed check on the 110-trail test resort so summer days are no slower than winter ones.

## Questions for Phil
1. **Length:** 12 days (a weekday and a Saturday at six stops, June to fall colours), or shorter or longer?
2. **Bike trails:** their own narrow trails (recommended), or bikes on ski trails?
3. **Coaster in winter:** runs all year (recommended), or summer only?
4. **Zip line and alpine slide:** both are on the roadmap card. In 4.0, or after? (Recommended: after. A zip line
   could be drawn like a lift and added soon after.)
5. **Matches:** leave summer as it is in King of the Mountain for 4.0 (recommended)?
6. **How to build:** hidden pieces on `main` with one switch-on at 4.0 (recommended), or one long branch?
