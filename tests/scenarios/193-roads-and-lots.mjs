// Your own lots and roads (3.16): place a parking lot anywhere on your land, then draw a road from the access road
// to its entrance. A lot with no road takes no cars; once a road reaches it, cars drive the access road, turn off
// at the junction and park there. Your lots are parking for the nearest base, never a second base.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 2e7`);

  // 1) Place a lot west of the base, away from the road.
  const a = await g.ev(`(() => { const c0 = state.cash; openPlotTool(); plotTap({ x: -30, z: 60 });
    const i = plotDraft.info; if (i.problems.length) return i.problems.join('|');
    const sheet = plotToolSheet(); buildPlot();
    return { tool: state.tool, lots: lotCount(), bases: baseCount(), mine: isPlot(1), spaces: stalls.filter((s) => s.lot === 1).length, reached: plotReached(1),
      cost: c0 - state.cash, name: lotName(1), sheet: /Turn it round/.test(sheet), cars: lotScores(1)[1] }; })()`);
  assert(typeof a === 'object', `lot placed (${a})`);
  eq([a.tool, a.lots, a.bases, a.mine, a.spaces, a.reached, a.cost, a.name, a.sheet], ['explore', 2, 1, true, 96, false, 75000, 'Lot 2', true], 'a 96-space lot, still one base, no road to it yet');
  eq(a.cars, -1, 'a lot no road reaches takes no cars');
  eq(await g.ev(`/No road to it/.test(parkingPanel()) && /Your lots and roads/.test(parkingPanel())`), true, 'the parking panel says it needs a road');

  // 2) A road that can't be built: straight up the mountain is too steep.
  const steep = await g.ev(`(() => { openRoadTool(); roadTap({ x: -12, z: 72 }); roadTap({ x: -12, z: 50 }); roadTap({ x: -12, z: 20 });
    const p = roadDraft.info.problems; closeRoadTool(); return p; })()`);
  assert(steep.some((m) => /Too steep|in the way|Too close/.test(m)), `a road straight up the mountain is refused: ${steep}`);

  // 3) Draw a road from the access road to the lot's entrance.
  const r = await g.ev(`(() => { const c0 = state.cash, P = state.plots[0]; openRoadTool();
    roadTap({ x: -45, z: 76.5 }); const start = roadDraft.pts[0];
    roadTap({ x: -45, z: 62 }); roadTap({ x: P.x + 0.4, z: P.z + 0.3 }); // near enough the entrance: it snaps on
    const i = roadDraft.info; if (i.problems.length) return i.problems.join('|');
    const sheet = roadToolSheet(), end = roadDraft.pts.at(-1);
    buildRoadDraft();
    const R = state.proads[0], s = lotSite(1), k = stalls.findIndex((x) => x.lot === 1), p = carPath(stalls[k]);
    return { onRoad: mapRoadDist(start[0], start[1]) < 0.3, snapped: end[0] === P.x && end[1] === P.z, reaches: /reaches <b>Lot 2/.test(sheet),
      roads: state.proads.length, reached: plotReached(1), from: s.route[0] === ROAD_WORLD[0], ends: Math.hypot(p.at(-1).x - stalls[k].x, p.at(-1).z - stalls[k].z) < 0.01,
      spent: c0 - state.cash, build: R.cost, clear: (window.__q = proadPath(R)[8], roadDist(__q.x, __q.z) < 0.8), plow: planCosts(opsState().plans.weekday).parking, lots: roadLots(R), sel: selected && selected.obj }; })()`);
  assert(typeof r === 'object', `road built (${r})`);
  eq([r.onRoad, r.snapped, r.reaches, r.roads, r.reached, r.from, r.ends, r.clear, r.lots, r.sel], [true, true, true, 1, true, true, true, true, ['Lot 2'], 'parking'], 'the road leaves the access road and ends at the entrance; the lot is reached');
  assert(r.build > 20000 && r.spent >= r.build, `it cost its length (${r.build}, ${r.spent} with trees)`);

  // 4) Nothing can be built on it, and it can't go while the lot needs it.
  const b = await g.ev(`(() => { const R = state.proads[0], q = proadPath(R)[Math.floor(proadPath(R).length / 2)];
    const bl = evalBuilding('restroom', q.x, q.z, 0).problems, cell = cellProblem(Math.round(q.x), Math.round(q.z), new Map());
    select(pickFeature({ x: q.x + 0.3, z: q.z })); const sh = proadSheet(R);
    return { bl, cell, picked: selected && selected.kind, needs: roadNeeds(R), remove: /Remove the road/.test(sh) }; })()`);
  assert(b.bl.some((m) => /your roads/.test(m)), `no building on it: ${b.bl}`);
  eq([b.cell, b.picked, b.needs, b.remove], ['on the road', 'proad', ['Lot 2 would have no way in'], false], 'it keeps guest areas off, can be picked, and stays while the lot needs it');

  // 5) Cars come in along it and park in the new lot.
  const d = await g.ev(`(() => { select(null); openDay(); state.speed = 0; const real = lotScores; lotScores = () => [0, 1];
    for (let k = 0; k < 6; k++) spawnCar(2); lotScores = real;
    const mine = cars.filter((c) => stalls[c.stall].lot === 1).length; let n = 0;
    while (cars.some((c) => c.st === 'in') && n++ < 4000) simStep(0.5);
    return { mine, parked: cars.filter((c) => c.st === 'parked' && stalls[c.stall].lot === 1).length, guests: guests.length }; })()`);
  eq(d.mine, 6, 'six cars headed for the new lot');
  assert(d.parked >= 6, `and parked there, with more of the day's cars (${d.parked})`);
  assert(d.guests >= 6, `their guests got out (${d.guests})`);
  await g.ev(`(() => { let n = 0; while (state.phase === 'open' && n++ < 200000) simStep(1.5); if (state.phase === 'report') nextDay(); return state.phase; })()`);

  // 6) Saved and loaded back with the lot and the road.
  const s = await g.ev(`(() => { const sv = JSON.parse(JSON.stringify(saveData(false))); applySave(sv);
    return { plots: state.plots.length, roads: state.proads.length, reached: plotReached(1), mesh: proadMeshes.length, grid: roadDist(__q.x, __q.z) < 0.8, spaces: stalls.filter((x) => x.lot === 1).length }; })()`);
  eq(s, { plots: 1, roads: 1, reached: true, mesh: 1, grid: true, spaces: 96 }, 'saved and loaded');

  // 7) Grow it longer, then remove it and the road.
  const e = await g.ev(`(() => { const w = lotGrowBlock(0, 1); if (w) return w; growLot(0, 1); const grown = lotSize(1);
    const c0 = state.cash; removePlot(1); const R = state.proads[0], needs = roadNeeds(R); removeRoad(R);
    return { grown, lots: lotCount(), sections: state.lotSections, back: state.cash - c0, needs, roads: proads().length, grid: roadDist(__q.x, __q.z) > 3 }; })()`);
  assert(typeof e === 'object', `the lot grows (${e})`);
  eq([e.grown, e.lots, e.sections, e.needs, e.roads, e.grid], [2, 1, 1, [], 0, true], 'grew to two sections, then the lot and the road went');
  assert(e.back > 37000, `a quarter back on the lot and the road (${e.back})`);
  // and undo brings the road back
  eq(await g.ev(`(() => { undoLast(); return [proads().length, plots().length]; })()`), [1, 0], 'undo puts the road back');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
