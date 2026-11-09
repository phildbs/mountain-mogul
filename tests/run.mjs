// Runs the scenarios in tests/scenarios (or the ones named on the command line).
//   cd tests && npm install && node run.mjs            # everything except the slow balance check
//   node run.mjs all                                   # everything, balance check included
//   node run.mjs loans visits                          # just those
// A scenario that exports `slow = true` (the season-long balance check) runs only with `all` or by name:
// run it when prices, costs or crowds change.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer, launch } from './harness.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'scenarios');
const args = process.argv.slice(2), all = args.includes('all'), only = args.filter((a) => a !== 'all');
const files = readdirSync(dir).filter((f) => f.endsWith('.mjs') && (!only.length || only.some((o) => f.includes(o)))).sort();
// SHARD=2/6 runs the second of six groups: GitHub runs the groups side by side. The groups are made even by how long
// each scenario took last time (timings.json, in seconds; a new scenario counts as 15): longest first, each into the
// lightest group so far. `TIMES=1 node run.mjs` (no SHARD) writes the file again after a run.
const timesFile = join(dirname(fileURLToPath(import.meta.url)), 'timings.json');
const times = (() => { try { return JSON.parse(readFileSync(timesFile, 'utf8')); } catch (e) { return {}; } })();
const shard = (process.env.SHARD || '').match(/^(\d+)\/(\d+)$/);
if (shard) {
  const k = +shard[1] - 1, n = +shard[2], load = Array(n).fill(0), mine = [];
  for (const f of [...files].sort((a, b) => (times[b] ?? 15) - (times[a] ?? 15) || (a < b ? -1 : 1))) { const g = load.indexOf(Math.min(...load)); load[g] += times[f] ?? 15; if (g === k) mine.push(f); }
  files.splice(0, files.length, ...mine.sort());
}

const server = await startServer();
const browser = await launch();
let failed = 0;
for (const f of files) {
  const t0 = Date.now();
  const mod = await import(pathToFileURL(join(dir, f)));
  if (mod.slow && !all && !only.length) { console.log(`SKIP ${f} (slow: run with "all" or by name)`); continue; }
  // A failure gets one more try, so a timing hiccup on a busy machine doesn't fail the run; a real bug fails twice.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const note = await mod.default({ browser, url: server.url });
      if (attempt === 1) times[f] = Math.round((Date.now() - t0) / 1000);
      console.log(`PASS ${f} (${((Date.now() - t0) / 1000).toFixed(0)}s)${attempt > 1 ? ' · passed on retry' : ''}${note ? ' · ' + note : ''}`);
      break;
    } catch (e) {
      for (const ctx of browser.contexts()) for (const p of ctx.pages()) await p.close().catch(() => {});
      if (attempt === 1) { console.log(`RETRY ${f}: ${e.message.split('\n')[0]}`); continue; }
      failed++;
      console.log(`FAIL ${f}: ${e.message.split('\n')[0]}`);
    }
  }
  // A failed test can leave its page open, still running the game; close it so it can't slow the next ones.
  for (const ctx of browser.contexts()) for (const p of ctx.pages()) await p.close().catch(() => {});
}
await browser.close();
server.close();
if (process.env.TIMES && !shard) writeFileSync(timesFile, JSON.stringify(Object.fromEntries(Object.keys(times).sort().map((f) => [f, times[f]])), null, 0).replace(/,"/g, ',\n"') + '\n');
console.log(failed ? `${failed} of ${files.length} failed` : `all ${files.length} passed`);
process.exit(failed ? 1 : 0);
