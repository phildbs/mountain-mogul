// Learning areas and surface lifts: paint an area, serve it with a magic carpet, first-timers learn there,
// it survives a reload, and a T-bar runs in wind that holds chairlifts.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 5e6`);
  // paint, with steep ground and the lodge left out
  const painted = await g.ev(`(() => { setTool('clear'); state.landMode = 'area'; state.brushR = 3.6;
    for (let z = 56; z >= 40; z -= 2) for (const x of [-12, -8, -4, -1]) areaPaintAt({ x, z });
    const info = areaDraftInfo(), cash = state.cash; commitArea();
    return { n: info.n, cost: info.cost, spent: cash - state.cash, areas: world.areas.length, onLodge: !!areaAt(world.buildings[0].x, world.buildings[0].z) }; })()`);
  assert(painted.n > 100 && painted.areas === 1, `an area was painted and built (${painted.n} cells)`);
  eq(painted.spent, painted.cost, 'building the area costs what the panel said');
  eq(painted.onLodge, false, 'the lodge is left out of the area');
  // surface lift limits
  const tooLong = await g.ev(`evalLift({ x: -6, z: 56 }, { x: -7, z: 20 }, 'carpet').problems.join(' ')`);
  assert(/Too long|Too steep/.test(tooLong), `a magic carpet can't run far up the hill (${tooLong})`);
  const net = await g.ev(`(() => { const i = evalLift({ x: -6, z: 54 }, { x: -7, z: 44 }, 'carpet'); if (i.problems.length) return i.problems.join('|');
    commitLift(i, 'carpet'); computeNetwork(); syncLabels(); setTool('explore');
    const v = world.trails.filter((t) => t.virtual);
    return { lines: v.length, ok: v.every((t) => t.reachable && t.returns && trailSign(t) === 0), real: realTrails().length, labels: v.some((t) => t.labelEl), list: /Bunny Hill/.test(trailsList()) }; })()`);
  eq([net.lines, net.ok, net.real, net.labels, net.list], [4, true, 2, false, false], 'the carpet gives the area four green ski lines, hidden from the trail list and labels');
  // a day: first-timers lap the learning area instead of struggling on the trails
  await g.ev(`state.day = 40; openDay()`); await g.ev(SETUPS.finishDay);
  const r = await g.ev(`(() => { const r = state.lastReport; return { firsts: r.firsts, learners: r.learners, noLearn: r.complaints.noLearn, text: $('rpBody').textContent }; })()`);
  assert(r.firsts > 0 && r.learners > 0, `first-timers came and learned (${r.firsts}, ${r.learners})`);
  assert(r.noLearn <= r.firsts * 0.25, `few first-timers ended up on real trails (${r.noLearn} of ${r.firsts})`);
  assert(/first-timers came today/.test(r.text), 'the report mentions first-timers');
  await g.click('#rpNext'); await g.wait(200);
  // reload: the area and its lines come back
  await g.ev(`saveNow()`); await g.page.reload(); await g.reloaded();
  await g.ev(`$('startBtn').click()`); await g.wait(400);
  eq(await g.ev(`[world.areas.length, world.areas[0].name, world.trails.filter((t) => t.virtual).length]`), [1, 'Bunny Hill', 4], 'the area and its lines survive a reload');
  // a T-bar keeps running in wind that holds exposed chairs
  const tb = await g.ev(`(() => { state.cash = 5e6; const i = evalLift({ x: -24, z: 56 }, { x: -26, z: 26 }, 'tbar'); if (i.problems.length) return i.problems.join('|');
    commitLift(i, 'tbar'); const L = world.lifts.find((l) => l.type === 'tbar'); return [windHoldAt(L, 60), windHoldAt(L, 80), liftCapacity(LIFT_TYPES.tbar), liftCapacity(LIFT_TYPES.carpet)]; })()`);
  eq(tb, [false, true, 910, 1160], 'a T-bar runs at 60 mph and stops in a gale; capacities');
  // removing the area takes its lines with it
  await g.ev(`(() => { select({ kind: 'area', obj: world.areas[0] }); })()`);
  await g.click('[data-action=remove]'); await g.click('[data-action=removeYes]');
  eq(await g.ev(`[world.areas.length, world.trails.filter((t) => t.virtual).length]`), [0, 0], 'removing the area removes its lines');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
