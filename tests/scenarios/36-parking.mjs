// The main lot grows section by section as far as the land allows, warning anyone who builds in its way.
// When it's full, cars go to off-site parking and parking shuttles carry guests between it and the
// stations; old satellite lots become off-site parking, and bigger old main lots are kept.
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
  const cafeName = await g.ev(`world.buildings.find((b) => b.type === 'cafe').name`);
  if (n === room) assert(why.startsWith(`${cafeName} is where the main lot grows next`), `and says what's in the way: ${why}`);
  else assert(why, 'and says why it can’t grow');
  // off-site parking: set up from the Buildings list, it needs a shuttle station to work
  await g.ev(`(() => { select(null); openManage('blds'); })()`); await g.wait(100);
  assert(/Off-site parking/.test(await g.ev(`$('sheet').innerText`)) && /Not set up/i.test(await g.ev(`$('sheet').innerText`)), 'the Buildings list offers off-site parking');
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
  // a shuttle station upgrades to a transit center with two bays
  const st = await g.ev(`world.buildings.find(isStation).id`);
  await g.ev(`select({ kind: 'bld', obj: bldById(${st}) })`); await g.wait(100);
  assert(/transit center/i.test(await g.ev(`$('sheet').innerText`)), 'the station offers the transit center upgrade');
  await g.ev(`state.cash = 5e6`); await g.click('[data-action=upgradeStation]'); await g.wait(100);
  const up = await g.ev(`bldById(${st}).type + ' ' + $('toast').textContent`);
  assert(/^transit/.test(up) || /Can’t upgrade/.test(up), `the upgrade runs or explains itself (${up})`);
  // older resorts keep a bigger main lot
  await g.ev(`(() => { select(null); state.lotSections = 6; buildLot(); saveNow(); })()`);
  await g.page.reload(); await g.reloaded();
  eq(await g.ev(`state.lotSections`), 6, 'a six-section lot is kept');
  eq(await g.ev(`stalls.length`), 576, 'with all its spaces');
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
