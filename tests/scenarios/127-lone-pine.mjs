// Lone Pine Hill: a lone hill in the middle, and two roads out of a town off the west side: one to the main lot on
// the sunny south side, one round to a north lot. North cars drive the first road as far as the fork, then the
// second; the town's land isn't for sale.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  // featured on the title screen: a large card with a thank-you, and a way straight in
  const f = await g.ev(`({ shown: !$('featMtn').hidden, pill: !$('newMtn').hidden, text: $('featMtn').innerText, painted: !!$('featMtn').querySelector('img[src="lone-pine-hill.jpg"]') })`);
  assert(f.shown && !f.pill && f.painted, 'a large feature card, with its picture, instead of the small new-mountain pill');
  assert(/Lone Pine Hill/i.test(f.text) && /first 3D mountain/i.test(f.text) && /Thank you/.test(f.text), `the card names it and thanks players: ${f.text}`);
  await g.click('[data-slot=new]'); await g.wait(100);
  assert(/Lone Pine Hill/i.test(await g.ev(`$('titleSlots').innerText`)) && await g.ev(`$('featMtn').hidden`), 'picker lists Lone Pine Hill, and the feature card steps aside');
  await g.click('[data-slot=pickNo]'); await g.wait(100);
  await g.click('#featMtn [data-feat=pick]'); await g.reloaded();
  const m = await g.ev(`({ id: MOUNTAIN.id, cash: state.cash, vert: ft(MOUNTAIN.summitH) - ft(MOUNTAIN.baseH), goals: goalList().map((G) => G.id),
    lots: lotCount(), names: [lotName(0), lotName(1)], town: !!townMesh, w2: PARCELS.some((p) => p.id === 'W2'), parcels: PARCELS.length,
    summitZ: PLAY1 - LONE_S[1] * PN - HALF, main: lotSite(0), north: lotSite(1), branch: branchPath().length,
    // the two roads share the stretch through town, then part at the fork
    shared: BRANCH_WORLD.findIndex((p, i) => p !== ROAD_WORLD[i]), branchOnGround: branchPath().slice(0, -1).every((p) => roadDist(p.x, p.z) < 0.6) })`);
  eq([m.id, m.cash], ['lonepine', 2300000], 'Lone Pine Hill with its starting cash');
  assert(m.vert > 400 && m.vert < 800, `a gentle hill (${m.vert} ft vertical)`);
  eq(m.goals, ['firstDay', 'bothSides', 'mix', 'crowd400', 'profit'], 'its own goals');
  eq([m.lots, m.names], [2, ['Main lot', 'North lot']], 'a main lot and a north lot');
  assert(m.main.z > m.summitZ + 50 && m.north.z < m.summitZ - 40, `main lot south of the summit, north lot north of it (${m.main.z.toFixed(0)}, ${m.north.z.toFixed(0)}, summit ${m.summitZ.toFixed(0)})`);
  assert(m.branch > 100 && m.shared > 3 && m.branchOnGround, `a second road, forking off the first in town (${m.shared} points shared)`);
  assert(m.town && !m.w2 && m.parcels === 23, 'a town off the west side, where no land is for sale');
  // the north lot: room for two sections and a row behind, and its cars take the second road
  const n = await g.ev(`(() => {
    const clear = [slotBox(0, 0, 1), slotBox(0, 1, 1), slotBox(0, 2, 1)].map(lotLandBlock);
    state.lotLayout = [[0, 0, 0], [0, 0, 1]]; state.lotSections = 2; buildLot();
    const i = stalls.findIndex((s) => s.lot === 1), p = carPath(stalls[i]), last = p[p.length - 1];
    const fork = ROAD_WORLD[BRANCH_WORLD.findIndex((q, k) => q !== ROAD_WORLD[k]) - 1];
    return { clear, north: stalls.filter((s) => s.lot === 1).length, start: p[0] === ROAD_WORLD[0], viaFork: p.includes(fork), ends: Math.hypot(last.x - stalls[i].x, last.z - stalls[i].z) < 0.01,
      offMain: !p.includes(ROAD_WORLD[ROAD_WORLD.length - 1]), behind: stalls[i].z < lotSite(1).z };
  })()`);
  eq(n.clear, ['', '', ''], 'room for three north lot sections on clear, level ground');
  assert(n.north === 96 && n.start && n.viaFork && n.ends && n.offMain && n.behind, `north cars drive in from town, take the fork and park behind the end of the road: ${JSON.stringify(n)}`);
  // driving between the bases goes back to the fork and out the other road
  const via = await g.ev(`(() => { const r = roadBetween(lotSite(0), lotSite(1)), fork = ROAD_WORLD[BRANCH_WORLD.findIndex((q, k) => q !== ROAD_WORLD[k]) - 1];
    return { fork: r.includes(fork), town: r.some((p) => p.x < fork.x - 1), starts: Math.hypot(r[0].x - lotSite(0).x, r[0].z - lotSite(0).z) < 1 }; })()`);
  eq(via, { fork: true, town: false, starts: true }, 'the shuttle route turns at the fork, without a trip out of town');
  eq(await g.ev(`[baseOf(lotSite(0)), baseOf(lotSite(1)), baseOf({ x: -8, z: 62 })]`), [0, 1, 0], 'each side of the hill is its own base');
  // a starter resort on the sunny side: a chair from the south base to near the top, a green, a blue and a lodge
  await g.click('#startBtn'); await g.wait(400);
  const built = await g.ev(`(() => {
    state.lotLayout = [[0, 0, 0]]; state.lotSections = 1; buildLot();
    const i = evalLift({x:-8,z:62},{x:4,z:-6},'double'); if (i.problems.length) throw new Error('lift: ' + i.problems); commitLift(i,'double'); computeNetwork();
    const L = world.lifts[0];
    for (const w of [[[1,-4],[-5,6],[-3,23],[-14,32],[-31,48],[-13,64]], [[7,-4],[12,10],[10,30],[0,50],[-4,64]]]) {
      const pts = w.map(([x,z]) => ({x, z, y: heightAt(x,z)})), t = evalTrail(pts, 'wide');
      if (t.an.problems.length) throw new Error('trail: ' + t.an.problems); commitTrail(t, pts, 'wide'); computeNetwork();
    }
    let lodge = null;
    for (const [x, z] of [[6,64],[-20,60],[8,58],[4,70],[-30,62]]) for (const r of [0, Math.PI / 2]) { if (lodge) break; const b = evalBuilding('lodge', x, z, r); if (!b.problems.length) { commitBuilding(b, 'lodge', x, z, r); lodge = [x, z]; } }
    if (!lodge) throw new Error('no lodge spot');
    computeNetwork(); syncLabels();
    return { fromBase: L.fromBase, ratings: world.trails.map(trailSign), north: loneNorth(L.a) };
  })()`);
  assert(built.fromBase && !built.north, 'the lift starts in the base area on the south side');
  assert(built.ratings.includes(0), `a green from the top, winding across the sunny side (${built.ratings})`);
  await g.ev(SETUPS.midwinter);
  await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
  const r = await g.ev(`({ guests: state.lastReport.guests, goals: state.lastReport.goals })`);
  assert(r.guests > 100, `guests drove in from town (${r.guests})`);
  assert(r.goals.includes('First chair'), 'first goal on the first day');
  eq(await g.ev(`goalList().find((G) => G.id === 'bothSides').prog()`), 'Now one up the shady north side, round the back of the hill.', 'the next goal points round the back');
  await g.ev(`saveNow(); $('mTitle').onclick()`); await g.wait(500);
  assert(/Lone Pine Hill/i.test(await g.ev(`$('titleSlots').innerText`)), 'saved mountain listed as Lone Pine Hill');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
