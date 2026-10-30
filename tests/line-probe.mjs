// Review probe (not a scenario): seat lines at benches, picnic tables and fire pits, and lift lines skiers
// join while a nearby lift stands empty, on a large resort with seating near every lift.
// Usage: node line-probe.mjs (BIG_SAVE=/path/to/save.json skips the ~3 minute build; SRC=/path/index.html to compare
// another version; GUESTS=8000 by default).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { startServer, launch, openGame } from './harness.mjs';
import { bigBuild } from './big-resort.mjs';
const s = await startServer(process.env.SRC ? { source: readFileSync(process.env.SRC, 'utf8') } : {}), b = await launch();
const g = await openGame(b, s.url, { mountain: 'juniper' }); await g.click('#startBtn'); await g.wait(200);
const SAVE = process.env.BIG_SAVE;
if (SAVE && existsSync(SAVE)) await g.ev(`applySave(${readFileSync(SAVE, 'utf8')})`);
else { console.log('built', JSON.stringify(await g.ev(bigBuild))); if (SAVE) writeFileSync(SAVE, JSON.stringify(await g.ev('saveData(false)'))); }
await g.ev(`let seed=${+(process.env.SEED || 7)};Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);`);
console.log('seating', JSON.stringify(await g.ev(`(() => {
  // A small rest area beside every lift: benches, picnic tables and a fire pit, like players build.
  let seed = 99; const R = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const n = {};
  if (!world.buildings.some((B) => ['bench', 'picnic', 'firepit'].includes(B.type))) for (const L of world.lifts) for (const type of ['bench', 'bench', 'bench', 'picnic', 'picnic', 'firepit'])
    for (let k = 0; k < 80; k++) { const x = L.a.x + (R() - 0.5) * 24, z = L.a.z + (R() - 0.5) * 24, i = evalBuilding(type, x, z, 0); if (!i || i.problems?.length) continue; commitBuilding(i, type, x, z, 0); n[type] = (n[type] || 0) + 1; break; }
  // A transit center, so buses and the off-site lots bring a big crowd as on large public resorts.
  if (!stations().length) for (let x = -80; x <= 80 && !stations().length; x += 2) for (let z = 50; z <= 80 && !stations().length; z += 2) { const p = snapToRoad('transit', { x, z }), i = evalBuilding('transit', p.x, p.z, p.rot); if (i && !i.problems?.length) { commitBuilding(i, 'transit', p.x, p.z, p.rot); n.transit = 1; } }
  computeNetwork(); syncLabels(); return n;
})()`)));
console.log(JSON.stringify(await g.ev(`(() => {
  ${process.env.NOHOP ? 'shorterLift = () => null;' : ''}
  demandForDay = () => ${+(process.env.GUESTS || 8000)}; state.cash = 1e9; state.day = 41; openDay(); state.speed = 0;
  const SEAT = ['bench', 'picnic', 'firepit'], seatOf = (B) => B && SEAT.includes(B.type);
  const free = (B) => B.used.seat + B.q.seat.length < poolSlots(B, 'seat');
  // Lift choices: the line a skier commits to, against the shortest line at another open lift loading within a short glide.
  let joins = 0, longJoin = 0, emptyNear = 0, waitSum = 0; const why = {}, altBy = {}, altD = []; const orig = goQueue;
  goQueue = (gg, L, mode) => { if (!gg.leaving && L.queue) { const w = liftWait(L); joins++; waitSum += w;
    if (w >= 10) { longJoin++; const k = L.fromBase ? 'base' : 'mid'; why[k] = (why[k] || 0) + 1;
      const alt = world.lifts.filter((M) => M !== L && canLoad(M) && !isVillage(M) && (L.fromBase ? M.fromBase : distXZ(M.a, L.a) < 40) && liftWait(M) <= w / 3 && M.departing.some((D) => runnable(D) && trailSign(D) <= gg.ab));
      if (alt.length) { emptyNear++; altBy[k] = (altBy[k] || 0) + 1; altD.push(Math.round(Math.min(...alt.map((M) => distXZ(M.a, gg))))); } } }
    return orig(gg, L, mode); };
  let seatServed = 0, seatWait = 0, seatWait5 = 0; const os = serve; serve = (gg, B) => { if (seatOf(B)) { seatServed++; const w = state.time - gg.qT; seatWait += w; if (w > 5) seatWait5++; } return os(gg, B); };
  let gaveUp = 0; const seatNames = new Set(world.buildings.filter(seatOf).map((B) => B.name)); const ot = thought; thought = (gg, t) => { const m = /^The line at (.*) was too long\.$/.exec(t); if (m && seatNames.has(m[1])) gaveUp++; return ot(gg, t); };
  const t0 = performance.now();
  let samples = 0, inSeatLine = 0, lineWithFreeNearby = 0, seatedPeak = 0, n = 0;
  while (state.phase === 'open' && n++ < 200000) {
    simStep(1.5);
    if (n % 100) continue;
    samples++;
    for (const B of world.buildings) if (seatOf(B)) {
      for (const q of B.q.seat) { inSeatLine++; if (world.buildings.some((C) => C !== B && seatOf(C) && distXZ(C.door, B.door) < 15 && bldOpenNow(C) && free(C) && offers(C).includes(q.svc))) lineWithFreeNearby++; }
    }
  }
  const visits = {}; for (const B of world.buildings) if (seatOf(B)) visits[B.type] = (visits[B.type] || 0) + (B.today.visits || 0);
  const r = state.lastReport, lw = Object.values(r.liftWaits || {});
  return { simSeconds: +((performance.now() - t0) / 1000).toFixed(1), guests: r.guests, turnedAway: r.turnedAway, sat: r.sat, seatServed, avgSeatLineMin: +(seatWait / Math.max(1, seatServed)).toFixed(1), seatWaitsOver5min: seatWait5, seatGaveUp: gaveUp, seatLineGuestSamples: inSeatLine, ofWhichFreeSeatWithin15: lineWithFreeNearby,
    liftJoins: joins, avgWaitAtJoin: +(waitSum / Math.max(1, joins)).toFixed(1), joins10minPlus: longJoin, ofWhichOtherLiftUnderAThird: emptyNear, longBy: why, altBy, altDistMedian: altD.sort((a, b) => a - b)[altD.length >> 1],
    avgLiftWait: +(lw.reduce((a, v) => a + v, 0) / Math.max(1, lw.length)).toFixed(1), maxLiftWait: Math.round(Math.max(0, ...lw)), lineHops: today.lineHops || 0, restSkips: 0, complaints: { wait: r.complaints?.wait, lines: r.complaints?.lines, lineQuit: r.complaints?.lineQuit } };
})()`)));
console.log('errors', g.errors); await b.close(); process.exit(0);
