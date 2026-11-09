// More than one parking lot on a map with two bases: the map's second lot (built in an old save as sections) becomes
// a lot of its own in the same place; its cars drive the road only as far as its entrance and park there; both lots
// fill together; saved and loaded with their lots.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { mountain: 'twin' });
  await g.click('#startBtn'); await g.wait(300);
  eq(await g.ev(`[baseCount(), lotCount()]`), [2, 1], 'Twin Notch: two bases, the main lot built');
  const r = await g.ev(`(() => {
    const box = slotBox(0, 0, 1), box2 = slotBox(0, 1, 1), site = lotSite(1);
    state.lotLayout = [[0, 0, 0], [0, 0, 1], [0, 1, 1]]; state.lotSections = 3; lotsFromSections();
    const west = stalls.filter((s) => s.lot === 1), main = stalls.filter((s) => s.lot === 0), W = parks()[1];
    return { main: main.length, west: west.length, name: W.name, base: baseOfLot(1), reached: parkReached(1), south: W.z > site.z,
      westOf: Math.max(...west.map((s) => s.x)) < Math.min(...main.map((s) => s.x)), inProp: [box, box2].every((b) => [[b.x0, b.z0], [b.x1, b.z1]].every(([x, z]) => inProperty(x, z))) }; })()`);
  eq([r.main, r.west, r.name, r.base, r.reached], [96, 192, 'West lot', 1, true], 'a main lot and a two-section West lot, at the second base, reached from the road');
  assert(r.inProp && r.south && r.westOf, `on the property, on the valley side of the road, west of the main lot: ${JSON.stringify(r)}`);
  // a car for the west lot leaves the road near its entrance and ends in its space
  const c = await g.ev(`(() => { const i = stalls.findIndex((s) => s.lot === 1), p = carPath(stalls[i]), d = gateDoor(parks()[1], parks()[1].ents[0]);
    const last = p[p.length - 1], k = p.findIndex((q) => Math.hypot(q.x - d.x, q.z - d.z) < 0.01);
    return { ends: Math.hypot(last.x - stalls[i].x, last.z - stalls[i].z) < 0.01, door: k > 0, short: k < ROAD_WORLD.length + 2 }; })()`);
  eq(c, { ends: true, door: true, short: true }, 'west cars come in at its entrance and end in their space');
  // both lots fill together
  const f = await g.ev(`(() => { openDay(); const real = lotScores, t0 = today; lotScores = () => [2, 1]; today = { turnedAway: 0 }; cars.length = 0; for (const s of stalls) s.car = null;
    for (let k = 0; k < 12; k++) spawnCar(1); lotScores = real; today = t0; const n = [0, 0]; for (const c of cars) n[stalls[c.stall].lot || 0]++; return n; })()`);
  assert(f[0] > 0 && f[1] > 0 && f[0] + f[1] === 12, `early cars go to both lots: ${JSON.stringify(f)}`);
  eq(await g.ev(`(() => { const sv = JSON.parse(JSON.stringify(saveData(false))); applySave(sv); return [parks().map((P) => P.name), stalls.filter((s) => s.lot === 1).length]; })()`), [['Main lot', 'West lot'], 192], 'saved and loaded with their lots');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
