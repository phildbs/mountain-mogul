// Trees, benches and picnic tables go down with one tap overnight. Planted trees draw in one batch and
// are saved; tired guests stop for a rest at benches, picnic tables and fire pits all day, without
// queueing, and get some energy back.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 2e6`);

  // one tap plants a tree; keep tapping for more
  await g.ev(`(() => { setTool('bld'); draft.btype = 'tree'; renderSheet(); })()`);
  assert(/keep (tapping|clicking) to add more/.test(await g.ev(`$('sheet').innerText`)), 'the panel says each tap plants one');
  const spot = await g.ev(`(() => { for (let z = 60; z <= 72; z += 1) for (let x = -2; x <= 26; x += 1) { const v = evalBuilding('tree', x, z, 0, false); if (!v.problems.length && !v.treeSet.size) return { x, z }; } return null; })()`);
  assert(spot, 'found an open spot');
  const cash0 = await g.ev(`state.cash`);
  await g.ev(`draftTap({ x: ${spot.x}, z: ${spot.z} })`);
  eq(await g.ev(`world.buildings.filter((B) => B.type === 'tree').length`), 1, 'one tap, one tree');
  eq(await g.ev(`state.cash`), cash0 - 400, 'a tree costs $400');
  eq(await g.ev(`[state.tool, draft.btype, draft.bpos]`), ['bld', 'tree', null], 'ready for the next one');
  const spot2 = await g.ev(`(() => { for (let z = 60; z <= 74; z += 1) for (let x = -2; x <= 26; x += 1) { const v = evalBuilding('tree', x, z, 0, false); if (!v.problems.length) return { x, z }; } return null; })()`);
  await g.ev(`draftTap({ x: ${spot2.x}, z: ${spot2.z} })`);
  await g.wait(100);
  eq(await g.ev(`[world.buildings.filter((B) => B.type === 'tree').length, plantMesh && plantMesh.count]`), [2, 2], 'two trees, drawn together');
  eq(await g.ev(`(() => { const B = world.buildings.find((x) => x.type === 'tree'); return [B.padY, B.labelEl || null]; })()`), [null, null], 'no levelled pad, no label');
  // not on a trail
  const onTrail = await g.ev(`(() => { const s = realTrails()[0].samples[20]; return evalBuilding('tree', Math.round(s.x * 2) / 2, Math.round(s.z * 2) / 2, 0, false).problems.join(' '); })()`);
  assert(/overlaps/.test(onTrail), `can't plant on a trail: ${onTrail}`);
  // saved, and back after a reload of the save
  eq(await g.ev(`saveData(false).world.buildings.filter((b) => b.type === 'tree').length`), 2, 'saved');
  eq(await g.ev(`(() => { applySave(JSON.parse(JSON.stringify(saveData(false)))); syncPlanted(); return plantMesh.count; })()`), 2, 'reloaded and drawn');
  // bulldoze takes one away
  eq(await g.ev(`DOZE_TYPES.includes('tree') && DOZE_TYPES.includes('bench') && DOZE_TYPES.includes('picnic')`), true, 'bulldozable');

  // a bench and a picnic table by the lift, a bench beside a trail
  const placed = await g.ev(`(() => {
    const place = (type, near, rmin, rmax) => { for (let r = rmin; r <= rmax; r += 0.5) for (let a = 0; a < 24; a++) { const x = Math.round((near.x + Math.cos(a / 24 * 6.283) * r) * 2) / 2, z = Math.round((near.z + Math.sin(a / 24 * 6.283) * r) * 2) / 2; const v = evalBuilding(type, x, z, 0, false); if (!v.problems.length) { commitBuilding(v, type, x, z, 0); computeNetwork(); return world.buildings[world.buildings.length - 1]; } } return null; };
    const L = world.lifts[0], T = realTrails()[0], mid = T.samples[Math.floor(T.samples.length / 2)];
    const a = place('bench', L.a, 3, 9), b = place('picnic', L.a, 4, 10), c = place('bench', mid, TRAIL_WIDTHS[T.width].hw + 1, 6);
    return { ok: !!(a && b && c), stop: T.stops.some((s) => s.B === c), pad: [a.padY, b.padY], seats: [a.seatsW.length, b.seatsW.length] }; })()`);
  eq(placed, { ok: true, stop: true, pad: [null, null], seats: [2, 6] }, 'seats placed; the trail-side bench is a stop on the way down');

  // the rest need: tired guests, now and then, all day; no queueing for a full bench
  eq(await g.ev(`(() => { state.time = 700; return [needs({ fat: 50, stam: 100, bl: 0, ate: true, leaving: false, lunchAt: 2000 }), needs({ fat: 50, stam: 100, bl: 0, ate: true, leaving: false, lunchAt: 2000, restT: 690 }), needs({ fat: 10, stam: 100, bl: 0, ate: true, leaving: false, lunchAt: 2000 })].map((n) => n.includes('rest')); })()`),
    [true, false, false], 'tired guests want a rest, not again within the hour, and not when fresh');
  eq(await g.ev(`offers(world.buildings.find((B) => B.type === 'picnic')).concat(OFFERS.firepit)`), ['rest', 'warm', 'rest'], 'picnic tables and fire pits offer a rest');
  eq(await g.ev(`(() => { const B = world.buildings.find((x) => x.type === 'bench'); B.used.seat = poolSlots(B, 'seat'); const v = bestVisit({ fat: 50, stam: 100, qh: 0.5 }, B.door, 5, false, [B], ['rest']); B.used.seat = 0; return v; })()`), null, 'nobody queues for a full bench');

  // a real day: rests happen across the day, they're free, and they give energy back
  await g.ev(`(() => { select(null); setTool('explore'); openDay(); window.__r = []; const sv = serve; serve = (gg, B) => { if (gg.svc === 'rest') window.__r.push({ t: state.time, fat: gg.fat, stam: gg.stam, gid: gg.id, B: B.type }); return sv(gg, B); }; })()`);
  await g.ev(SETUPS.finishDay);
  const r = await g.ev(`window.__r`);
  const hours = new Set(r.map((x) => Math.floor(x.t / 60)));
  assert(r.length > 60 && hours.size >= 5, `rests all day: ${r.length} over ${hours.size} hours`);
  assert(['bench', 'picnic'].every((t) => r.some((x) => x.B === t)), 'benches and the picnic table both used');
  eq(await g.ev(`(() => { const g2 = { th: [], fat: 60, stam: 100, sat: 50, svc: 'rest', bid: world.buildings.find((B) => B.type === 'picnic').id, deck: -1, family: false, resume: { k: 'base' } }; const B = bldById(g2.bid); B.used.seat++; finishVisit(g2); return [Math.round(g2.fat), g2.restT === state.time]; })()`), [46, true], 'a rest at a picnic table gives energy back');
  eq(await g.ev(`state.lastReport.rev.food >= 0 && world.buildings.filter((B) => ['bench', 'picnic'].includes(B.type)).every((B) => B.today.revenue === 0)`), true, 'and costs guests nothing');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
