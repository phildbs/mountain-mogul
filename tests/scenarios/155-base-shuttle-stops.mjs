// From player feedback (Cedar Point, Ridgeback): "the guests leave hungry with prices set low and easy access".
// The base shuttle went back and forth between the same two stops while anyone was waiting, so with several
// stations at a base, guests at the others waited all day (and missed lunch). Two buses was also the most on the
// road, however long the lines got. Now an empty bus heads for the longest wait, more buses run as lines grow, and
// a long line at the stops puts guests off crossing.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
import { build } from '../twin-resort.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { mountain: 'twin' });
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(build);
  const setup = await g.ev(`(() => { state.welcomed = true; select(null); state.cash = 1e8; state.lotLayout = [[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 0, 1], [0, 1, 1], [0, 2, 1]]; state.lotSections = 6; buildLot(); state.reputation = 1.2;
    const put = (type, u0, v0, dx0) => { for (let dz = 0; dz < 16; dz += 2) for (let dx = dx0 - 10; dx <= dx0 + 10; dx += 2) { const x = 160 * u0 - 80 + dx, z = 80 - 160 * v0 - dz, v = evalBuilding(type, x, z, 0); if (!v.problems.length) { commitBuilding(v, type, x, z, 0); computeNetwork(); return world.buildings[world.buildings.length - 1]; } } return null; };
    // Two stations by the road at each base, well apart.
    const spots = [];
    for (const p of [...ROAD_WORLD, ...(BRANCH_WORLD || [])]) for (const off of [-3, 3]) {
      const sn = snapToRoad('shuttle', { x: p.x, z: p.z + off }), v = evalBuilding('shuttle', sn.x, sn.z, sn.rot, false);
      if (v.problems.length || !isBase(sn) || spots.filter((o) => baseOf(o) === baseOf(sn)).length >= 2 || spots.some((o) => Math.hypot(o.x - sn.x, o.z - sn.z) < 10)) continue;
      commitBuilding(v, 'shuttle', sn.x, sn.z, sn.rot); computeNetwork(); spots.push(sn);
    }
    for (const [u, dx] of [[0.7, 0], [0.3, 0]]) put('lodge', u, 0.16, dx);
    return { stations: [0, 1].map((z) => zoneStations(z).length), link: crossCost(0, 1) }; })()`);
  assert(setup.stations[0] >= 2 && setup.stations[1] >= 2, `two shuttle stations at each base: ${JSON.stringify(setup)}`);
  assert(setup.link < Infinity, 'the shuttle links the bases');
  await g.ev(SETUPS.midwinter);
  const r = await g.ev(`(() => {
    let seed = 11; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    openDay(); state.speed = 0;
    let n = 0, worst = 0, peak = 0, stops = new Set(), served = new Set();
    const board = loopArrive; loopArrive = (b) => { served.add(b.stn); board(b); };
    while (state.phase === 'open' && state.time < closeTime() && n < 99999) {
      simStep(1.5); n++;
      for (const x of guests) if (x.st === 'xbq') { worst = Math.max(worst, state.time - x.qSince); stops.add(x.stn); }
      peak = Math.max(peak, buses.filter((b) => b.kind === 'loop').length);
    }
    return { worst: Math.round(worst), peak, stops: [...stops].sort(), served: [...served].sort(), crossings: today.crossings || 0 };
  })()`);
  assert(r.crossings > 20, `guests cross by shuttle: ${JSON.stringify(r)}`);
  assert(r.stops.length >= 3 && r.stops.every((s) => r.served.includes(s)), `a bus calls at every stop where guests wait: ${JSON.stringify(r)}`);
  assert(r.worst < 60, `nobody waits an hour for the shuttle (${r.worst} min): ${JSON.stringify(r)}`);
  eq(await g.ev(`(() => { const n = guests.length; restoreSim(JSON.parse(JSON.stringify(serializeSim()))); return guests.length === n; })()`), true, 'a day saved with shuttles running loads back');
  eq(await g.ev(SETUPS.finishDay), 'report', 'the day ends');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
