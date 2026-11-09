// Roads, parking and transit (3.16): lots are rectangles of any size at any angle, drawn by dragging in the Roads tool,
// joined edge to edge, with entrances on any edge; roads are painted off the access road (or an older road of yours)
// and bring cars to a lot's entrance; the access road can be rerouted inside your land. Old saves' lots become the same
// lots in the same place. Your lots park guests for the nearest base, and can all be removed.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);

  // 1) A new resort's main lot is a lot like any other: same spaces, same place, entered where the road ends.
  const m = await g.ev(`(() => { const P = parks()[0], d = gateDoor(P, P.ents[0]), e = roadEnd();
    return { n: parks().length, name: P.name, spaces: stalls.length, reached: parkReached(0), door: Math.hypot(d.x - e.x, d.z - e.z) < 1.5, bases: baseCount(), sections: state.lotSections }; })()`);
  eq(m, { n: 1, name: 'Main lot', spaces: 96, reached: true, door: true, bases: 1, sections: 1 }, 'the starting lot: 96 spaces at the end of the road');

  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 2e7`);

  // 2) Draw a lot by dragging: it lines up with the road, and its size snaps to whole spaces and aisles.
  const a = await g.ev(`(() => { openRoads('parking'); const c0 = state.cash;
    const gs = roadsGestureStart({ x: -36, z: 56 }); roadsGestureMove(gs, { x: -24, z: 64 }); roadsGestureEnd(gs, { x: -24, z: 64 });
    const d = ldraft, info = d.info || parkCheck(d), sheet = roadsToolSheet();
    if (info.problems.length) return info.problems.join('|');
    const h = roadHit({ x: -36, z: 56 }), Q = h.R || h.P, ra = Math.atan2(Q[h.k + 1].z - Q[h.k].z, Q[h.k + 1].x - Q[h.k].x);
    commitLot();
    return { lots: parks().length, spaces: parkSpaces(parks()[1]), n: parks()[1].n, R: parks()[1].R, lined: Math.abs(Math.sin(parks()[1].a - ra)) < 0.01, ents: parks()[1].ents.length,
      reached: parkReached(1), cost: c0 - state.cash, sheet: /spaces/.test(sheet) && /Build/.test(sheet), tool: state.tool }; })()`);
  assert(typeof a === 'object', `lot drawn (${a})`);
  eq([a.lots, a.n, a.R, a.spaces, a.lined, a.ents, a.reached, a.sheet, a.tool], [2, 18, 3, 108, true, 0, false, true, 'roads'], 'an 18 by 3 lot, lined up with the road; no road to it yet, so no entrance yet');
  assert(a.cost >= 108 * PARK_SPACE_C && a.cost < 108 * PARK_SPACE_C + 200000, `priced by the space, plus levelling and trees (${a.cost})`);
  eq(await g.ev(`lotScores(1)[1]`), -1, 'no cars for a lot no road reaches');

  // 3) A second lot drawn against its far side joins it: cars get to it through the first.
  const j = await g.ev(`(() => { const P = parks()[1], far = parkAt(P, parkW(P) / 2, parkD(P) + 0.5);
    const gs = roadsGestureStart(far); roadsGestureMove(gs, { x: far.x + 4, z: far.z + 6 }); roadsGestureEnd(gs, { x: far.x + 4, z: far.z + 6 });
    const same = Math.abs(ldraft.a - P.a) < 1e-6, ents = ldraft.ents.length; commitLot();
    return { same, ents, joins: parkJoins().map((J) => J.length) }; })()`);
  eq(j, { same: true, ents: 0, joins: [0, 1, 1] }, 'drawn against a lot: the same angle, no entrance of its own, joined to it');

  // 4) Paint a road from the access road to the first lot's entrance.
  const r = await g.ev(`(() => { openRoads('roads'); const P = parks()[1], d = parkAt(P, -0.6, parkD(P) / 2), c0 = state.cash; // to the middle of its near end
    const gs = roadsGestureStart({ x: -45, z: 76.8 });
    for (const q of [{ x: -45, z: 73 }, { x: -44, z: 69 }, { x: -42, z: 65 }, { x: d.x - 3, z: d.z }, { x: d.x + 0.6, z: d.z + 0.4 }]) roadsGestureMove(gs, q);
    roadsGestureEnd(gs, { x: d.x + 0.6, z: d.z + 0.4 });
    const pts = rdraft.pts.length, end = rdraft.pts.at(-1), info = rdraft.info || roadCheck(rdraft), door = gateDoor(P, rdraft.gate.g);
    if (info.problems.length) return info.problems.join('|');
    commitRoad();
    const R = proads()[0], k = stalls.findIndex((s) => s.lot === 2), p = carPath(stalls[k]);
    return { simplified: pts < 8, snapped: Math.hypot(end[0] - door.x, end[1] - door.z) < 0.02 && P.ents.length === 1 && P.ents[0].s === 0, roads: proads().length, reached: parks().map((Q, i) => parkReached(i)),
      from: p[0] === ROAD_WORLD[0], ends: Math.hypot(p.at(-1).x - stalls[k].x, p.at(-1).z - stalls[k].z) < 0.01, spent: c0 - state.cash, kind: R.kind,
      grid: roadDist(proadPath(R)[10].x, proadPath(R)[10].z) < 0.8, leads: roadLots(R) }; })()`);
  assert(typeof r === 'object', `road built (${r})`);
  eq([r.simplified, r.snapped, r.roads, r.reached, r.from, r.ends, r.kind, r.grid], [true, true, 1, [true, true, true], true, true, 'road', true], 'painted to the end of the lot: an entrance there, both lots reached, cars drive in from the map edge to their space');
  assert(r.spent > 20000, `it cost its length (${r.spent})`);

  // 5) Nothing is built on roads or lots; a road straight up the mountain is too steep.
  const b = await g.ev(`(() => { const R = proads()[0], q = proadPath(R)[Math.floor(proadPath(R).length / 2)], P = parks()[1];
    const onRoad = evalBuilding('restroom', q.x, q.z, 0).problems, onLot = evalBuilding('restroom', P.x, P.z, 0).problems, cell = cellProblem(Math.round(q.x), Math.round(q.z), new Map());
    rdraft = { R: null, kind: 'road', pts: [[-12, 71.9], [-12, 50], [-12, 20]] }; const steep = roadCheck(rdraft).problems; clearRDraft();
    return { onRoad, onLot, cell, steep, picked: pickFeature({ x: q.x + 0.3, z: q.z }).kind, lot: pickFeature({ x: P.x, z: P.z }).kind }; })()`);
  assert(b.onRoad.some((m) => /your roads/.test(m)), `no building on a road: ${b.onRoad}`);
  assert(b.onLot.some((m) => /parking lot/.test(m)), `no building on a lot: ${b.onLot}`);
  assert(b.steep.some((m) => /steep|in the way|Too close/.test(m)), `straight up the mountain is refused: ${b.steep}`);
  eq([b.cell, b.picked, b.lot], ['on the road', 'proad', 'lot'], 'areas keep off; roads and lots can be tapped');

  // 6) Cars drive in and park, and a lot closed in Operations takes none that day.
  const d = await g.ev(`(() => { setTool('explore'); const P = opsState().plans[planFor(state.day)]; P.lotsOff = [parks()[0].id];
    openDay(); state.speed = 0; const real = lotScores; lotScores = () => [5, 0, 1]; for (let k = 0; k < 8; k++) spawnCar(2); lotScores = real;
    const inMain = cars.filter((c) => stalls[c.stall].lot === 0).length, mine = cars.filter((c) => stalls[c.stall].lot > 0).length; let n = 0;
    while (cars.some((c) => c.st === 'in') && n++ < 6000) simStep(0.5);
    const parked = cars.filter((c) => c.st === 'parked' && stalls[c.stall].lot > 0).length, cost = planCosts(P).parking;
    n = 0; while (state.phase === 'open' && n++ < 200000) simStep(1.5); if (state.phase === 'report') nextDay(); delete P.lotsOff;
    return { inMain, mine, parked, cost, after: planCosts(P).parking }; })()`);
  eq([d.inMain, d.mine], [0, 8], 'the closed main lot takes no cars; they go to your lots');
  assert(d.parked >= 8, `and park there (${d.parked})`);
  assert(d.after > d.cost, `an open lot costs more to run than a closed one (${d.cost} → ${d.after})`);

  // 7) Reroute the access road inside the property: only points on your land move, and the road follows.
  const e = await g.ev(`(() => { startRoadEdit(MAIN_ROAD); const base = rdraft.pts.map((p) => p.slice()); let k = -1, dz = 0, was = null, info = null;
    for (const i of base.map((p, i) => i).filter((i) => !isFixed(base[i]) && i < base.length - 1)) for (const d of [2, -2]) { // a bend two units up or down the hill, wherever it's clear
      if (k >= 0) break; rdraft.pts = base.map((p) => p.slice()); rdraft.pts[i] = [base[i][0], base[i][1] + d]; rdraft.info = null; const c = roadCheck(rdraft); if (!c.problems.length) { k = i; dz = d; was = base[i]; info = c; } }
    if (k < 0) return 'no clear bend'; window.__dz = dz;
    if (info.problems.length) return info.problems.join('|');
    commitRoad(); return { saved: !!state.mainRoad, moved: Math.abs(state.mainRoad[k][1] - was[1] - dz) < 0.01, fixed: state.mainRoad.every((p, i) => i === k || Math.hypot(p[0] - mainCtrl0()[i][0], p[1] - mainCtrl0()[i][1]) < 0.01),
      reached: parks().map((Q, i) => parkReached(i)), grid: mapRoadDist(was[0], was[1] + dz) < 1 }; })()`);
  assert(typeof e === 'object', `rerouted (${e})`);
  eq(e, { saved: true, moved: true, fixed: true, reached: [true, true, true], grid: true }, 'the access road moved inside the property, its other points stayed, every lot still reached');

  // 8) Saved and loaded back; an old save's sections become lots; removing every lot is allowed.
  const s = await g.ev(`(() => { const sv = JSON.parse(JSON.stringify(saveData(false))); applySave(sv);
    const back = { lots: parks().length, roads: proads().length, main: !!state.mainRoad, reached: parks().map((Q, i) => parkReached(i)), spaces: stalls.length };
    const old = JSON.parse(JSON.stringify(sv)); delete old.clock.parks; delete old.clock.proads; delete old.clock.mainRoad; old.clock.lotSections = 3; old.clock.lotLayout = [[0, 0], [0, 1], [1, 0]];
    old.clock.ops = { plans: { weekday: { lots: 2 } } }; applySave(old);
    const conv = { lots: parks().length, spaces: stalls.length, reached: parks().map((Q, i) => parkReached(i)), joins: parkJoins().map((J) => J.length), off: (state.ops.plans.weekday.lotsOff || []).length };
    applySave(sv); for (const P of [...parks()]) removeLot(P);
    return { back, conv, none: [parks().length, stalls.length] }; })()`);
  eq(s.back, { lots: 3, roads: 1, main: true, reached: [true, true, true], spaces: 228 }, 'saved and loaded');
  eq([s.conv.lots, s.conv.spaces, s.conv.reached, s.conv.joins, s.conv.off], [2, 288, [true, true], [1, 1], 1], 'an old two-row main lot: two joined lots, 288 spaces, the closed section closes its row');
  eq(s.none, [0, 0], 'every lot can go');
  const t = await g.ev(`(() => { openDay(); today.turnedAway = 0; spawnCar(2); const away = today.turnedAway; let n = 0; while (state.phase === 'open' && n++ < 200000) simStep(1.5); return away; })()`);
  assert(t > 0, `with no lots, drivers are turned away (${t})`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();

  // 9) A two-base mountain keeps its bases: a lot drawn there parks guests for the nearest base.
  const w = await openGame(browser, url, { mountain: 'twin' });
  await w.click('#startBtn'); await w.wait(300);
  eq(await w.ev(`[baseCount(), lotCount(), parks()[0].name, baseOfLot(0)]`), [2, 1, 'Main lot', 0], 'Twin Notch: two bases, one lot to start');
  // and a road can bridge the creek
  const br = await w.ev(`(() => { state.cash = 2e7; let best = null;
    for (let z = -100; z <= 100 && !best; z += 3) for (let x = -100; x <= 100 && !best; x += 3) {
      if (!inProperty(x, z) || !overCreek(x, z)) continue;
      const h = roadHit({ x, z }); if (!h || h.d > 40) continue;
      const a = h.pt, L = Math.hypot(x - a.x, z - a.z), ux = (x - a.x) / L, uz = (z - a.z) / L, d = { R: null, kind: 'road', pts: [[a.x, a.z], [x - ux * 4, z - uz * 4], [x + ux * 5, z + uz * 5]] }, c = roadCheck(d);
      if (c.bridge > 0 && !c.problems.length) best = { d, c };
    }
    if (!best) return 'no crossing';
    rdraft = best.d; commitRoad(); const R = proads()[0], mid = proadPath(R).find((q) => overCreek(q.x, q.z));
    return { built: proads().length, deck: roadDecks().some((B) => B.hw === 1), above: roadY(mid.x, mid.z) > heightAt(mid.x, mid.z) + 0.1, priced: best.c.build > best.c.bridge * 8000 }; })()`);
  eq(br, { built: 1, deck: true, above: true, priced: true }, 'a road over the creek gets a bridge deck, and the bridge is priced in');
  eq(w.errors, [], 'no page errors on Twin Notch');
  await w.page.close();
}
const PARK_SPACE_C = 781;
