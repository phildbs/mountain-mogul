// More than one parking lot: a mountain can list sites beside its road for lots of their own. Sections
// remember their lot; cars drive the road only as far as their lot's drive and park there. Mountains
// with one lot (and every older save) work exactly as before.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  // one-lot mountains: the same as ever
  const j = await openGame(browser, url);
  await j.click('#startBtn'); await j.wait(300);
  eq(await j.ev(`[lotCount(), lotSlot(0), stalls.every((s) => !s.lot), carPath(stalls[0]).length === ROAD_WORLD.length + 3]`), [1, [0, 0, 0], true, true], 'Juniper: one lot, as before');
  eq(await j.ev(`(() => { state.lotLayout = [[0, 0], [0, 1]]; state.lotSections = 2; buildLot(); return [stalls.length, stalls.every((s) => !s.lot)]; })()`), [192, true], 'old two-number layouts still mean the main lot');
  await j.page.close();

  // Twin Notch: a west lot beside the road, on its valley side
  const g = await openGame(browser, url, { mountain: 'twin' });
  await g.click('#startBtn'); await g.wait(300);
  eq(await g.ev(`lotCount()`), 2, 'Twin Notch has a site for a second lot');
  const r = await g.ev(`(() => {
    state.lotLayout = [[0, 0, 0], [0, 0, 1], [0, 1, 1]]; state.lotSections = 3; buildLot();
    const west = stalls.filter((s) => s.lot === 1), main = stalls.filter((s) => !s.lot), site = lotSite(1);
    const box = slotBox(0, 0, 1), box2 = slotBox(0, 1, 1);
    return { main: main.length, west: west.length, inProp: [box, box2].every((b) => [[b.x0, b.z0], [b.x1, b.z1]].every(([x, z]) => inProperty(x, z))),
      clear: [lotLandBlock(box), lotLandBlock(box2)], south: box.z0 > site.z, westOf: Math.max(...west.map((s) => s.x)) < Math.min(...main.map((s) => s.x)),
      road: site.road < ROAD_WORLD.length, cap: lotCapacity(), sizes: [lotSize(0), lotSize(1)] }; })()`);
  eq([r.main, r.west, r.cap, r.sizes], [96, 192, 288, [1, 2]], 'a main section and two west sections');
  assert(r.inProp && r.south && r.westOf && r.road, `the west lot sits on the property, on the valley side of the road, west of the main lot: ${JSON.stringify(r)}`);
  eq(r.clear, ['', ''], 'on clear, level ground');
  // a car for the west lot drives part of the road, then in by its drive, and parks
  const c = await g.ev(`(() => { openDay(); const i = stalls.findIndex((s) => s.lot === 1); const p = carPath(stalls[i]); const site = lotSite(1);
    const last = p[p.length - 1]; return { n: p.length, roadPart: p.length - 4, site: site.road, ends: Math.hypot(last.x - stalls[i].x, last.z - stalls[i].z) < 0.01 }; })()`);
  eq([c.roadPart, c.ends], [c.site, true], 'west cars leave the road at their drive and end in their space');
  // saved with the lot number, and loaded back
  eq(await g.ev(`(() => { const sv = JSON.parse(JSON.stringify(saveData(false))); applySave(sv); return [state.lotLayout, stalls.filter((s) => s.lot === 1).length]; })()`), [[[0, 0, 0], [0, 0, 1], [0, 1, 1]], 192], 'saved and loaded with their lots');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
