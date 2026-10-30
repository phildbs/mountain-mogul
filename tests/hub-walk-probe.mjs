// Review probe (not a scenario): how guests walk inside painted guest areas on a large resort.
// Usage: node hub-walk-probe.mjs (BIG_SAVE=/path/to/save.json skips the ~3 minute build; GUESTS=3000 by default).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { startServer, launch, openGame } from './harness.mjs';
import { bigBuild } from './big-resort.mjs';
const s = await startServer(), b = await launch();
const g = await openGame(b, s.url, { mountain: 'juniper' }); await g.click('#startBtn'); await g.wait(200);
const SAVE = process.env.BIG_SAVE;
if (SAVE && existsSync(SAVE)) await g.ev(`applySave(${readFileSync(SAVE, 'utf8')})`);
else { console.log('built', JSON.stringify(await g.ev(bigBuild))); if (SAVE) writeFileSync(SAVE, JSON.stringify(await g.ev('saveData(false)'))); }
await g.ev(`let seed=7;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);`);
console.log('areas', JSON.stringify(await g.ev(`(() => {
  const used = new Set(), groups = [];
  for (const p of [...world.lifts.map((L) => L.a), ...world.lifts.map((L) => L.b)]) { const q = groups.find((q) => q.some((r) => distXZ(p, r) < 22)); if (q) q.push(p); else groups.push([p]); }
  const blocks = hubBlocks(null);
  for (const pts of groups) {
    const cells = new Set(); for (const p of pts) for (let z = Math.floor(p.z - 9); z <= Math.ceil(p.z + 9); z++) for (let x = Math.floor(p.x - 9); x <= Math.ceil(p.x + 9); x++) if ((x - p.x) ** 2 + (z - p.z) ** 2 <= 81 && !used.has(cellKey(x, z)) && !hubCellProblem(x, z, blocks)) cells.add(cellKey(x, z));
    if (cells.size < 20) continue; const keep = [...hubFlood(cells, cells.values().next().value).parent.keys()]; keep.forEach((k) => used.add(k));
    addArea({ id: world.nextId++, kind: 'hub', name: hubName(new Set(keep)), cells: keep, cost: 0 });
  }
  computeNetwork(); syncLabels(); return { hubs: world.areas.filter(isHub).length, cells: used.size };
})()`)));
console.log(JSON.stringify(await g.ev(`(() => {
  demandForDay = () => ${+(process.env.GUESTS || 3000)}; state.cash = 1e9; state.day = 41; openDay(); state.speed = 0;
  // Record each walk's planned length against the straight line from start to finish.
  let ratio = 0, walks = 0, legs = 0; const orig = walkHub;
  walkHub = (gg, A, p, then) => { const x0 = gg.x, z0 = gg.z, ok = orig(gg, A, p, then); if (ok && gg.then && gg.then.k === 'hubWalk') {
    const pts = [[gg.tx, gg.tz], ...gg.then.path]; let len = Math.hypot(gg.tx - x0, gg.tz - z0); for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const d = Math.hypot(p.x - x0, p.z - z0); if (d > 6) { ratio += len / d; walks++; legs += pts.length; } } return ok; };
  let samples = 0, close = 0, onGrid = 0, n = 0, left = 0;
  while (state.phase === 'open' && n++ < 120000) {
    simStep(1.5);
    if (n % 200) continue;
    const w = guests.filter((x) => x.st === 'walk' && x.then && x.then.k === 'hubWalk');
    for (const a of w) {
      samples++; if (!hubAt(a)) left++;
      if (Math.abs(a.x - Math.round(a.x)) < 0.02 || Math.abs(a.z - Math.round(a.z)) < 0.02) onGrid++;
      if (w.some((c) => c !== a && Math.hypot(c.x - a.x, c.z - a.z) < 0.35)) close++;
    }
  }
  const pct = (v) => Math.round(v / Math.max(1, samples) * 100) + '%';
  return { walkerSamples: samples, nearlyTouching: pct(close), onGridLines: pct(onGrid), outsideArea: left, walksMeasured: walks, routeVsStraight: +(ratio / Math.max(1, walks)).toFixed(2), waypointsPerWalk: +(legs / Math.max(1, walks)).toFixed(1), guests: state.lastReport.guests, sat: state.lastReport.sat };
})()`)));
console.log('errors', g.errors); await b.close(); process.exit(0);
