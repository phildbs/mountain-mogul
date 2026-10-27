// Evening guests who park off-site keep who they are on the shuttle: après locals go to the bar
// without buying a lift ticket, and night skiers pay the night price. Nobody is charged a day
// ticket at dusk and refunded straight after.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const ok = await g.ev(`(() => {
    state.cash = 5e6; state.offsite = 1;
    for (const p of ROAD_WORLD) for (const off of [-3, 3]) {
      const sn = snapToRoad('shuttle', { x: p.x, z: p.z + off }); const v = evalBuilding('shuttle', sn.x, sn.z, sn.rot, false);
      if (!v.problems.length && isBase({ x: sn.x, z: sn.z })) { commitBuilding(v, 'shuttle', sn.x, sn.z, sn.rot); computeNetwork(); return true; }
    }
    return false;
  })()`);
  assert(ok, 'a shuttle station by the road');
  await g.ev(`(() => { realTrails()[0].lit = true; for (const k of ['weekday', 'weekend', 'quiet']) { opsState().plans[k].apres = 'on'; opsState().plans[k].night = 1200; } openDay(); state.speed = 0; state.time = 1000; })()`);
  // an après car and a night car, both sent off-site
  const r = await g.ev(`(() => {
    const st = stations()[0], before = { refunds: today.refunds || 0, tickets: today.rev.tickets, night: today.rev.night, guests: today.guests };
    parkOffsite(3, false, true); parkOffsite(2, true, false);
    const load = offQueue.splice(0); parkUnload({ load }, st);
    const evening = guests.filter((x) => x.apresGuest && !x.night), night = guests.filter((x) => x.night);
    return { refunds: (today.refunds || 0) - before.refunds, tickets: today.rev.tickets - before.tickets, nightRev: today.rev.night - before.night,
      evening: evening.length, eveningPaid: evening.filter((x) => x.paid).length, night: night.length, nightPrice: night.every((x) => x.pass || x.paid === svcPrice('night')) };
  })()`);
  eq(r.evening, 3, 'three après locals off the shuttle');
  eq(r.eveningPaid, 0, 'with no lift ticket');
  eq(r.night, 2, 'two night skiers off the shuttle');
  assert(r.nightPrice, 'paying the night price');
  eq(r.tickets, 0, 'no day tickets sold at dusk');
  eq(r.refunds, 0, 'and nothing refunded');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
