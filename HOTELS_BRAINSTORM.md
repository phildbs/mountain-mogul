# Hotels: brainstorm (Oct 31, 2026)

A design sketch for Phil to choose from. Nothing is built yet. Written by Claude after reading the guest, demand,
building and theme code. Numbers marked *first guess* will be tuned in a test resort before release.

## Why now
- Roadmap votes (live database, Oct 31): **Hotels 18 up / 0 down**, tied with Terrain parks for first. Condos 17,
  Ski-in/ski-out 14. Two feedback notes this week ask for it ("Hotels, hostels, and vacation rentals!", "stay overnight").
- The game has a real problem a hotel fixes: **parking caps big resorts.** Juniper's lot tops out near 576 spaces, so
  our 110-trail test resort can't pass ~1,400 guests a day. Hotel guests need no parking space.
- Weekdays are quiet by design (demand × 0.4 Mon–Thu). Hotels give players a reason to care about midweek.

## The big idea in one line
A hotel is a base building with **rooms**. Each night some rooms fill; next morning those guests walk out of
the hotel door, ski first chair, spend the evening at your bars and restaurants, and walk back. Each booked room
earns a room rate every night.

## 1. How it works in the game

### Recommended: rooms fill night by night (no long-lived guests)
- Every night the game works out each hotel's **occupancy** for the next day, then spawns that many guests from its door
  in the morning. This reuses the town-bus arrival (`busUnload`: a guest with no car), so it is not a new kind of guest.
- "Guests stay several days" is shown as flavour (thoughts like "Day 3 of our ski week!"). Nobody is stored overnight.
  Reasons: saves stay small (big resorts already save 1.5 MB+), 2.64.1's speed work stays intact, old saves just work.
- **Alternative (not recommended):** real guests who check in for 2–7 nights and remember yesterday. Richer, but adds
  per-guest saved data for thousands of people, and a mid-day save/reload has to carry them. Phase 3 at the earliest.

### What fills rooms (first guess)
`occupancy = base for the day × rate effect × quality × location × amenities × reputation`, capped at 100%.
- **Day:** weekends and holidays fill (~90%), Friday nights strong, Mon–Thu low (~35%). Powder forecasts and events
  add bookings, like they already add day visitors.
- **Room rate:** player sets it per hotel (default ~$180). Higher rate, fewer bookings, same curve shape as tickets.
- **Location: ski-in, ski-out.** A trail ending or a base lift starting within a short walk of the door: +20–30%.
  This *is* the "Ski-in, ski-out" roadmap card, so it ships for free as part of hotels.
- **Amenities nearby:** a restaurant, fine dining or bar within a walk; après on; night skiing. Gives the existing
  evening features a second reason to exist.
- **Reputation:** the resort's existing score, so a bad day hurts next week's bookings.

### What hotel guests do differently
- Leave the hotel 8:15–9:15 (earlier than drivers), so they're first in the lift lines.
- More of them stay for après and night skiing; a few go for dinner at fine dining.
- No parking fee, no ticket fee if their stay includes a lift ticket (see packages), but they still buy food,
  rentals and lessons.
- Head back to the hotel, not the lot, when they're done. A long walk back is a small complaint.
- They count towards today's guest total (and the 5,000 cap), so a full hotel squeezes day visitors on a powder Saturday,
  as in real life.

### Money (first guess)
| | Inn (small) | Hotel (medium) | Grand hotel (large) |
|---|---|---|---|
| Rooms | 12 | 40 | 120 |
| Guests when full | ~26 | ~90 | ~260 |
| Build cost | $300k | $900k | $2.4M |
| Upkeep a day (staff, heat) | $900 | $2,600 | $7,000 |
| Room revenue, 60% at $180 | ~$1,300 | ~$4,300 | ~$13,000 |

Payback around 3 seasons for a well-placed hotel, longer for a poor spot. Like other buildings, it can be closed
on quiet days through the operating plan, which saves part of the upkeep. It's a late-game money sink with a
slow, steady return; it shouldn't beat lifts and trails as a first purchase.

### Player controls (hotel card)
- Tonight: booked rooms / total, guests out on the hill now, room rate (+/−).
- Last 7 nights' occupancy as a small bar strip, and what's helping or hurting ("Ski-in, ski-out +25%",
  "No restaurant nearby").
- **Phase 2: packages**: "Stay and ski" (ticket included, −15% on the room) and "Midweek deal" (Sun–Thu only),
  which fill quiet nights at lower margins.

### Report and advice
- A new **Lodging** line in revenue, and a note: "Your hotels were 82% full; 214 hotel guests skied today."
- Advice: "Your lot was full by 10:00. A hotel brings guests who don't need parking."

## 2. Models: three sizes × three themes

Nine models. Each size has one footprint and door spot shared by all themes (the existing theme rule), so restyling
just works. Built from the same `Kit` parts as lodges, with a helper that stacks floors of rooms and windows so the
nine models share most of their code.

| Size | Footprint (world units) | Height | Shape |
|---|---|---|---|
| Inn | 4.0 × 3.0 (40 × 30 m) | 2 floors | A house-sized building |
| Hotel | 6.0 × 3.6 | 3–4 floors | A long block with a central entrance |
| Grand hotel | 9.0 × 5.0 | 5 floors + wings | An L or U shape with a porte-cochère and a terrace |

For scale: today's Large lodge is 7.2 × 4.6 and about 1.3 tall, so the Grand hotel would be the biggest building on the map
without towering over the lifts.

**Classic** (log lodges): stone ground floor, log walls, steep green or brown gables, wooden balconies on every
floor, chimneys. Inn = a timber B&B; Grand = a classic national-park lodge with a tall gabled centre.
**Modern** (flat roofs, big glass, dark metal): stacked offset boxes, floor-to-ceiling glass, thin balconies,
a rooftop hot-tub deck on the Grand.
**Scandinavian** (painted timber): steep black roofs, red/ochre/white boarded walls, small square windows, the Grand as
a cluster of connected painted houses round a courtyard.

**Night is the payoff:** a grid of `BM.glow` windows, some lit, some dark (occupied rooms lit after dusk). A full hotel
glowing at the base is the best "my resort is alive" picture we could add, and it shows occupancy without numbers.

Cost to the frame rate: one hotel is about as heavy as a Large lodge. The window grid is the risky part, so it goes
in as a few merged pieces, not a separate box per window.

## 3. Where you can build
- **Recommended for the first release:** base only (`where: 'base'`), including guest areas that touch the base.
  Guests just walk out the door, and the ski-in/ski-out check uses lifts and trail ends near the base.
- **Later:** slopeside and mid-mountain hotels inside guest areas (2.65 already lets guests walk around there).
  Mid-mountain guests need a lift down at the end of the day and a way up in the morning, which is new routing work.
- Road-frontage land ($900k) becomes worth buying: room for a hotel row along the road.

## 4. Saves and safety
- New: building type `hotel` with `tier`, optional `B.rate` (default when missing), and an optional
  `state.lodging` tally for the report. Old saves need nothing.
- **Rollback warning:** a version before hotels would not know a `hotel` building and would likely fail to load
  a save that has one. Same kind of warning as guest areas (2.65) and trail shaping (2.67).
- No database change. Leaderboards just see more profit.

## 5. Suggested releases
1. **2.69 Hotels:** three sizes, Classic models for all three plus Modern and Scandinavian, nightly occupancy, room rate,
   ski-in/ski-out bonus, morning arrivals from the door, Lodging on the report, guide and roadmap.
   (If nine models is too much for one go, ship Classic first and the other themes in 2.69.x.)
2. **2.70 Packages and evenings:** stay-and-ski and midweek deals, hotel guests eating dinner, a booking forecast for the week.
3. **Condos (separate card):** reuse the hotel models with a "sell units" card: cash up front, owners visit all season and
   pay dues, and they get unhappy if the resort runs down.

## 6. Tests
- New scenario: build each size and theme on a levelled pad; check occupancy rises on weekends, with ski-in/ski-out and with a lower
  rate; guests come out of the door, ski and go back; revenue and upkeep on the report; save/reload; `32-old-saves`.
- Big-resort check (`tests/big-resort.mjs`, 26 lifts, 110 trails) with three Grand hotels: day time, frame time at night,
  save size, and that the lot cap no longer limits the day.
- Phone (390 × 844) and desktop screenshots by day and night.

## Questions for Phil
1. **Depth:** rooms fill night by night (recommended), or real guests who stay for several days?
2. **Sizes:** three fixed sizes (Inn / Hotel / Grand hotel), or build small and upgrade in place?
3. **Where:** base only to start (recommended), or slopeside and mid-mountain too?
4. **First release:** all nine models at once, or Classic first with Modern and Scandinavian after?
5. **Packages:** in the first release, or after?
