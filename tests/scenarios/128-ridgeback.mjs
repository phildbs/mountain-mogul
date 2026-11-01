// Ridgeback: a gentle beginner peak and a tall, bald expert peak joined by a ridge with a saddle. Two roads from
// the town off the west side: the main lot under the beginner peak (south), the North lot under the expert peak.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { mountain: 'ridgeback' });
  const m = await g.ev(`(() => {
    const W = (c) => ({ x: PLAY0 + c[0] * PN - HALF, z: PLAY1 - c[1] * PN - HALF }), B = W(RB.b), E = W(RB.e), y = (p) => trueY(p.x, p.z);
    let saddle = Infinity; for (let f = 0; f <= 1; f += 0.02) saddle = Math.min(saddle, y({ x: lerp(B.x, E.x, f), z: lerp(B.z, E.z, f) }));
    return { id: MOUNTAIN.id, cash: state.cash, goals: goalList().map((G) => G.id), lots: [lotCount(), lotName(1)], vert: ft(MOUNTAIN.summitH) - ft(MOUNTAIN.baseH),
      b: y(B) - MOUNTAIN.baseH, e: y(E) - MOUNTAIN.baseH, saddle: saddle - MOUNTAIN.baseH, bald: y(E) > MOUNTAIN.treeline + 10, wooded: y(B) < MOUNTAIN.treeline + 4,
      town: !!townMesh, w2: PARCELS.some((p) => p.id === 'W2'), north: lotSite(1).z < E.z - 30, main: lotSite(0).z > B.z + 40,
      clear: [slotBox(0, 0, 1), slotBox(0, 1, 1), slotBox(0, 1, 0)].map(lotLandBlock) };
  })()`);
  eq([m.id, m.cash], ['ridgeback', 2600000], 'Ridgeback with its starting cash');
  eq(m.goals, ['firstDay', 'bothPeaks', 'overRidge', 'experts', 'profit'], 'its own goals');
  eq(m.lots, [2, 'North lot'], 'a main lot and a north lot');
  assert(m.vert > 800 && m.vert < 1200, `taller than Lone Pine Hill (${m.vert} ft)`);
  assert(m.e > m.b + 10 && m.saddle < m.b - 4, `two separate peaks, the expert one far taller, with a saddle between (beginner ${m.b.toFixed(1)}, expert ${m.e.toFixed(1)}, saddle ${m.saddle.toFixed(1)})`);
  assert(m.bald && m.wooded, 'a tall, bald expert peak; the beginner peak wooded nearly to its open top');
  assert(m.town && !m.w2 && m.north && m.main, 'the town and its two roads: main lot south, North lot north');
  eq(m.clear, ['', '', ''], 'room for lot sections at both bases');
  await g.click('#startBtn'); await g.wait(400);
  const built = await g.ev(`(() => {
    state.lotLayout = [[0, 0, 0], [0, 0, 1]]; state.lotSections = 2; buildLot();
    const lift = (a, b) => { const i = evalLift(a, b, 'double'); if (i.problems.length) throw new Error('lift: ' + i.problems); commitLift(i, 'double'); computeNetwork(); return world.lifts[world.lifts.length - 1]; };
    const trail = (w) => { const pts = w.map(([x, z]) => ({ x, z, y: heightAt(x, z) })), t = evalTrail(pts, 'wide'); if (t.an.problems.length) throw new Error('trail: ' + t.an.problems); commitTrail(t, pts, 'wide'); computeNetwork(); };
    const LB = lift({ x: -10, z: 50 }, { x: -34, z: -10 }), LE = lift({ x: 0, z: -60 }, { x: 32, z: -22 });
    // on each peak, the gentlest and the steepest of a fixed set of routes down to the lift's bottom
    const routes = (L, mids) => mids.map((m) => [[L.b.x + 3 * Math.sign(m[0][0] - L.b.x), L.b.z + 2 * Math.sign(L.a.z - L.b.z)], ...m, [L.a.x + 4, L.a.z + 2 * Math.sign(L.a.z - L.b.z)]])
      .map((w) => { const pts = w.map(([x, z]) => ({ x, z, y: heightAt(x, z) })), t = evalTrail(pts, 'wide'); return t.an.problems.length ? null : { t, pts }; }).filter(Boolean).sort((a, b) => a.t.an.maxGrade - b.t.an.maxGrade);
    const rb = routes(LB, [[[-40, 4], [-38, 22], [-20, 38]], [[-44, 0], [-42, 20], [-24, 40]], [[-20, 0], [-4, 20], [0, 40]], [[-16, -2], [4, 16], [10, 36]]]);
    const re = routes(LE, [[[47, -33], [29, -44]], [[29, -32], [28, -46]], [[44, -30], [24, -48]], [[22, -34], [12, -48]]]);
    for (const r of [rb[0], rb[rb.length - 1], re[0], re[re.length - 1]]) { commitTrail(r.t, r.pts, 'wide'); computeNetwork(); }
    for (const [x, z] of [[-40, 60], [-14, 64], [-26, -74], [8, -72]]) { const b = evalBuilding('lodge', x, z, 0); if (!b.problems.length) commitBuilding(b, 'lodge', x, z, 0); }
    computeNetwork(); syncLabels();
    return { bases: [LB.fromBase, LE.fromBase], sides: [baseOf(LB.a), baseOf(LE.a)], signs: world.trails.map(trailSign), lodges: world.buildings.length };
  })()`);
  eq(built.bases, [true, true], 'both lifts start in a base area');
  eq(built.sides, [0, 1], 'one lift at each base');
  assert(built.signs[0] === 0 && built.signs[1] >= 1 && built.signs[2] >= 2 && built.signs[3] === 3, `a green and a harder run on the beginner peak, a black and a double black off the expert one (${built.signs})`);
  assert(built.lodges >= 2, 'a lodge at each base');
  await g.ev(SETUPS.midwinter);
  await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
  const r = await g.ev(`({ guests: state.lastReport.guests, lots: state.lastReport.bases && state.lastReport.bases.lots, goals: state.lastReport.goals })`);
  assert(r.guests > 150 && r.lots.every((n) => n > 0), `guests at both bases (${r.guests}: ${r.lots})`);
  assert(r.goals.includes('Two peaks') && r.goals.includes('Over the ridge'), `both-peak and both-lot goals on the first day (${r.goals})`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
