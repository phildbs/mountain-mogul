// Lifts that connect at the top: a lift loading a short, level glide from another lift's top gets skiers without a trail.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 2e7`);
  const r = await g.ev(`(() => { const L = world.lifts[0], a = { x: 22, z: -8 };
    const i = evalLift(a, { x: 25, z: -38 }, 'double'); if (i.problems.length) return i.problems.join('|');
    commitLift(i, 'double'); const M = world.lifts[1];
    const pts = [[M.b.x + 3, M.b.z + 2], [M.b.x + 8, (M.b.z + 15) / 2], [23, 16]].map(([x, z]) => ({ x, z, y: heightAt(x, z) }));
    const t = evalTrail(pts, 'medium', false, true); if (t.an.problems.length) return t.an.problems.join('|');
    commitTrail(t, pts, 'medium'); computeNetwork(); syncLabels();
    return { transfers: L.transfers.map((x) => x.id === M.id), reach: M.reachable, returns: M.returns, top: liftSheet(L).includes('glide over'), bottom: liftSheet(M).includes('the top of') }; })()`);
  eq(r, { transfers: [true], reach: true, returns: true, top: true, bottom: true }, 'the second lift connects at the first one’s top, and both panels say so');
  await g.ev(`state.day = 40; openDay()`); await g.ev(SETUPS.finishDay);
  const rides = await g.ev(`(today.liftRiders || {})[world.lifts[1].id] || 0`);
  assert(rides > 50, `skiers glided over and rode the second lift (${rides})`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
