// As many bases as you build (3.17): a lot of yours over a hill from every base, or far from them all, is a base of its
// own. Adum888 built a lot and a road behind Ridgeback's ridge, with its own lifts, and couldn't link it by village
// gondola ("unclear why my third base is not viable"); guests parked there also counted as the East base's.
import { openGame, assert, eq, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { mountain: 'ridgeback' });
  await g.click('#startBtn'); await g.wait(300);
  const s = await g.ev(`(() => {
    state.cash = 5e7;
    state.parks = [{ R: 3, a: Math.PI, n: 96, x: -66.5, z: 67, id: 1, ents: [{ s: 0, t: 7 }], name: 'Main lot' }, { R: 3, a: 0, n: 96, x: 66.5, z: 39, id: 2, ents: [{ s: 2, t: 0.45 }], name: 'East lot' },
      { R: 3, a: 0, n: 96, x: 66.5, z: 47.4, id: 3, ents: [], name: 'East lot (row 2)' }, { R: 5, a: 1.5708, n: 114, x: 88.95, z: -50.39, id: 5, ents: [{ s: 1, t: 1.4 }], name: 'Back lot' }];
    state.proads = [{ id: 1, kind: 'road', name: 'Snowshoe Lane', cost: 0, pts: [[19.07,67.57],[29.49,62.27],[35.13,60.76],[44.72,57.61],[56.13,55.53],[76.12,53.4],[84.4,54.28],[91.03,53.56],[94.17,45.87],[94.12,22.85],[94.99,-1.02],[94.55,-20.99]] }];
    netChanged(); buildLot();
    const lift = (a, b, t) => { const i = evalLift(a, b, t); if (i.problems.length) throw new Error(t + ': ' + i.problems); commitLift(i, t); computeNetwork(); return world.lifts[world.lifts.length - 1]; };
    const trail = (w) => { const pts = w.map(([x, z]) => ({ x, z, y: heightAt(x, z) })), t = evalTrail(pts, 'wide'); if (t.an.problems.length) throw new Error('trail: ' + t.an.problems); commitTrail(t, pts, 'wide'); computeNetwork(); };
    const same = evalLift({ x: -45, z: 60 }, { x: -20, z: 62 }, 'village').problems.join(' ');
    const M = lift({ x: -51.1, z: 51.8 }, { x: -53, z: -4 }, 'gondola'), E = lift({ x: 59.3, z: 25.5 }, { x: 42.8, z: -14.8 }, 'six'), K = (() => { for (const [x, z] of [[48.8, -28.4], [50, -34], [52, -38], [46, -36], [55, -42]]) if (!evalLift({ x: 62.8, z: -63.3 }, { x, z }, 'six').problems.length) return lift({ x: 62.8, z: -63.3 }, { x, z }, 'six'); throw new Error('no back lift'); })();
    trail([[-50, -2], [-60, 15], [-55, 30], [-48, 48]]); trail([[40, -12], [30, 5], [45, 20], [57, 27]]); trail([[K.b.x, K.b.z - 3], [K.b.x - 3, (K.b.z + K.a.z) / 2], [K.a.x - 3, K.a.z + 2]]);
    let E2 = null; for (let r = 0; r < 30 && !E2; r += 3) for (let a = 0; a < 6.28 && !E2; a += 0.5) { const p = { x: 48 + r * Math.cos(a), z: 30 + r * Math.sin(a) }; if (baseOf(p) === 1 && !evalLift({ x: 76, z: -50 }, p, 'village').problems.length) E2 = p; } // a free spot at the East base
    const before = E2 ? 0 : 1;
    const V1 = lift({ x: 42.44, z: 54.83 }, { x: -39.87, z: 78.32 }, 'village'), V2 = lift({ x: 76, z: -50 }, E2, 'village');
    computeNetwork();
    return { n: baseCount(), lots: parks().map((P, i) => baseOfLot(i)), name: baseName(3 - 1), same, before, lifts: [M, E, K].map((L) => [L.fromBase, baseOf(L.a)]), v: [V1, V2].map((L) => [baseOf(L.a), baseOf(L.b)].sort()),
      hop: crossRoute(2, 0).hop, K: K.id, M: M.id };
  })()`);
  eq([s.n, s.lots, s.name], [3, [0, 1, 1, 2], 'Back lot'], 'the lot behind the ridge is a third base; the East lot’s second row is part of the East base');
  assert(/same base \(Main lot\)/.test(s.same), `a gondola with both stations at one base says so (${s.same})`);
  eq(s.before, 0, 'a village gondola from the back base to the East base is fine');
  eq(s.lifts, [[true, 0], [true, 1], [true, 2]], 'a lift at each base starts from it');
  eq([s.v, s.hop], [[[0, 1], [1, 2]], 1], 'gondolas join the back base to the East one and the East one to the main base; from the back to the main base goes by the East base');
  await g.ev(SETUPS.midwinter);
  await g.ev(`openDay()`);
  const d = await g.ev(`(() => {
    let n = 0; const over = new Set(), twoHop = new Set(), seen = new Map();
    const back = (p) => p.z < -15, front = (p) => p.z > 15;
    while (state.phase === 'open' && n < 90000) { simStep(1.5); n++;
      for (const g of guests) {
        if ((g.st === 'walk' || g.st === 'glide') && ((back(g) && front({ x: g.tx, z: g.tz })) || (front(g) && back({ x: g.tx, z: g.tz }))) && Math.hypot(g.tx - g.x, g.tz - g.z) > 30) over.add(g.id);
        if (g.xFinal != null) twoHop.add(g.id);
      } }
    return { over: over.size, twoHop: twoHop.size, lots: state.lastReport.bases.lots, names: state.lastReport.bases.names, stranded: state.lastReport.bases.stranded, crossings: state.lastReport.bases.crossings,
      back: state.lastReport.liftRides[${s.K}] || 0, main: state.lastReport.liftRides[${s.M}] || 0, text: $('rpBody').textContent };
  })()`);
  eq(d.names, ['Main lot', 'East lot', 'Back lot'], 'the day report names each base');
  assert(d.lots.every((n) => n > 0), `guests parked at all three bases (${d.lots})`);
  assert(d.back > 30 && d.main > 30, `the back lift and the main gondola are ridden (${d.back}, ${d.main})`);
  assert(d.twoHop > 0, `some guests cross two bases to get where they're going (${d.twoHop})`);
  eq(d.over, 0, 'nobody walks over the ridge between the back base and the front');
  assert(d.stranded < 10, `hardly anyone is stuck at the wrong base (${d.stranded})`);
  assert(/Guests by base: Main lot/.test(d.text) && /Back lot/.test(d.text), 'the report lists guests by base');
  eq(g.errors, [], 'no page errors');
  await g.page.close();

  // A lot far along a flat valley is a base of its own (so it can have a village gondola), but it's a walk from the
  // main base: its guests walk over, as they did when it counted as part of the main base.
  const j = await openGame(browser, url);
  await j.click('#startBtn'); await j.wait(300);
  await j.ev(SETUPS.juniperStarter); await j.ev(SETUPS.midwinter);
  const f = await j.ev(`(() => { state.parks.push({ id: 2, name: 'Far lot', x: -79, z: 93, a: 0, n: 16, R: 2, ents: [{ s: 2, t: 0.45 }] }); state.parks[0].n = 4; netChanged(); buildLot();
    return { n: baseCount(), far: baseOfLot(1), reached: parkReached(1), cost: crossCost(1, 0) }; })()`);
  assert(f.n === 2 && f.far === 1 && f.reached && f.cost < 5, `the far lot is a second base, a walk from the first (${JSON.stringify(f)})`);
  await j.ev(`openDay()`); await j.ev(SETUPS.finishDay);
  const r = await j.ev(`({ lots: state.lastReport.bases.lots, stranded: state.lastReport.bases.stranded, guests: state.lastReport.guests })`);
  assert(r.lots[1] > 20 && r.stranded === 0, `guests park at the far lot, walk over and get home (${JSON.stringify(r)})`);
  eq(j.errors, [], 'no page errors on Juniper');
  await j.page.close();
}
