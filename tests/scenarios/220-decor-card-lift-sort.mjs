// Players' feedback, Nov 11: a picnic table's card read like a bus station's while the resort was open ("waiting for
// the town bus"); now seats and rests show for benches, picnic tables and fire pits, and other decor shows nothing.
// And the Lifts list sorts, like the Trails list: by name, most rides, longest wait or status.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 2e7`);

  // 1) A picnic table and a lamp, built, then the resort open: their cards.
  const a = await g.ev(`(() => { const out = {}; const L = world.lifts[0];
    for (const t of ['picnic', 'lamp']) { let B = null;
      for (let dz = -14; dz <= 14 && !B; dz += 2) for (let dx = -14; dx <= 14 && !B; dx += 2) { const x = L.a.x + dx, z = L.a.z + dz, e = evalBuilding(t, x, z, 0); if (!e.problems.length) B = commitBuilding(e, t, x, z, 0); }
      out[t] = B && B.id; }
    openDay(); state.speed = 0; for (let k = 0; k < 200; k++) simStep(1);
    for (const t of ['picnic', 'lamp']) { const B = world.buildings.find((x) => x.id === out[t]); if (!B) { out[t] = 'not built'; continue; } select({ kind: 'bld', obj: B }); out[t] = document.getElementById('sheet').innerText; }
    return out; })()`);
  assert(!/bus|shuttle/i.test(a.picnic) && /seats taken/.test(a.picnic) && /rests today/.test(a.picnic), `the picnic table shows its seats, not buses: ${a.picnic}`);
  assert(!/revenue/i.test(a.picnic), `no revenue line for a free table: ${a.picnic}`);
  assert(!/bus|shuttle|TODAY\n\n/i.test(a.lamp) && !/waiting/.test(a.lamp), `a lamp shows nothing about buses: ${a.lamp}`);

  // 2) The Lifts list: a Sort chip that cycles name → most rides → longest wait → status, and orders the rows.
  const b = await g.ev(`(() => { const L = world.lifts[0], M = { ...L, id: 9999, name: 'Aardvark Double', riders: [], queue: [] }; world.lifts.push(M);
    today.liftRiders[L.id] = 50; today.liftRiders[M.id] = 5;
    const names = () => [...document.querySelectorAll('#sheet .llist .lrow b')].map((e) => e.textContent);
    const order = []; openManage('lifts');
    for (let k = 0; k < 4; k++) { order.push([listView.lifts.sort, names()]); document.querySelector('#sheet [data-action="liftSort"]').click(); }
    world.lifts.pop(); delete today.liftRiders[M.id]; return { order, back: listView.lifts.sort, L: L.name }; })()`);
  eq(b.order.map((o) => o[0]), ['name', 'rides', 'wait', 'status'], 'the sort chip cycles');
  eq(b.back, 'name', 'and comes back round to name');
  eq(b.order[0][1][0], 'Aardvark Double', 'by name: A first');
  eq(b.order[1][1][0], b.L, 'by most rides: the busy lift first');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
