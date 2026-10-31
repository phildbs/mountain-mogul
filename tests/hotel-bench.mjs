// Hotels at real scale: the 26-lift, 110-trail Juniper resort (from big-resort.mjs), one Saturday with and
// without three large hotels and a medium one (same seed), then a forced 5,000-guest day with them. Also save size.
// Usage: BIG_SAVE=/path/save.json node hotel-bench.mjs (builds the resort on main if the save is missing).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { startServer, launch, openGame } from './harness.mjs';
import { bigBuild } from './big-resort.mjs';
const SAVE = process.env.BIG_SAVE;
const main = execFileSync('git', ['show', 'origin/main:index.html'], { maxBuffer: 8e6, encoding: 'utf8' });
const servers = { main: await startServer({ source: main }), branch: await startServer() };
const browser = await launch();
const open = async (v) => { const g = await openGame(browser, servers[v].url, { mountain: 'juniper' }); await g.click('#startBtn'); await g.wait(200); return g; };
if (!existsSync(SAVE)) { const g = await open('main'); console.log('built', JSON.stringify(await g.ev(bigBuild))); writeFileSync(SAVE, JSON.stringify(await g.ev('saveData(false)'))); await g.page.close(); }
const save = readFileSync(SAVE, 'utf8');
const seed = (s) => `let seed=${s};Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);`;
const day = (force) => `(() => {
  ${force ? `demandForDay = () => ${force};` : ''} state.cash = 1e9; state.reputation = 1; state.day = 39; openDay(); state.speed = 0;
  let n = 0, worst = 0; const t = performance.now();
  while (state.phase === 'open' && n++ < 120000) { const t0 = performance.now(); simStep(1.5); worst = Math.max(worst, performance.now() - t0); }
  const r = state.lastReport;
  return { dow: dateOf(39).getUTCDay(), ms: Math.round(performance.now() - t), worstStep: +worst.toFixed(1), guests: r.guests, away: r.turnedAway, sat: r.sat, profit: r.profit, hotel: r.hotel, lodging: r.rev.lodging || 0, tickets: r.rev.tickets };
})()`;
const addHotels = `(() => { const out = [];
  for (const [tier, n] of [[2, 3], [1, 2]]) for (let k = 0; k < n; k++) { let done = false;
    for (const L of world.lifts.filter((L) => L.fromBase)) { if (done) break;
      for (let dx = -14; dx <= 14 && !done; dx += 2) for (let dz = -6; dz <= 14 && !done; dz += 2) for (const r of [0, 1, 2, 3]) {
        const b = evalBuilding('hotel', L.a.x + dx, L.a.z + dz, r, false, null, null, tier);
        if (b.problems.length) continue;
        const B = commitBuilding(b, 'hotel', L.a.x + dx, L.a.z + dz, r, ['classic', 'modern', 'scandi'][out.length % 3]);
        if (skiInOut(B)) { out.push(tier); done = true; break; } removeBuilding(B);
      } } }
  computeNetwork(); return out; })()`;
for (const [label, v, hotels, force] of [['main, Saturday', 'main', false, 0], ['branch, Saturday, no hotels', 'branch', false, 0], ['branch, Saturday, with hotels', 'branch', true, 0], ['branch, 5,000-guest day, with hotels', 'branch', true, 5000]]) {
  const g = await open(v);
  await g.ev(`applySave(${save});afterLoad()`);
  let built = null;
  if (hotels) built = await g.ev(addHotels);
  await g.ev(seed(7));
  const r = await g.ev(day(force));
  const bytes = await g.ev('JSON.stringify(saveData(false)).length');
  console.log(label.padEnd(36), JSON.stringify({ built, ...r, saveKB: Math.round(bytes / 1024) }), g.errors.length ? 'ERRORS ' + g.errors.slice(0, 3).join(' | ') : '');
  await g.page.close();
}
await browser.close(); servers.main.close(); servers.branch.close();
