// Ridgeback: a long, smooth ridge from a taller expert peak down to a gentle beginner peak, green along the top.
// A town off the south edge; its road splits at a crossroads in the valley: the main lot under the beginner peak,
// the East lot under the expert peak.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { mountain: 'ridgeback' });
  const m = await g.ev(`(() => {
    const W = (c) => ({ x: PLAY0 + c[0] * PN - HALF, z: PLAY1 - c[1] * PN - HALF }), B = W(RB.b), E = W(RB.e), y = (p) => trueY(p.x, p.z);
    // the crest falls all the way from one summit to the other, never climbing
    let rises = 0, prev = Infinity; for (let f = 0; f <= 1.0001; f += 0.05) { const h = y({ x: lerp(E.x, B.x, f), z: lerp(E.z, B.z, f) }); if (h > prev + 0.05) rises++; prev = h; }
    const fork = BRANCH_WORLD.findIndex((p, i) => p !== ROAD_WORLD[i]);
    return { id: MOUNTAIN.id, cash: state.cash, goals: goalList().map((G) => G.id), lots: [lotCount(), lotName(1)], vert: ft(MOUNTAIN.summitH) - ft(MOUNTAIN.baseH),
      b: y(B) - MOUNTAIN.baseH, e: y(E) - MOUNTAIN.baseH, rises, bald: y(E) > MOUNTAIN.treeline + 8,
      town: !!townMesh, s3: PARCELS.some((p) => p.id === 'S3'), w2: PARCELS.some((p) => p.id === 'W2'),
      // one road in from the south, splitting in the valley
      south: ROAD_WORLD[0].z > 90, shared: fork, crossIn: inProperty(BRANCH_WORLD[fork - 1].x, BRANCH_WORLD[fork - 1].z),
      main: lotSite(0), east: lotSite(1), B, E,
      clear: [slotBox(0, 1, 0), slotBox(0, 2, 0), slotBox(0, 0, 1), slotBox(0, 1, 1)].map(lotLandBlock) };
  })()`);
  eq([m.id, m.cash], ['ridgeback', 2600000], 'Ridgeback with its starting cash');
  eq(m.goals, ['firstDay', 'bothPeaks', 'ridgeRun', 'twoBases', 'profit'], 'its own goals');
  eq(m.lots, [2, 'East lot'], 'a main lot and an East lot');
  assert(m.vert > 700 && m.vert < 1100, `taller than Lone Pine Hill (${m.vert} ft)`);
  assert(m.e > m.b + 8 && m.rises === 0, `the ridge falls evenly from the expert summit (${m.e.toFixed(1)}) to the beginner one (${m.b.toFixed(1)})`);
  assert(m.bald, 'the expert summit is bare, above the trees');
  assert(m.town && !m.s3 && m.w2, 'a town off the south edge, where that land is not for sale');
  assert(m.south && m.shared > 5 && m.crossIn, `one road in from the south, splitting at a crossroads on the property (${m.shared} points shared)`);
  assert(m.main.x < m.B.x && m.main.z > m.B.z + 40 && m.east.x > m.E.x && m.east.z > m.E.z + 40, 'main lot below the beginner peak, East lot below the expert peak');
  eq(m.clear, ['', '', '', ''], 'room for the main lot to grow, and for the East lot');
  // the road runs straight into the end of the main lot, which grows west, away from it
  const lot = await g.ev(`(() => { state.lotLayout = [[0, 0, 0], [0, 1, 0]]; state.lotSections = 2; buildLot(); const e = lotSite(0), b = [slotBox(0, 0), slotBox(0, 1)];
    const i = stalls.findIndex((s) => s.x < b[1].x1), p = carPath(stalls[i]), last = p[p.length - 1];
    return { west: b[0].x1 < e.x && b[1].x1 < b[0].x0, along: b[0].z0 < e.z && b[0].z1 > e.z, clearOfRoad: [0, 1].every((k) => !footprintStats(b[k]).road || k === 0),
      parks: Math.hypot(last.x - stalls[i].x, last.z - stalls[i].z) < 0.01, enters: p[ROAD_WORLD.length].x > stalls[i].x }; })()`);
  eq(lot, { west: true, along: true, clearOfRoad: true, parks: true, enters: true }, 'the main lot lines up with the end of the road and grows west; cars come into each section from its east side');
  await g.click('#startBtn'); await g.wait(400);
  const built = await g.ev(`(() => {
    state.lotLayout = [[0, 0, 0], [0, 0, 1]]; state.lotSections = 2; buildLot();
    const lift = (a, b) => { const i = evalLift(a, b, 'double'); if (i.problems.length) throw new Error('lift: ' + i.problems); commitLift(i, 'double'); computeNetwork(); return world.lifts[world.lifts.length - 1]; };
    const trail = (w) => { const pts = w.map(([x, z]) => ({ x, z, y: heightAt(x, z) })), t = evalTrail(pts, 'wide'); if (t.an.problems.length) throw new Error('trail: ' + t.an.problems); commitTrail(t, pts, 'wide'); computeNetwork(); return world.trails[world.trails.length - 1]; };
    const LB = lift({ x: -36, z: 44 }, { x: -31, z: -10 }), LE = lift({ x: 40, z: 26 }, { x: 30, z: -22 });
    trail([[-34, -8], [-59, 10], [-54, 23], [-40, 46]]); // a green down the beginner peak
    trail([[27, -20], [7, -3], [8, 14], [36, 28]]); trail([[33, -20], [51, -13], [65, 0], [58, 15], [44, 28]]); // a blue and a double black off the expert peak
    const ridge = trail([[LE.b.x - 3, LE.b.z + 1], [-1, -18], [-28, -12], [-38, 8], [-40, 30], [LB.a.x - 4, LB.a.z + 2]]); // along the ridge to the beginner peak and down
    for (const [x, z] of [[-24, 50], [-50, 40], [52, 40], [30, 34]]) { const b = evalBuilding('lodge', x, z, 0); if (!b.problems.length) commitBuilding(b, 'lodge', x, z, 0); }
    computeNetwork(); syncLabels();
    return { bases: [LB.fromBase, LE.fromBase], sides: [baseOf(LB.a), baseOf(LE.a)], signs: world.trails.filter((t) => !t.virtual).map(trailSign), ridge: ridgeRun(ridge), lodges: world.buildings.length };
  })()`);
  eq(built.bases, [true, true], 'both lifts start in a base area');
  eq(built.sides, [0, 1], 'one lift at each base');
  eq(built.signs, [0, 1, 3, 0], 'a green on the beginner peak, a blue and a double black off the expert peak, and a green along the ridge');
  assert(built.ridge, 'the ridge green counts as the ridge run');
  assert(built.lodges >= 2, 'lodges at the bases');
  await g.ev(SETUPS.midwinter);
  await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
  const r = await g.ev(`({ guests: state.lastReport.guests, lots: state.lastReport.bases && state.lastReport.bases.lots, goals: state.lastReport.goals })`);
  assert(r.guests > 150 && r.lots.every((n) => n > 0), `guests at both bases (${r.guests}: ${r.lots})`);
  for (const G of ['Two peaks', 'Ridge run', 'Two bases']) assert(r.goals.includes(G), `${G} on the first day (${r.goals})`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
