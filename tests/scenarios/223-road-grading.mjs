// Roads built into the hillside (4.8.1): a road you build across a slope gets a level bed with banks either side,
// the ground stays that way through a save and reload, and Undo puts the hillside back.
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
  eq(g.errors, [], 'no errors');
}
