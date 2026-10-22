// The main lot grows to four sections onto clear ground; after that, satellite lots go beside the road.
// Cars fill the main lot first, then drive along the road to a satellite; bigger old lots are kept.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter);
  await g.ev(`state.cash = 5e6`);
  // grow the main lot until it can't
  await g.ev(`openManage('blds')`); await g.wait(100);
  for (let i = 0; i < 6; i++) { await g.ev(`(() => { const b = $('sheet').querySelector('[data-action=expandLot]'); if (b) b.click(); })()`); await g.wait(100); }
  const n = await g.ev(`state.lotSections`);
  assert(n >= 1 && n <= 4, `the main lot stops at four sections (${n})`);
  assert(await g.ev(`!!mainLotBlock()`), 'and says why it can’t grow');
  // a satellite lot beside the road
  const spot = await g.ev(`(() => { for (const p of ROAD_WORLD) for (const off of [-6, 6]) for (let t = 0; t < 1; t += 0.25) {
      const q = { x: p.x, z: p.z + off * 1.5 }; const sn = snapToRoad('parking', q); const v = evalBuilding('parking', sn.x, sn.z, sn.rot, false);
      if (!v.problems.length) return sn; } return null; })()`);
  assert(spot, 'found a spot beside the road');
  const before = await g.ev(`stalls.length`);
  await g.ev(`(() => { const s = ${JSON.stringify(spot)}; const v = evalBuilding('parking', s.x, s.z, s.rot, false); commitBuilding(v, 'parking', s.x, s.z, s.rot); computeNetwork(); syncLabels(); })()`);
  eq(await g.ev(`stalls.length`) - before, 96, 'the satellite adds 96 spaces');
  eq(await g.ev(`lotCapacity()`), n * 96 + 96, 'capacity counts it');
  // with the main lot full, the next car goes to the satellite, by road
  await g.ev(SETUPS.midwinter);
  await g.ev(`(() => { openDay(); state.speed = 0; for (const s of stalls) if (!s.sat) s.car = -1; spawnCar(2); })()`);
  const car = await g.ev(`(() => { const c = cars[cars.length - 1], s = stalls[c.stall]; return { sat: s.sat, end: c.path[c.path.length - 1], s: { x: s.x, z: s.z }, len: c.len, first: c.path[0], road0: ROAD_WORLD[0] }; })()`);
  assert(car.sat, 'the car parks in the satellite');
  eq(car.first, car.road0, 'it comes in along the road');
  assert(Math.hypot(car.end.x - car.s.x, car.end.z - car.s.z) < 0.01, 'and ends in its space');
  await g.ev(`(() => { for (const s of stalls) if (s.car === -1) s.car = null; })()`);
  // a whole day runs with guests using both lots
  await g.ev(`(() => { let k = 0; while (state.phase === 'open' && k < 90000) { simStep(1.5); k++; } })()`);
  assert(await g.ev(`!!state.lastReport`), 'the day finished');
  // the panel describes it
  await g.ev(`select({ kind: 'bld', obj: world.buildings.find((b) => b.type === 'parking') })`); await g.wait(100);
  assert(/96 spaces/.test(await g.ev(`$('sheet').innerText`)), 'the lot panel shows its spaces');
  // older resorts keep a bigger main lot
  await g.ev(`(() => { select(null); state.lotSections = 6; buildLot(); saveNow(); })()`);
  await g.page.reload(); await g.reloaded();
  eq(await g.ev(`state.lotSections`), 6, 'a six-section lot is kept');
  eq(await g.ev(`stalls.filter((s) => !s.sat).length`), 576, 'with all its spaces');
  eq(await g.ev(`world.buildings.filter((b) => b.type === 'parking').length`), 1, 'the satellite is saved');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
