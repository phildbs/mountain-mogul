# Mountain Mogul: working rules

A browser ski-resort tycoon by Phil (MossQuake). Live at mtmogul.com, served by GitHub Pages from `main`.
These rules apply to every AI assistant working here (Claude and ChatGPT). The long version, with the
release checklist and shared notes, is `AI_HANDOFF.md`. Read it at the start of a session.

## The project
- `index.html`: the whole game in one file (about 18,000 lines, three.js, no build step). `CHANGES` near the
  end is the player-facing changelog.
- `guide.html` (how-to), `roadmap.html` (ideas and votes), `stats.html` (owner-only dashboard), `privacy.html`.
- `supabase/*.sql`: database functions and tables (project `iwhhoneaxmeiktqzwxjs`). `tests/`: Playwright scenarios.
- `STYLE_GUIDE.md`: colours, fonts, icons, 3D art and writing style. `RELEASING.md`: rollback and release details.

## How Phil works
- **Branch, preview, wait.** Work on a branch, push it, and send a preview link:
  `https://raw.githack.com/phildbs/mountain-mogul/<full-commit-sha>/index.html`.
  Say to play as a guest and not sign in: previews keep separate saves, but feedback and votes go to the live database.
  A link is preferred over lots of screenshots.
- **Only merge to `main` when Phil says "Publish".** Then `git merge --ff-only <branch>` and push. Approval
  for one change doesn't cover the next.
- Explain things in plain words. Phil reads on a phone. Keep reports short: what changed, how it was tested,
  the link.

## Every release
1. Start from current `main`. Claim the branch in the Work in progress table in `AI_HANDOFF.md`.
2. Add an entry at the top of `CHANGES`: `{ v, date, title, items: [plain sentences for players] }`. Minor version for
   features, patch for fixes, `small: true` for fix-only releases.
3. Update `guide.html` if gameplay changes.
4. Roadmap: a shipped piece keeps its card **Ongoing**, with a crossed-off line
   `<ul class="steps"><li class="did"><s>Added: X</s> <span>in 2.xx</span></li></ul>`. Only mark Done if Phil says so.
   **Never change `data-idea` values**: votes are stored against them.
5. Test by size of change, and say which tier you used:

   | Change | Before Publish |
   |---|---|
   | Docs, wording, roadmap, guide | nothing |
   | Quick bug fix | the related scenarios only (1–3 min) |
   | Feature, gameplay, saves | green tick from the full GitHub run (~5 min) |

## Tests
- `cd tests && npm install && node run.mjs <names>` runs the scenarios whose file names match. Tests use a fake
  database (`tests/fake-supabase.js`) and never touch the real one.
- GitHub Actions runs the full suite on every push that touches the game, in four groups. A failure gets one
  retry, so a red cross is a real failure. Check the commit's tick before asking Phil to publish.
- Read the output for `FAIL` and `RETRY`. Don't trust a command ending in `| tail`.
- Add or extend a scenario for new behaviour. Run `32-old-saves` when saves or loading change.
- Slow visual captures stay opt-in (`SHOTS=1 node run.mjs building-styles`) so the GitHub run stays quick.
- In this container Chromium is preinstalled: `require('playwright')` works. Don't reinstall Playwright.

## Safety
- Never put keys, passwords, private player data or anything sensitive in the repo, including `AI_HANDOFF.md`
  (the repo is public). The publishable Supabase key in `index.html` is meant to be public; the service_role key
  must never enter the repo.
- Database changes are **additive only**: new tables, columns and functions, or `create or replace` keeping
  everything a function already returns. Keep experiments on the live database to a minimum.
- Saves must keep loading: new save fields need defaults for older saves.

## Working with the other AI
- ChatGPT also works on this repo, and its commits appear under phildbs. Both assistants add dated, signed notes to
  `AI_HANDOFF.md` and never overwrite each other's work.
- Review each other's work honestly. Challenge ideas rather than defer, and back findings with numbers or test
  output.

## Code style
- Match the surrounding code: compact, plain JavaScript, short comments that say why, and wording players will see
  written in plain, friendly sentences.
