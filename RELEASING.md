# Releasing Mountain Mogul

Players are on the live site, so every release follows the same steps.

1. Work on a branch. Bump the top entry of `CHANGES` in `index.html` (that is the version).
2. Run the full suite: `cd tests && node run.mjs` (includes `32-old-saves`, which loads saves
   from every earlier release and plays a day on each). `node run.mjs all` adds the slow economy test.
3. Fast-forward `main` and push. GitHub Pages deploys it.
4. Check the stats page (mtmogul.com/stats.html) over the next day for new errors.

## Something broke

`./tools/rollback.sh 2.11.5` (on `main`) puts the previous release back live in a minute or two.
Players with the new version open get the update banner and reload into the old one.
Database changes are always additive (new tables or functions), so they never need undoing.

## Old saves

`tests/fixtures/saves/` holds saves made by each release (v2.7 onward; three mountains, at night
and mid-day). After a release, add its saves so later releases are checked against them:
`node tests/capture-saves.mjs <checkout of the release> <version>`.
