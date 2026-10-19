// Express quad and gondola: capacities, a gondola carrying skiers and sightseers on a cold day, and wind holds.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 2e7`);
  eq(await g.ev(`[liftCapacity(LIFT_TYPES.hsq), liftCapacity(LIFT_TYPES.gondola)]`), [2250, 2260], 'express quad and gondola capacities');
  const built = await g.ev(`(() => { const i = evalLift({ x: 30, z: 58 }, { x: 34, z: -20 }, 'gondola'); if (i.problems.length) return i.problems.join('|');
    commitLift(i, 'gondola'); const G = world.lifts.find((l) => l.type === 'gondola');
    for (const path of [[[G.b.x - 3, G.b.z + 2], [30, 10], [28, 40], [24, 59]], [[G.b.x + 3, G.b.z + 2], [40, 10], [38, 40], [34, 60]]]) {
      const pts = path.map(([x, z]) => ({ x, z, y: heightAt(x, z) })); const t = evalTrail(pts, 'wide', false, true);
      if (!t.an.problems.length) { commitTrail(t, pts, 'wide'); computeNetwork(); }
    }
    computeNetwork(); syncLabels(); return { fromBase: G.fromBase, departing: G.departing.length, returns: G.returns }; })()`);
  assert(built.fromBase && built.departing > 0 && built.returns, `the gondola starts at the base and has a way down (${JSON.stringify(built)})`);
  // a cold weekend day
  await g.ev(`state.wx.days[0].hi = 10; state.wx.days[0].wind = 10; state.day = 40; refreshSnowState(todayWx()); openDay()`);
  await g.ev(SETUPS.finishDay);
  const r = await g.ev(`(() => { const r = state.lastReport, G = world.lifts.find((l) => l.type === 'gondola'); return { sight: r.sightseers, rides: (today.liftRiders || {})[G.id] || 0, refunded: r.refunded || 0, text: $('rpBody').textContent }; })()`);
  assert(r.sight > 0, `sightseers rode the gondola (${r.sight})`);
  assert(r.rides > 20, `skiers rode the gondola (${r.rides})`);
  assert(/sightseers rode the gondola/.test(r.text), 'the report mentions sightseers');
  // wind: the gondola stops first, the express quad holds on like the six-pack
  const w = await g.ev(`(() => { const G = world.lifts.find((l) => l.type === 'gondola'); return [windHoldAt(G, 45), windHoldAt(G, 55), windHoldAt({ ...world.lifts[0], type: 'hsq' }, 40)]; })()`);
  eq([w[1], w[2]], [true, false], 'a gondola stops at 55 mph; an express quad runs at 40');
  eq(await g.ev(`svcRef('scenic')`), 25, 'guests compare a scenic ride against $25');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
