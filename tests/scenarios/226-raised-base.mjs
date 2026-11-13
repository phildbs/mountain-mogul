// A second base up on a shelf (Nov 13 feedback: "Second base parkings in custom maps. Cars don't park"). Base ground was
// only ground within 3.5 of the lowest on the map, so on a hand-shaped mountain a lot built higher up had none: its lift
// wasn't "from the base", nobody rode it, and its lot stayed nearly empty. Base ground now starts from the lot's own level.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  // Juniper's ground with a shelf 7 up beside the access road, as a hand-shaped mountain
  const a = await openGame(browser, url);
  const [id, doc] = await a.ev(`(() => { const E = gridOf(MOUNTAINS.juniper), H = E[(72 + HALF) * NV + HALF] + 7;
    for (let j = -26; j <= 26; j++) for (let i = -26; i <= 26; i++) { const d = Math.hypot(i, j), k = (86 + j + HALF) * NV - 76 + i + HALF; E[k] = lerp(Math.max(E[k], H), E[k], sstep(12, 26, d)); }
    const id = keepMapDoc({ v: 1, name: 'Shelf', from: 'juniper', h: encodeHeights(E) }); return [id, localStorage.getItem(mapKey(id))]; })()`);
  await a.page.close();
  const g = await openGame(browser, url, { mountain: 'fresh' });
  await g.page.goto(url + 'blank');
  await g.page.evaluate(([k, v, id]) => { localStorage.clear(); localStorage.setItem('mm.rpView', 'full'); localStorage.setItem(k, v); sessionStorage.setItem('skiTycoon.juniperRidge.v1.boot', JSON.stringify({ mt: id })); }, ['mm.map.' + id.slice(3), doc, id]);
  await g.page.goto(url);
  await g.page.waitForFunction(() => window.__dbg && !document.getElementById('loading'), null, { timeout: 60000 });
  await g.click('#startBtn'); await g.wait(300);
  eq(await g.ev(`[MOUNTAIN.hand, MOUNTAIN.id]`), [true, id], 'playing the hand-shaped mountain');
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const s = await g.ev(`(() => { state.cash = 5e7;
    state.parks.push({ id: 2, name: 'Shelf lot', x: -79, z: 93, a: 0, n: 16, R: 2, ents: [{ s: 2, t: 0.45 }] }); netChanged(); buildLot();
    let L = null; for (const [ax, az] of [[-72, 80], [-68, 78], [-76, 80], [-70, 76]]) for (const [bx, bz] of [[-40, 10], [-30, 0], [-50, 15], [-20, 5]]) { if (L) break; const i = evalLift({ x: ax, z: az }, { x: bx, z: bz }, 'double'); if (!i.problems.length) { commitLift(i, 'double'); computeNetwork(); L = world.lifts.at(-1); } }
    if (!L) return 'no lift';
    return { up: trueY(L.a.x, L.a.z) - MOUNTAIN.baseH, bases: baseCount(), lot: baseOfLot(1), reached: parkReached(1), fromBase: L.fromBase, reachable: L.reachable, id: L.id }; })()`);
  assert(typeof s === 'object', `a lift from the shelf (${s})`);
  assert(s.up > 6, `the shelf is well above the lowest ground (${s.up})`);
  eq([s.bases, s.lot, s.reached, s.fromBase, s.reachable], [2, 1, true, true, true], 'the shelf lot is a second base, and its lift starts from it');
  await g.ev(`openDay()`);
  const d = await g.ev(`(() => { let n = 0, peak = 0; while (state.phase === 'open' && n < 90000) { simStep(1.5); n++; if (n % 50 === 0) peak = Math.max(peak, stalls.filter((x) => x.lot === 1 && x.car).length); }
    return { peak, rides: state.lastReport.liftRides[${s.id}] || 0, stranded: state.lastReport.bases.stranded }; })()`);
  assert(d.peak > 40, `cars park at the shelf lot (${d.peak} of 64)`);
  assert(d.rides > 100, `and its lift is ridden (${d.rides})`);
  assert(d.stranded < 10, `hardly anyone is stuck at the wrong base (${d.stranded})`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
