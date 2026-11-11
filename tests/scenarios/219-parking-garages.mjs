// Parking garages (4.8): a lot with levels. Draw one in Roads › Parking with Parking garage picked, or paint one over
// some rows of a lot (the lot is cut into joined pieces); + Level and − Level on any lot. Each level adds the same
// spaces; deck spaces cost GARAGE.deck surface spaces and run cheaper; cars fill from the ground up and drive up the
// ramps; guests under the roof on a snowy day are glad of it. Saves keep the levels; old lots load as surface lots.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 2e7`);

  // 1) Drawn as a garage: two levels to start, twice the spaces, the decks priced in.
  const a = await g.ev(`(() => { openRoads('parking'); setLotKind('garage'); const c0 = state.cash, sheet = roadsToolSheet();
    const gs = roadsGestureStart({ x: -36, z: 56 }); roadsGestureMove(gs, { x: -24, z: 64 }); roadsGestureEnd(gs, { x: -24, z: 64 });
    const d = ldraft, info = d.info || parkCheck(d); if (info.problems.length) return info.problems.join('|');
    const lv0 = parkLv(d), sp0 = parkSpaces(d), cost2 = parkCost(d, null, info);
    document.querySelector('#sheet [data-action="lotLv"][data-d="1"]') ? document.querySelector('#sheet [data-action="lotLv"][data-d="1"]').click() : (ldraft.lv = 3);
    const cost3 = parkCost(ldraft, null, ldraft.info || parkCheck(ldraft)), panel = roadsToolSheet();
    commitLot(); const P = parks()[1];
    return { modeText: /draw a garage/.test(sheet), lv0, sp0, lv: parkLv(P), name: P.name, spaces: parkSpaces(P), stalls: stalls.filter((s) => s.lot === 1).length, base: parkBase(P),
      up: stalls.filter((s) => s.lot === 1 && s.f).length, order: stalls.filter((s) => s.lot === 1).map((s) => s.f || 0).every((f, k, A) => !k || f >= A[k - 1]),
      deck: cost3.add - cost2.add, spent: c0 - state.cash, add3: cost3.add, panel: /levels high/.test(panel), saved: P.lv }; })()`);
  assert(typeof a === 'object', `garage drawn (${a})`);
  eq([a.modeText, a.lv0, a.sp0, a.lv, a.name, a.spaces, a.stalls, a.up, a.order, a.panel, a.saved], [true, 2, 216, 3, 'Garage 1', 324, 324, 216, true, true, 3], 'two levels to start, a third added: 108 spaces a level, filled from the ground up');
  eq(a.deck, 108 * 781 * 4, 'a level of deck costs four surface spaces a space');
  assert(a.spent >= a.add3 && a.spent < a.add3 + 200000, `paid for the decks, plus levelling and trees (${a.spent})`);

  // 2) Cheaper to run per space; a road to it, and cars drive up the ramps to the decks and park up there.
  const b = await g.ev(`(() => { const P = parks()[1], run = parkRunOf(P), flat = parkSpaces(P) * parkRun();
    openRoads('roads'); const d = parkAt(P, -0.6, parkD(P) / 2), gs = roadsGestureStart({ x: -45, z: 76.8 });
    for (const q of [{ x: -45, z: 73 }, { x: -44, z: 69 }, { x: -42, z: 65 }, { x: d.x - 3, z: d.z }, { x: d.x + 0.6, z: d.z + 0.4 }]) roadsGestureMove(gs, q);
    roadsGestureEnd(gs, { x: d.x + 0.6, z: d.z + 0.4 }); const info = rdraft.info || roadCheck(rdraft); if (info.problems.length) return info.problems.join('|'); commitRoad();
    const top = stalls.findIndex((s) => s.lot === 1 && s.f === 2), path = carPath(stalls[top]), G = garageBase(P);
    const ys = path.filter((q) => q.y != null).map((q) => q.y), climbs = ys.every((y, k) => !k || y >= ys[k - 1] - 1e-6);
    return { cheaper: run < flat, ratio: Math.round(run / flat * 100), reached: parkReached(1), ends: Math.hypot(path.at(-1).x - stalls[top].x, path.at(-1).z - stalls[top].z) < 0.01,
      high: Math.abs(stalls[top].y - (G + 2 * GARAGE.fh + 0.1)) < 0.01, climbs, ramps: ys.length >= 3, mesh: parkGroup.children.some((m) => m.material === GARAGE_MAT) }; })()`);
  assert(typeof b === 'object', `road built (${b})`);
  eq(b, { cheaper: true, ratio: 60, reached: true, ends: true, high: true, climbs: true, ramps: true, mesh: true }, 'runs at 60% a space; cars climb the ramps to the top deck; the concrete is drawn');

  // 3) A snowy day: cars come, fill the garage from the ground up, and guests under the roof are glad of it.
  const c = await g.ev(`(() => { setTool('explore'); state.wx.days[0].snow = 4; state.wx.days[0].type = 'showers';
    const pl = opsState().plans[planFor(state.day)]; pl.lotsOff = [parks()[0].id];
    const said = [], real = thought; thought = (x, t) => { said.push(t); real(x, t); };
    openDay(); state.speed = 0; for (let k = 0; k < 40; k++) spawnCar(2);
    const mine = cars.filter((c) => stalls[c.stall].lot === 1).length, up = cars.filter((c) => stalls[c.stall].f).length; let n = 0;
    while (cars.some((c) => c.st === 'in') && n++ < 8000) simStep(0.5);
    thought = real; const parked = cars.filter((c) => c.st === 'parked').length, covered = today.covered || 0, glad = said.some((t) => /garage/.test(t));
    n = 0; while (state.phase === 'open' && n++ < 200000) simStep(1.5); if (state.phase === 'report') nextDay(); delete pl.lotsOff;
    return { mine, up, parked, covered, said: glad }; })()`);
  eq(c.mine, 40, 'with the main lot closed, every car goes to the garage');
  assert(c.up === 0, `40 carloads fit on the ground level, so none climb (${c.up})`);
  assert(c.parked >= 40 && c.covered > 0 && c.said, `they park, under cover, and say so (${JSON.stringify(c)})`);

  // 4) Paint a garage over the middle row of a three-row lot: three joined pieces, the entrance kept, only the decks paid for.
  const d = await g.ev(`(() => { openRoads('parking'); setLotKind('lot'); state.cash = 2e7;
    const gs = roadsGestureStart({ x: -36, z: 40 }); roadsGestureMove(gs, { x: -24, z: 48 }); roadsGestureEnd(gs, { x: -24, z: 48 });
    if (!ldraft) return 'no draft'; const info = ldraft.info || parkCheck(ldraft); if (info.problems.length) return info.problems.join('|');
    ldraft.ents = [{ s: 0, t: PK.bay * 0.5 }]; commitLot();
    const i = parks().length - 1, P = parks()[i], R = P.R, W0 = parkW(P), n = P.n, before = stalls.length, ids = parks().length;
    setLotKind('garage'); const mid = parkAt(P, W0 / 2, PK.bay * 1.5), mid2 = parkAt(P, W0 / 2 + 3, PK.bay * 1.6);
    const ps = roadsGestureStart(mid); roadsGestureMove(ps, mid2); roadsGestureEnd(ps, mid2);
    if (!cdraft) return 'no paint ' + JSON.stringify({ ps, at: parkIndexAt(mid), i, n: parks().length, phase: state.phase, ok: roadsOk(), b: lotBuildable(), tab: roadsTab(), k: lotKind(), ld: !!ldraft, R, W0 }); const rows = [cdraft.b0, cdraft.b1], cost = paintCost(), c0 = state.cash, panel = roadsToolSheet();
    commitGarageRows();
    const L = parks().slice(i), J = parkJoins().slice(i).map((x) => x.length);
    return { R, rows, n: L.length, lv: L.map(parkLv), Rs: L.map((Q) => Q.R), names: L.map((Q) => Q.name), added: stalls.length - before, spent: c0 - state.cash, cost: cost.total,
      ents: L.map((Q) => Q.ents.length), J, same: L.every((Q) => Q.n === n && Math.abs(Q.a - P.a) < 1e-9), panel: /become a garage/.test(panel), keep: L[0] === P }; })()`);
  assert(typeof d === 'object', `painted (${d})`);
  eq([d.R, d.rows, d.n, d.lv, d.Rs, d.ents, d.J, d.same, d.panel, d.keep], [3, [1, 1], 3, [1, 2, 1], [1, 1, 1], [1, 0, 0], [1, 2, 1], true, true, true], 'the middle row became a two-level garage, joined to the rows either side; the entrance stays on the first');
  eq(d.added, 2 * 18 * 1, 'one row of spaces again, on the deck');
  eq([d.spent, d.cost], [36 * 781 * 4, 36 * 781 * 4], 'paid for the deck only');
  eq(d.names[0] !== d.names[1] && d.names[1] !== d.names[2], true, `three names (${d.names})`);

  // 5) − Level back to one: a surface lot again, a quarter back on the deck. Saved and loaded; an old lot has no levels.
  const e = await g.ev(`(() => { const i = parks().findIndex((Q) => Q.name === 'Garage 1'); startLotEdit(i); ldraft.lv = 1; ldraft.info = null;
    const cost = parkCost(ldraft, ldraft.P, parkCheck(ldraft, i)); const c0 = state.cash; commitLot(); const P = parks()[i];
    const flat = { lv: parkLv(P), has: 'lv' in P, back: state.cash - c0, want: Math.round(108 * 781 * 4 * 2 * 0.25) };
    const sv = JSON.parse(JSON.stringify(saveData(false))); applySave(sv);
    const back = { levels: parks().map(parkLv), stalls: stalls.length, reached: parks().map((Q, i) => parkReached(i)).filter(Boolean).length };
    const old = JSON.parse(JSON.stringify(sv)); for (const Q of old.clock.parks) delete Q.lv; applySave(old);
    return { flat, back, old: parks().every((Q) => parkLv(Q) === 1), spaces: stalls.length }; })()`);
  eq([e.flat.lv, e.flat.has], [1, false], 'down to one level: a surface lot');
  assert(Math.abs(e.flat.back - e.flat.want) < 500, `a quarter of the decks back (${e.flat.back} vs ${e.flat.want})`);
  eq(e.back.levels.filter((l) => l > 1).length, 1, 'the painted garage is still a garage after a reload');
  eq(e.old, true, 'lots saved before garages load as surface lots');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
