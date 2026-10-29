// Lunch: a guest who finds the lodge too dear looks for something cheaper (a food truck) instead of going
// without all day; rejecting two categories still leaves other options and retries after price cuts available.
// Lots: a carload picks the lot whose lifts have runs that suit it; runs too hard count for nothing.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
import { build } from '../twin-resort.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const r = await g.ev(`(() => { state.cash = 1e8; const L = world.lifts[0], lodge = world.buildings.find((B) => B.type === 'lodge');
    let truck = null; for (let k = 0; k < 60 && !truck; k++) { const x = L.a.x - 14 + (k % 6) * 1.5, z = L.a.z - 4 + Math.floor(k / 6) * 1.5, v = evalBuilding('truck', x, z, 0, false); if (!v.problems.length) truck = commitBuilding(v, 'truck', x, z, 0); }
    computeNetwork(); openDay(); state.speed = 0; state.time = 720;
    const gs = guests.length ? guests[0] : null;
    const G = { id: 99999, x: lodge.door.x, z: lodge.door.z, ab: 1, spend: 0, ate: false, lunchAt: 700, sat: 70, svc: 'food', qh: 0.5, fancy: false, th: [], seen: {}, pat: 10 };
    const real = Math.random, lb = leaveBuilding; leaveBuilding = () => {}; Math.random = () => 0.999; // too dear for this guest; checked at the counter only
    serve(G, lodge); Math.random = real;
    const after = { ate: G.ate, skipped: !!G.skipped, priced: G.pricedOut, avoid: G.avoidB === lodge.id };
    const pick = bestVisit(G, lodge.door, 60, true, world.buildings, ['lunch']);
    // turned down twice: they can still try another category or reconsider after a price cut
    const H = { ...G, pricedOut: ['food'], ate: false, svc: 'dine' }; Math.random = () => 0.999; serve(H, lodge); Math.random = real; leaveBuilding = lb;
    return { after, pick: pick && pick.B.type, twice: [H.ate, !!H.skipped], truck: !!truck }; })()`).catch((e) => { throw new Error("lunch part: " + e.message.split("\n").slice(0, 3).join(" | ")); });
  assert(r.truck, 'a food truck was placed');
  eq(r.after, { ate: false, skipped: false, priced: ['food'], avoid: false }, 'priced out of the lodge meal, they stay hungry; other services in that building remain available');
  eq(r.pick, 'truck', 'they head for the cheaper food truck');
  eq(r.twice, [false, false], 'after a second rejection they keep looking for food');
  await g.page.close();

  // Twin Notch: the east lot has the green run; the west lot only harder ones
  const t = await openGame(browser, url, { mountain: 'twin' });
  await t.click('#startBtn'); await t.wait(300);
  await t.ev(build);
  const s = await t.ev(`(() => { state.lotLayout = [[0, 0, 0], [0, 0, 1]]; state.lotSections = 2; buildLot(); computeNetwork();
    const east = baseOf(world.lifts[0].a) === 0 ? world.lifts[0] : world.lifts[1], west = east === world.lifts[0] ? world.lifts[1] : world.lifts[0];
    const signs = (L) => L.departing.map(trailSign);
    const sc = (a) => lotScores(a).map((v) => +v.toFixed(2));
    const before = [0, 1, 2, 3].map(sc);
    west.open = false; const closed = sc(2); west.open = true;
    return { east: signs(east), west: signs(west), before, closed }; })()`);
  assert(s.east.includes(0) && !s.west.includes(0), `the green run is at the east base: ${JSON.stringify(s)}`);
  assert(s.before[0][0] > s.before[0][1], `beginners prefer the east lot (${JSON.stringify(s.before[0])})`);
  assert(s.before[3][1] >= s.before[3][0] * 0.8, `experts like the west lot at least as well (${JSON.stringify(s.before[3])})`);
  assert(s.closed[1] < s.before[2][1], `closing the west lift is noticed straight away (${JSON.stringify([s.before[2], s.closed])})`);
  eq(t.errors, [], 'no page errors');
  await t.page.close();
}
