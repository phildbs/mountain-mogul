# Mountain Mogul

Build a ski resort on an untouched mountain: clear trees, cut trails, run chairlifts,
and keep thousands of skiers happy through a full winter of weather.

**Play:** https://mtmogul.com/

## How it's put together

- `index.html` is the whole game (three.js for the 3D mountain).
- `vendor/` holds the libraries it loads: three.js r128 and supabase-js 2.110.0.
- Online features (accounts, cloud saves, leaderboards, visiting other resorts) use
  [Supabase](https://supabase.com). `supabase/schema.sql` creates the one table they need.
- The page is served by GitHub Pages straight from the `main` branch.

## Setting up Supabase (one time)

1. SQL Editor → New query → paste `supabase/schema.sql` → Run.
2. Authentication → Sign In / Providers → turn on **Allow anonymous sign-ins**
   (players start as guests, no sign-up needed). Email should already be on.
3. Authentication → URL Configuration → set **Site URL** to
   `https://mtmogul.com/` and add the same address under
   **Redirect URLs**, so email sign-in links come back to the game.

The publishable key in `index.html` is meant to be public. Never put the secret or
`service_role` key in this repository.

## Tests

`tests/` drives the game in a headless browser against a stand-in for the online database
(`tests/fake-supabase.js`), so nothing touches the real Supabase project. Each scenario checks
one area: saves and multiple mountains, switching mountains, the tutorial, loans, bankruptcy,
visits, auto-advance, balance, goals and passes, operations plans, the mountain builder, the
Manage panels and more.

To keep runs quick on machines without a graphics card, the tests play the game without drawing
the 3D view (the simulation and every panel still run). The mountain-switching scenario draws it,
so a broken scene still fails; pass `render: true` to `openGame` to draw in any other scenario.

```
cd tests
npm install
npx playwright install chromium   # first time only
node run.mjs                      # everything but the season-long balance check (about 5 minutes)
node run.mjs all                  # everything, balance check included (about 10 minutes)
node run.mjs loans visits         # just the scenarios whose names match
```

Run them before publishing a change to `main`. The game file itself isn't modified: the
harness builds a debug copy on the fly.

## Copyright

© 2026 phildbs. All rights reserved. The code is public to read, but it isn’t licensed for reuse,
copying or redistribution.
