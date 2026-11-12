// Roads built into the hillside (4.9): a road you build across a slope gets a level bed with banks either side, the
// graded ground is saved, and Undo puts the hillside back. No bend is tighter than ROAD_TURN (a V drawn by hand, or
// one just past a junction, rounds off), and a lot on a slope gets a bank that's wider the more it cuts.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 2e7`);

  // Tilt the ground beside the access road sideways, then build a road straight up it: the tilt is across the road.
  const r = await g.ev(`(() => { const a = ROAD_WORLD.find((p) => inProperty(p.x, p.z + 4) && inProperty(p.x, p.z - 14) && inProperty(p.x - 8, p.z) && inProperty(p.x + 8, p.z));
    if (!a) return 'no spot';
    for (let j = 0; j <= WN; j++) for (let i = 0; i <= WN; i++) { const x = i - HALF, z = j - HALF; if (Math.abs(x - a.x) < 9 && z < a.z - 3 && z > a.z - 20) HT[j * NV + i] += 0.12 * (x - a.x) * sstep(a.z - 3, a.z - 6, z); }
    applyTerrainChange(0, 0, WN, WN); refreshOnTerrain(0, 0, WN, WN);
    const tilt = (P) => { let s = 0, n = 0; for (let k = 6; k < P.length - 6; k += 2) { const p = P[k]; s += Math.abs(trueY(p.x + ROAD_HW, p.z) - trueY(p.x - ROAD_HW, p.z)) / (2 * ROAD_HW); n++; } return s / n; };
    openRoads('roads'); const gs = roadsGestureStart({ x: a.x, z: a.z }); for (const q of [{ x: a.x, z: a.z - 6 }, { x: a.x, z: a.z - 11 }, { x: a.x, z: a.z - 15 }]) roadsGestureMove(gs, q); roadsGestureEnd(gs, { x: a.x, z: a.z - 15 });
    const info = rdraft.info || roadCheck(rdraft); if (info.problems.length) return info.problems.join('|');
    const before = tilt(proadPath({ id: 1e9, kind: rdraft.kind, pts: rdraft.pts })); commitRoad();
    const P = proadPath(proads()[0]), after = tilt(P), mid = P[Math.floor(P.length * 0.6)];
    const bank = Math.abs(trueY(mid.x + 4, mid.z) - trueY(mid.x - 4, mid.z)) / 8; // the hillside a little way off still slopes
    window.__mid = mid; return { before, after, bank, roads: proads().length }; })()`);
  assert(typeof r === 'object', `road built (${r})`);
  assert(r.before > 0.08, `the ground was tilted across the road (${r.before.toFixed(3)})`);
  assert(r.after < 0.02, `and the road's bed is level across now (${r.after.toFixed(3)})`);
  assert(r.bank > 0.04, `with the slope coming back either side (${r.bank.toFixed(3)})`);

  // The graded ground is saved with the resort, and Undo puts the hillside back.
  const s = await g.ev(`(() => { const m = window.__mid, h = trueY(m.x + ROAD_HW, m.z) - trueY(m.x - ROAD_HW, m.z); return { h, saved: !!saveData().terrain }; })()`);
  assert(s.saved, 'the levelled ground goes into the save');
  const u = await g.ev(`(() => { const m = window.__mid; undoLast(); return { roads: proads().length, h: (trueY(m.x + ROAD_HW, m.z) - trueY(m.x - ROAD_HW, m.z)) / (2 * ROAD_HW) }; })()`);
  eq(u.roads, 0, 'undo takes the road away');
  assert(Math.abs(u.h) > 0.08, `and the hillside comes back (${u.h.toFixed(3)})`);

  // A V rounds off: no bend in the line tighter than ROAD_TURN, and its ends stay where they were; a hairpin with too
  // little room gets the roundest bend that fits.
  const v = await g.ev(`(() => { const tight = (Q) => { let worst = 0;
      for (let k = 1; k < Q.length - 1; k++) { const a = Q[k - 1], b = Q[k], c = Q[k + 1], ux = b[0] - a[0], uz = b[1] - a[1], vx = c[0] - b[0], vz = c[1] - b[1];
        worst = Math.max(worst, Math.abs(Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz)) / ((Math.hypot(ux, uz) + Math.hypot(vx, vz)) / 2)); }
      return 1 / worst; };
    const V = easeBends([[0, 0], [12, 0], [4, 8]], ROAD_TURN), H = easeBends([[0, 0], [12, 0], [2, 4]], ROAD_TURN);
    return { v: tight(V), h: tight(H), r: ROAD_TURN, ends: [V[0], V.at(-1)] }; })()`);
  assert(v.v >= v.r * 0.97, `the V's tightest bend has a radius of ${v.v.toFixed(2)} (at least ${v.r})`);
  assert(v.h >= 1, `the hairpin's, ${v.h.toFixed(2)}: round, if tighter`);
  eq(v.ends, [[0, 0], [4, 8]], 'its ends stay put');

  // A lot on a slope: the bank round it widens with the cut, so the ground just outside it is no cliff.
  const l = await g.ev(`(() => { const r = { cx: 0, cz: 0, hw: 4, hd: 3, a: 0 }; const was = HT.slice(); const i = Math.round(window.__mid.x + HALF), j = Math.round(window.__mid.z + HALF);
    // a stand-in hillside in the middle of nowhere: a plane tilted 0.25, under a lot 8 by 6
    const c = { x: (LAND.i0 + LAND.i1) / 2 - HALF, z: (LAND.j0 + LAND.j1) / 2 - HALF }; Object.assign(r, { cx: c.x, cz: c.z });
    for (let jj = 0; jj <= WN; jj++) for (let ii = 0; ii <= WN; ii++) { const x = ii - HALF, z = jj - HALF; if (Math.abs(x - c.x) < 16 && Math.abs(z - c.z) < 16) HT[jj * NV + ii] = 20 + 0.25 * (z - c.z); }
    const saved = { b: world.buildings, l: world.lifts, t: world.trails }; world.buildings = []; world.lifts = [];
    levelRot(r, 20, 1.5, false); world.buildings = saved.b; world.lifts = saved.l;
    let steep = 0; for (let jj = Math.round(c.z + HALF) - 12; jj <= Math.round(c.z + HALF) + 12; jj++) { const k = jj * NV + Math.round(c.x + HALF); steep = Math.max(steep, Math.abs(HT[k + NV] - HT[k])); }
    HT.set(was); return { steep }; })()`);
  assert(l.steep < 0.7, `the bank round a lot on a 25% slope is about 1 in 1.5 at its steepest (${l.steep.toFixed(2)}; a fixed 1.5-wide bank made 1.07)`);
  eq(g.errors, [], 'no errors');
}
