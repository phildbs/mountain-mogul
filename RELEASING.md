# Releasing Mountain Mogul

Players are on the live site, so every release follows the same steps.

1. Work on a branch. Bump the top entry of `CHANGES` in `index.html` (that is the version).
2. Test what changed: run only the scenarios that cover the change (`cd tests && node run.mjs 38-community 41-likes`),
   plus screenshots where it's visual. Run the full suite (`node run.mjs`, about 10 minutes; `all` adds the slow economy
   test) only when the owner asks for it. `32-old-saves` is the one to add whenever saves or loading change.
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
