// Walking round an L-shaped base (Adum888, Nov 27): a walk across the base whose straight line leaves base ground
// follows the base ground round the hill, corner to corner; a walk in plain sight still goes straight.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const r = await g.ev(`(() => {
    const M = baseMask(), real = M.m.slice();
    // An L: one arm along z = 60..70 from x = -60 to 0, the other along x = -10..0 from z = 20 to 70. The corner
    // between them (x < -10, z < 60) is a hill.
    M.m.fill(0);
    for (let x = -60; x <= 0; x++) for (let z = 20; z <= 70; z++) if (z >= 60 || x >= -10) M.m[(z + HALF) * NV + x + HALF] = 1;
    M.floods.clear();
    const walk = (from, to) => { const q = { id: -3, x: from.x, z: from.z }; setMove(q, to, 'walk', { k: 'test' }); return q; };
    const a = { x: -55, z: 65 }, b = { x: -5, z: 25 }, q = walk(a, b);
    const pts = q.then.k === 'bway' ? [a, { x: q.tx, z: q.tz }, ...q.then.path.map(([x, z]) => ({ x, z }))] : [a, b];
    let len = 0, onBase = true;
    for (let i = 1; i < pts.length; i++) { len += distXZ(pts[i], pts[i - 1]); if (!maskSees(M.m, pts[i - 1], pts[i], 1.5)) onBase = false; }
    const straight = walk({ x: -55, z: 65 }, { x: -5, z: 66 }); // along one arm: in sight
    // Walking back the other way reuses the search already made (from where they now stand).
    const nF = M.floods.size, back = walk(b, a), bpts = [b, { x: back.tx, z: back.tz }, ...back.then.path.map(([x, z]) => ({ x, z }))];
    let blen = 0, bOn = true; for (let i = 1; i < bpts.length; i++) { blen += distXZ(bpts[i], bpts[i - 1]); if (!maskSees(M.m, bpts[i - 1], bpts[i], 1.5)) bOn = false; }
    const backR = { kind: back.then.k, newSearch: M.floods.size - nF, on: bOn, len: blen, end: bpts.at(-1) };
    // A guest following the corners arrives where they were going, with the step they meant to take next.
    const g2 = { id: -4, x: a.x, z: a.z }; setMove(g2, b, 'walk', { k: 'test' });
    for (let n = 0; n < 5000; n++) if (moveToward(g2, WALK, 1)) { if (g2.then.k === 'bway' && g2.then.path.length) arrive(g2); else break; } // stop before the last step runs
    const label = guestActivity({ id: -5, x: a.x, z: a.z, st: 'walk', then: { k: 'bway', m: 'walk', path: [], next: { k: 'hubCar' } } });
    M.m.set(real); M.floods.clear();
    return { kind: q.then.k, next: q.then.next && q.then.next.k, corners: pts.length, len, direct: distXZ(a, b), onBase, end: pts.at(-1),
      straight: straight.then.k, backR, there: [Math.round(g2.x), Math.round(g2.z), g2.then.next && g2.then.next.k], label };
  })()`);
  eq([r.kind, r.next], ['bway', 'test'], 'a walk across the hill goes round, then carries on as planned');
  assert(r.onBase, `every leg stays on base ground: ${JSON.stringify(r)}`);
  assert(r.len > r.direct * 1.2 && r.len < r.direct * 1.6, `round the corner, not square by square (${r.len.toFixed(1)} vs ${r.direct.toFixed(1)} straight)`);
  assert(r.corners <= 5, `only the corners (${r.corners} points)`);
  eq([r.end.x, r.end.z], [-5, 25], 'it reaches the exact spot');
  eq(r.straight, 'test', 'a walk in plain sight goes straight');
  eq([r.backR.kind, r.backR.newSearch, r.backR.on, r.backR.end.x, r.backR.end.z], ['bway', 0, true, -55, 65], 'the walk back goes round too, with no new search');
  assert(Math.abs(r.backR.len - r.len) < 3, `and is about as long (${r.backR.len.toFixed(1)})`);
  eq(r.there, [-5, 25, 'test'], 'a guest walking it arrives and goes on to their next step');
  eq(r.label, 'Walking back to the car', 'their card still says where they are going');

  // A real day on the real base: nothing breaks, and a mid-day save keeps a walk round the base.
  const day = await g.ev(`(() => { openDay(); state.speed = 0; let n = 0, ways = 0;
    while (state.time < 660 && state.phase === 'open' && n++ < 90000) { simStep(1.5); for (const x of guests) if (x.then && x.then.k === 'bway') ways++; }
    return { ways, guests: guests.length }; })()`);
  assert(day.guests > 0, 'guests came');
  eq(await g.ev(`(() => { const n = guests.length; restoreSim(JSON.parse(JSON.stringify(serializeSim()))); return guests.length === n; })()`), true, 'a mid-day save loads back');
  eq(await g.ev(SETUPS.finishDay), 'report', 'the day ends');
  eq(g.errors, [], 'no errors');
  await g.page.close();
  return `${r.corners} points, ${r.len.toFixed(1)} round vs ${r.direct.toFixed(1)} straight; ${day.ways} walk-round samples on Juniper's real base`;
}
