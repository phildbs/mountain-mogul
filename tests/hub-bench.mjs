// Review benchmark: main vs paintable-areas branch on a large resort (26 lifts, 110 trails), ~8,000 guests.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { startServer, launch, openGame } from './harness.mjs';
import { bigBuild } from './big-resort.mjs';
// Usage: BIG_SAVE=/path/save.json GUESTS=2000 RUNS=main,branch,hubs-old,hubs node hub-bench.mjs (builds the resort if the save is missing).
const SAVE = process.env.BIG_SAVE;
const GUESTS = +(process.env.GUESTS || 2000);
const main = execFileSync('git', ['show', 'origin/main:index.html'], { maxBuffer: 8e6, encoding: 'utf8' });
const prior = execFileSync('git', ['show', 'origin/feature/paintable-areas:index.html'], { maxBuffer: 8e6, encoding: 'utf8' });
const servers = { main: await startServer({ source: main }), branch: await startServer(), old: await startServer({ source: prior }) };
const browser = await launch();
const open = async (v) => { const g = await openGame(browser, servers[v].url, { mountain: 'juniper' }); await g.click('#startBtn'); await g.wait(200); return g; };
if (!existsSync(SAVE)) { const g = await open('main'); console.log('built', JSON.stringify(await g.ev(bigBuild))); writeFileSync(SAVE, JSON.stringify(await g.ev('saveData(false)'))); await g.page.close(); }
const save = readFileSync(SAVE, 'utf8');
const seed = (s) => `let seed=${s};Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);`;
// Guest areas: one around each cluster of lift bottoms (base and mid-mountain) and each lift top.
const paint = `(() => {
  const t0 = performance.now(), made = [];
  const B0 = hubBlocks(null), blob = (pts, r) => { const cells = new Set(); for (const p of pts) for (let z = Math.floor(p.z - r); z <= Math.ceil(p.z + r); z++) for (let x = Math.floor(p.x - r); x <= Math.ceil(p.x + r); x++) if ((x - p.x) ** 2 + (z - p.z) ** 2 <= r * r && !hubCellProblem(x, z, B0)) cells.add(cellKey(x, z)); return cells; };
  const used = new Set();
  const groups = [];
  for (const p of [...world.lifts.map((L) => L.a), ...world.lifts.map((L) => L.b)]) { const g = groups.find((g) => g.some((q) => distXZ(p, q) < 22)); if (g) g.push(p); else groups.push([p]); }
  for (const pts of groups) {
    const cells = [...blob(pts, 9)].filter((k) => !used.has(k)); if (cells.length < 20) continue;
    const H = hubFlood(new Set(cells), cells[0]); const keep = [...H.parent.keys()]; keep.forEach((k) => used.add(k));
    const A = { id: world.nextId++, kind: 'hub', name: hubName(new Set(keep)), cells: keep, cost: 0 }; addArea(A); made.push(A);
  }
  const t1 = performance.now(); computeNetwork(); syncLabels(); const t2 = performance.now();
  const reps = []; for (let i = 0; i < 5; i++) { const a = performance.now(); computeNetwork(); reps.push(performance.now() - a); }
  const fc = performance.now(); fenceTrailCells(); const fcMs = performance.now() - fc;
  return { hubs: made.length, cells: made.reduce((n, A) => n + A.cells.length, 0), names: made.map((A) => A.name).join(','), addMs: Math.round(t1 - t0), networkMs: Math.round(Math.min(...reps)), fenceCellsMs: Math.round(fcMs),
    returning: realTrails().filter((x) => x.reachable && x.returns).length, fromBase: world.lifts.filter((L) => L.fromBase).length, reachableLifts: world.lifts.filter((L) => L.reachable).length };
})()`;
const day = `(() => {
  demandForDay = () => ${GUESTS}; state.cash = 1e9; state.day = 41; openDay(); state.speed = 0;
  const steps = []; let n = 0, peak = 0; const t = performance.now();
  while (state.phase === 'open' && n++ < 120000) { const a = performance.now(); simStep(1.5); steps.push(performance.now() - a); peak = Math.max(peak, guests.length); }
  const ms = performance.now() - t; steps.sort((a, b) => a - b); const r = state.lastReport;
  return { ms: Math.round(ms), p50: +steps[steps.length >> 1].toFixed(2), p95: +steps[Math.floor(steps.length * .95)].toFixed(2), worst: +steps.at(-1).toFixed(1), peak, guests: r.guests, sat: Math.round(r.sat ?? r.satisfaction ?? 0), wait: +(r.avgWait||0).toFixed(1), refunded: r.refunded ?? null, turnedAway: r.turnedAway ?? null, leftLines: r.leftLines ?? null, rev: Math.round((r.rev && Object.values(r.rev).reduce((a, b) => a + (+b || 0), 0)) || 0) };
})()`;
const runs = (process.env.RUNS || 'main,branch,hubs-old,hubs').split(',');
for (const v of runs) {
  const g = await open(v === 'hubs' ? 'branch' : v === 'hubs-old' ? 'old' : v);
  await g.ev(`applySave(${save})`); await g.ev(seed(7));
  let pre = null; if (v.startsWith('hubs')) pre = await g.ev(paint);
  const net = await g.ev(`(() => { const r = []; for (let i = 0; i < 5; i++) { const a = performance.now(); computeNetwork(); r.push(performance.now() - a); } return Math.round(Math.min(...r)); })()`);
  await g.ev(seed(7));
  const r = await g.ev(day);
  console.log(v.padEnd(7), JSON.stringify({ network: net, ...(pre || {}), ...r }), g.errors.length ? 'ERRORS ' + g.errors.slice(0, 3).join(' | ') : '');
  await g.page.close();
}
await browser.close(); process.exit(0);
