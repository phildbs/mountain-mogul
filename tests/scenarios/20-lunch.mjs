// Hungry guests go where they'll eat soonest: they skip a jammed restaurant when the lodge has room,
// and leave a stalled line for a faster one.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  // a restaurant beside the lodge
  const placed = await g.ev(`(() => {
    const L = world.buildings[0];
    for (const [dx, dz] of [[8,0],[-8,0],[0,8],[0,-8],[10,6],[-10,6],[10,-6],[-10,-6],[14,0],[-14,0]]) for (const r of [0, Math.PI/2]) {
      const b = evalBuilding('restaurant', L.x + dx, L.z + dz, r);
      if (!b.problems.length) { commitBuilding(b, 'restaurant', L.x + dx, L.z + dz, r); computeNetwork(); syncLabels(); return true; }
    }
    return false;
  })()`);
  assert(placed, 'restaurant placed near the lodge');
  await g.ev(`openDay(); (() => { let n = 0; while (state.time < 700 && n < 90000) { simStep(1.5); n++; } })(); state.speed = 0`);
  const r = await g.ev(`(() => {
    const lodge = world.buildings.find((B) => B.type === 'lodge'), rest = world.buildings.find((B) => B.type === 'restaurant');
    // jam the restaurant: every seat taken and a long line
    rest.used.seat = poolSlots(rest, 'seat');
    const filler = guests.filter((x) => x.st === 'ski' || x.st === 'queue').slice(0, 40);
    for (const x of filler) rest.q.seat.push({ ...x, id: -x.id, qT: state.time, svc: 'dine' });
    lodge.q.seat.length = 0; lodge.used.seat = 0;
    const g0 = guests.find((x) => x.st === 'ski' && !x.ate);
    g0.fancy = true; g0.lunchAt = state.time - 1; g0.qh = 0.3; g0.pat = 6; // an ordinary guest, not one happy to wait 20 minutes
    const pick = bestVisit(g0, rest.door, 30, true, world.buildings, ['lunch']);
    return { pick: pick && pick.B.type, restWait: Math.round(estWait(rest, 'dine')), lodgeWait: Math.round(estWait(lodge, 'food')) };
  })()`);
  assert(r.restWait > 15 && r.lodgeWait < 5, `restaurant jammed (${r.restWait} min), lodge free (${r.lodgeWait} min)`);
  eq(r.pick, 'lodge', 'a hungry guest picks the lodge over the jammed restaurant, even one who likes dining out');

  // a guest already stuck at the back of the restaurant line moves to the lodge
  const sw = await g.ev(`(() => {
    const lodge = world.buildings.find((B) => B.type === 'lodge'), rest = world.buildings.find((B) => B.type === 'restaurant');
    const g1 = guests.find((x) => x.st === 'ski' && !x.ate);
    g1.svc = 'dine'; g1.bid = rest.id; g1.resume = { k: 'base' }; g1.st = 'bq'; g1.qT = state.time - 8; g1.pat = 14; g1.qLook = 0;
    rest.q.seat.push(g1);
    bldStep(rest);
    return { left: !rest.q.seat.includes(g1), heading: g1.then && g1.then.k === 'bld' ? bldById(g1.then.bid).type : null, thought: g1.th[0] };
  })()`);
  eq([sw.left, sw.heading], [true, 'lodge'], 'stuck guest leaves the slow line for the lodge');
  assert(/Trying/.test(sw.thought), `and says so ("${sw.thought}")`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
