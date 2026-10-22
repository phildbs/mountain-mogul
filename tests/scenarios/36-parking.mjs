// The main lot grows section by section as far as the land allows, warning anyone who builds in its way;
// satellite lots go beside the road, levelled to it, and upgrade to two sections. Cars fill the main lot first, then drive along the road to a satellite; bigger old lots are kept.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter);
  await g.ev(`state.cash = 5e6`);
  // building where the main lot will grow is allowed, with a heads-up
  const room = await g.ev(`lotReserve().length`);
  assert(room >= 2, `there's room for the main lot to grow (${room} sections)`);
  const site = await g.ev(`(() => { const b = lotReserve()[room - 1]; return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }; })()`.replace('room', room));
  const cafe = await g.ev(`(() => { const v = evalBuilding('cafe', ${site.x}, ${site.z}, 0, false); return { ok: !v.problems.length, warn: v.lotWarn }; })()`);
  assert(cafe.ok && cafe.warn, 'a café on the expansion ground can be built, with a warning');
  await g.ev(`(() => { setTool('bld'); draft.btype = 'cafe'; draft.bpos = { x: ${site.x}, z: ${site.z} }; recomputeBldDraft(); renderSheet(); })()`);
  assert(/where the main lot grows/.test(await g.ev(`$('sheet').innerText`)), 'the build panel says so');
  eq(await g.ev(`reserveGroup.children.length`), room, 'and the expansion ground is marked out');
  await g.ev(`buildBuildingDraft(); setTool('explore')`); await g.wait(100);
  eq(await g.ev(`reserveGroup.children.length`), 0, 'the marks go away with the build tools');
  // grow the main lot until the café is in the way: no fixed limit
  await g.ev(`openManage('blds')`); await g.wait(100);
  for (let i = 0; i < room + 2; i++) { await g.ev(`(() => { const b = $('sheet').querySelector('[data-action=expandLot]'); if (b) b.click(); })()`); await g.wait(100); }
  const n = await g.ev(`state.lotSections`);
  assert(n <= room, `the main lot stops before the café (${n})`);
  const why = await g.ev(`mainLotBlock() || ''`);
  if (n === room) assert(/Café is where the main lot grows next/.test(why), `and says what's in the way: ${why}`);
  else assert(why, 'and says why it can’t grow');
  // a satellite lot beside the road
  const spot = await g.ev(`(() => { for (const p of ROAD_WORLD) for (const off of [-6, 6]) for (let t = 0; t < 1; t += 0.25) {
      const q = { x: p.x, z: p.z + off * 1.5 }; const sn = snapToRoad('parking', q); const v = evalBuilding('parking', sn.x, sn.z, sn.rot, false);
      if (!v.problems.length && !validateBuilding('parking', 1, sn.x, sn.z, sn.rot).problems.length) return sn; } return null; })()`);
  assert(spot, 'found a spot beside the road');
  const before = await g.ev(`stalls.length`);
  await g.ev(`(() => { const s = ${JSON.stringify(spot)}; const v = evalBuilding('parking', s.x, s.z, s.rot, false); commitBuilding(v, 'parking', s.x, s.z, s.rot); computeNetwork(); syncLabels(); })()`);
  eq(await g.ev(`stalls.length`) - before, 96, 'the satellite adds 96 spaces');
  eq(await g.ev(`lotCapacity()`), n * 96 + 96, 'capacity counts it');
  // levelled to the road where the driveway meets it, with the bank in front graded
  const lvl = await g.ev(`(() => { const B = world.buildings.find((b) => b.type === 'parking'), Q = drivewayQuad(B), at = (p) => sampleGrid(HT, p.x + HALF, p.z + HALF);
    const mid = toWorld(B, 0, BAY_FRONT.parking + 0.6); return { ramp: B.ramp, pad: B.padY, road: (at(Q.es[0]) + at(Q.es[1])) / 2, front: at(mid) }; })()`);
  eq(lvl.ramp, 1, 'the satellite is levelled and banked');
  assert(Math.abs(lvl.front - lvl.pad) < 0.4 && Math.abs(lvl.road - lvl.pad) < 1.2, `its front meets the road smoothly (${JSON.stringify(lvl)})`);
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
  // it upgrades to two sections overnight
  await g.ev(`(() => { if (state.phase === 'report') nextDay(); })()`);
  await g.ev(`select({ kind: 'bld', obj: world.buildings.find((b) => b.type === 'parking') })`); await g.wait(100);
  assert(/Upgrade to 192 spaces/.test(await g.ev(`$('sheet').innerText`)), 'the panel offers 192 spaces');
  const cap0 = await g.ev(`lotCapacity()`);
  await g.click('[data-action=upgrade]'); await g.wait(100);
  eq(await g.ev(`lotCapacity()`) - cap0, 96, 'the upgrade adds 96 spaces: ' + await g.ev(`$('toast').textContent`));
  eq(await g.ev(`stalls.filter((s) => s.sat).length`), 192, 'with stalls for them');
  // older resorts keep a bigger main lot
  await g.ev(`(() => { select(null); state.lotSections = 6; buildLot(); saveNow(); })()`);
  await g.page.reload(); await g.reloaded();
  eq(await g.ev(`state.lotSections`), 6, 'a six-section lot is kept');
  eq(await g.ev(`stalls.filter((s) => !s.sat).length`), 576, 'with all its spaces');
  eq(await g.ev(`world.buildings.filter((b) => b.type === 'parking').length`), 1, 'the satellite is saved');
  // a lot saved before banks were graded gets levelled to the road when it loads
  await g.ev(`(() => { const k = Object.keys(localStorage).find((k) => { try { return JSON.parse(localStorage.getItem(k)).world.buildings.some((b) => b.type === 'parking'); } catch (e) { return false; } });
    const sv = JSON.parse(localStorage.getItem(k)); for (const b of sv.world.buildings) { delete b.ramp; delete b.padY; } localStorage.setItem(k, JSON.stringify(sv)); })()`);
  await g.page.reload(); await g.reloaded();
  eq(await g.ev(`world.buildings.find((b) => b.type === 'parking').ramp`), 1, 'an older lot is levelled on load');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
