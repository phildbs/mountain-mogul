// Parking: lots are built in the Roads tool. When they're full, cars go to off-site parking and parking shuttles carry guests between it and the
// stations; old satellite lots become off-site parking, and bigger old main lots are kept.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter);
  await g.ev(`state.cash = 5e6`);
  // lots are drawn in the Roads tool now: no ground is held back for the main lot to grow onto
  eq(await g.ev(`lotReserve().length`), 0, 'no expansion ground is reserved');
  await g.ev(`openManage('parking')`); await g.wait(100);
  assert(await g.ev(`!!document.querySelector('#sheet [data-action=roadsOpen][data-v=parking]')`), 'Parking leads to the Roads tool to build lots');
  // off-site parking: set up under Parking (the Buildings list links there); it needs a shuttle station to work
  await g.ev(`(() => { select(null); openManage('blds'); })()`); await g.wait(100);
  assert(/Parking and buses/.test(await g.ev(`$('sheet').innerText`)), 'the Buildings list links to Parking');
  await g.click('[data-action=manage][data-v=parking]'); await g.wait(100);
  assert(/Off-site parking/.test(await g.ev(`$('sheet').innerText`)) && /Not set up/i.test(await g.ev(`$('sheet').innerText`)), 'Parking offers off-site parking');
  await g.click('[data-action=offsiteBuy]'); await g.wait(100);
  eq(await g.ev(`state.offsite`), 0, 'a gravel field is set up');
  assert(/needs a station/i.test(await g.ev(`$('sheet').innerText`)), 'and it says it needs a shuttle station');
  // two stations by the road, one each side of the base
  const spots = await g.ev(`(() => { const out = []; for (const p of ROAD_WORLD) for (const off of [-3, 3]) {
      const sn = snapToRoad('shuttle', { x: p.x, z: p.z + off }); const v = evalBuilding('shuttle', sn.x, sn.z, sn.rot, false);
      if (!v.problems.length && isBase({ x: sn.x, z: sn.z }) && !out.some((o) => Math.hypot(o.x - sn.x, o.z - sn.z) < 14)) out.push(sn); } return out.slice(0, 2); })()`);
  eq(spots.length, 2, 'found two station spots');
  for (const sp of spots) await g.ev(`(() => { const s = ${JSON.stringify(sp)}; const v = evalBuilding('shuttle', s.x, s.z, s.rot, false); commitBuilding(v, 'shuttle', s.x, s.z, s.rot); computeNetwork(); syncLabels(); })()`);
  // Operations offers the shuttle frequency and the town bus switch
  await g.ev(`openManage('ops')`); await g.wait(100);
  const ops = await g.ev(`$('sheet').innerText`);
  assert(/Parking shuttles/i.test(ops) && /Town buses/i.test(ops), 'Operations has parking shuttles and town buses');
  // a busy day with the main lot full: cars go off-site and their guests arrive by shuttle
  await g.ev(SETUPS.midwinter);
  await g.ev(`(() => { opsState().plans.weekday.townBus = 'off'; opsState().plans.weekend.townBus = 'off'; opsState().plans.quiet.townBus = 'off'; openDay(); state.speed = 0; for (const s of stalls) s.car = -1; for (let i = 0; i < 20; i++) spawnCar(2); })()`);
  eq(await g.ev(`[offCars.length, offQueue.length, today.offUsed]`), [20, 20, 20], 'twenty cars park off-site and wait for a shuttle');
  await g.ev(`(() => { let k = 0; while (!guests.some((g) => offCars.some((c) => c.id === g.car)) && k < 2000) { simStep(1.5); k++; } })()`);
  const rode = await g.ev(`(() => { const g = guests.find((x) => offCars.some((c) => c.id === x.car)); const near = world.buildings.filter(isStation).map((B) => distXZ(g, B.door)); return { near: Math.min(...near), bus: buses.some((b) => b.kind === 'park') }; })()`);
  assert(rode.near < 3, `the shuttle drops them at a station (${rode.near.toFixed(1)} away)`);
  // heading home they walk to the nearest station and ride back, freeing the spaces
  await g.ev(`(() => { for (const s of stalls) if (s.car === -1) s.car = null; let k = 0; while (state.phase === 'open' && k < 90000) { simStep(1.5); k++; } })()`);
  const r = await g.ev(`state.lastReport`);
  assert(r && r.offsite && r.offsite.cars >= 20, `the report counts off-site cars (${JSON.stringify(r && r.offsite)})`);
  assert(r.exp.shuttles > 0, `shuttles and the lease cost money (${r.exp.shuttles})`);
  eq(await g.ev(`offCars.length`), 0, 'every off-site car went home');
  // shuttles off in the plan: no off-site parking that day
  await g.ev(`(() => { if (state.phase === 'report') nextDay(); for (const k of ['weekday', 'weekend', 'quiet']) opsState().plans[k].shuttles = 'off'; openDay(); state.speed = 0; for (const s of stalls) s.car = -1; spawnCar(2); })()`);
  eq(await g.ev(`offCars.length`), 0, 'with shuttles off, cars aren’t sent off-site');
  await g.ev(`(() => { for (const s of stalls) if (s.car === -1) s.car = null; let k = 0; while (state.phase === 'open' && k < 90000) { simStep(1.5); k++; } if (state.phase === 'report') nextDay(); })()`);
  // a transit center is its own building in the build menu, beside the road; stations no longer upgrade
  const st = await g.ev(`world.buildings.find(isStation).id`);
  await g.ev(`select({ kind: 'bld', obj: bldById(${st}) })`); await g.wait(100);
  assert(!/Upgrade to a transit center/i.test(await g.ev(`$('sheet').innerText`)), 'a station no longer offers an upgrade');
  await g.ev(`(() => { select(null); openRoads('transit'); })()`); await g.wait(50);
  assert(await g.ev(`!!document.querySelector('#sheet [data-action=transitPick][data-v=transit]')`), 'Transit center is under Roads › Transit');
  const tc = await g.ev(`(() => { state.cash = 5e6; for (let i = 0; i < 30; i++) { const sn = snapToRoad('transit', { x: -40 + i * 4, z: 60 }), v = evalBuilding('transit', sn.x, sn.z, sn.rot, false); if (!v.problems.length) { const b = commitBuilding(v, 'transit', sn.x, sn.z, sn.rot); computeNetwork(); return b.type; } } return null; })()`);
  eq(tc, 'transit', 'and it builds beside the road');
  await g.ev(`setTool('explore')`);
  // older resorts keep a bigger main lot
  const six = await g.ev(`(() => { select(null); const sv = JSON.parse(JSON.stringify(saveData(false))); delete sv.clock.parks; sv.clock.lotSections = 6; sv.clock.lotLayout = null; // a save from before lots of any shape
    applySave(sv); const out = [parks().length, parks()[0].n, stalls.length]; saveNow(); return out; })()`);
  eq(six, [1, 96, 576], 'a six-section lot is kept, as one long lot with all its spaces');
  await g.page.reload(); await g.reloaded();

  eq(await g.ev(`state.offsite`), 0, 'off-site parking is saved');
  // a resort saved with satellite lots gets off-site parking instead
  await g.ev(`(() => { window.removeEventListener('pagehide', saveNow); const k = saveKey(); // no save on the way out: it would overwrite the old one
    const sv = JSON.parse(localStorage.getItem(k)); sv.clock.offsite = -1; sv.world.buildings.push({ id: 9001, type: 'parking', tier: 1, x: 0, z: 70, rot: 0, name: 'Lot B', spent: 150000 });
    sv.world.plans = [...(sv.world.plans || []), { kind: 'bld', type: 'parking', x: 5, z: 70, rot: 0, cost: 75000 }]; localStorage.setItem(k, JSON.stringify(sv)); })()`);
  await g.page.reload(); await g.reloaded();
  eq(await g.ev(`[state.offsite, world.buildings.some((b) => b.type === 'parking'), world.plans.length]`), [1, false, 0], 'a 192-space satellite lot became a paved off-site lot');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
