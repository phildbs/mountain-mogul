// Services: a first-aid clinic, a kids' camp and heated restrooms at the base, and a transit center beside the road.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  // a bus stop away from the road is refused
  const far = await g.ev(`(() => { const L = world.buildings[0]; return evalBuilding('transit', L.x, L.z + 8, 0).problems.join(' '); })()`);
  assert(/beside the access road/.test(far), `a transit center has to go by the road (${far})`);
  const placed = await g.ev(`(() => { const out = [], L = world.buildings[0];
    const near = [[8,0],[-8,0],[0,8],[12,0],[-12,0],[8,8],[-8,8],[16,2],[-16,2],[0,13],[12,10],[-12,10],[18,8],[-18,8],[20,0],[-20,0]];
    for (const type of ['patrol', 'clinic', 'kids', 'hrest']) {
      let ok = false;
      for (const [dx, dz] of near) { if (ok) break; for (const r of [0, 1, 2, 3]) {
        const b = evalBuilding(type, L.x + dx, L.z + dz, r);
        if (!b.problems.length) { commitBuilding(b, type, L.x + dx, L.z + dz, r); out.push(type); ok = true; break; } } }
    }
    // a bus stop snaps to the road from a click nearby
    const e = roadEnd(), sn = snapToRoad('transit', { x: e.x - 8, z: e.z - 6 }), tb = evalBuilding('transit', sn.x, sn.z, sn.rot);
    if (!tb.problems.length) { commitBuilding(tb, 'transit', sn.x, sn.z, sn.rot); out.push('transit'); } else out.push(tb.problems.join(' '));
    computeNetwork(); syncLabels();
    return out; })()`);
  eq(placed, ['patrol', 'clinic', 'kids', 'hrest', 'transit'], 'patrol hut, clinic, kids’ camp and heated restrooms at the base, transit center snapped to the road');
  const drive = await g.ev(`(() => { const B = world.buildings.find((b) => b.type === 'transit'), Q = drivewayQuad(B); return { q: !!Q, mesh: B.group.children.some((m) => m.material === DRIVE_MAT), gap: Q ? Math.max(...Q.es.map((p) => nearestRoad(p).d)) : 99 }; })()`);
  assert(drive.q && drive.mesh && drive.gap < 1.2, `a paved apron joins the bay to the road (${JSON.stringify(drive)})`);
  await g.ev(`openDay()`);
  // late morning: a few skiers take a fall
  await g.ev(`(() => { let n = 0; while (state.time < 660 && n < 90000) { simStep(1.5); n++; } })()`);
  const hurt = await g.ev(`(() => { const sk = guests.filter((x) => x.T && !x.gone && x.st !== 'hurt').slice(0, 8); sk.forEach(injure); return sk.length; })()`);
  assert(hurt >= 4, `some skiers to injure (${hurt})`);
  await g.ev(SETUPS.finishDay);
  const r = await g.ev(`(() => { const by = (t) => world.buildings.find((B) => B.type === t).yday, rp = state.lastReport;
    return { clinic: by('clinic'), kids: by('kids'), hrest: by('hrest'), patched: rp.patched, campers: rp.campers, bus: rp.busGuests, guests: rp.guests, lessons: rp.rev.lessons }; })()`);
  assert(r.clinic.visits > 0, `the clinic saw patients (${r.clinic.visits})`);
  assert(r.patched > 0, `some injured guests went back out (${r.patched})`);
  assert(r.kids.visits > 0 && r.kids.revenue > 0 && r.campers === r.kids.visits, `kids spent the day at camp (${r.kids.visits}, ${r.kids.revenue})`);
  assert(r.lessons >= r.kids.revenue, 'camp fees count with lessons');
  assert(r.hrest.visits > 0, `guests used the heated restrooms (${r.hrest.visits})`);
  assert(r.bus > r.guests * 0.3, `the transit center brought in a big share by bus (${r.bus} of ${r.guests})`);
  const text = await g.ev(`$('rpBody').textContent`);
  assert(/at camp/.test(text) && /patched up/.test(text), 'the report mentions campers and the clinic');
  eq(await g.ev(`svcRef('camp')`), 110, 'guests compare against $110 for camp');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
