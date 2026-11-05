// The map viewer on a single-player mountain (?mapView=juniper): the property and all the land for sale round it,
// a tag at each base, the summit and the town, the numbers for each, flying to a spot, steepness on the land for
// sale too, the parcel sizes and the land for sale switched off and on. Never saves.
import { openGame, eq, assert } from '../harness.mjs';
const SHOTS = process.env.SHOTS === '1';
export default async function ({ browser, url }) {
  for (const [mt, bases] of [['juniper', 1], ['lonepine', 2]]) {
    const g = await openGame(browser, url, { query: `?mapView=${mt}`, mountain: 'fresh', render: SHOTS });
    await g.page.waitForFunction(() => !!document.getElementById('mapView'), null, { timeout: 20000 });
    const s = await g.ev(`(() => {
      const { own, sale, land } = mapViewer.solo, P = PARCELS[0], m = { x: (P.i0 + P.i1) / 2, z: (P.j0 + P.j1) / 2 };
      return { mt: MOUNTAIN.id, solo: VIEW_SOLO, spots: mapViewer.spots.map((S) => S.name), rows: document.querySelectorAll('#mapView .vrow').length,
        picker: $('vMap').options.length, acres: Math.round(own.cells * ACRES_PER_CELL), saleAcres: Math.round(sale.cells * ACRES_PER_CELL),
        parcels: land.length, vert: Math.round((own.hi - own.lo) * FT_PER_UNIT), peakOwn: inPlay(own.peak.x + HALF, own.peak.z + HALF),
        haze: hazeAt(m.x, m.z), dock: getComputedStyle($('dock')).display };
    })()`);
    eq([s.mt, s.solo, s.rows, s.picker], [mt, true, 3, 8], `${mt}: a single-player mountain, its rows and every map in the picker`);
    eq(s.spots.length, bases + (mt === 'lonepine' ? 2 : 1), `${mt}: a spot for each base, the summit${mt === 'lonepine' ? ' and the town' : ''} (${s.spots})`);
    assert(s.acres > 600 && s.acres < 700, `${mt}: the starting land is the usual square (${s.acres} acres)`);
    assert(s.saleAcres > 150 && s.parcels >= 23, `${mt}: the land for sale all round (${s.parcels} parcels, ${s.saleAcres} acres)`);
    assert(s.vert > 300 && s.peakOwn, `${mt}: vertical from the ground, the summit on your land (${s.vert} ft)`);
    assert(s.haze < 0.05, `${mt}: the land for sale isn't hazed (${s.haze})`);
    eq(s.dock, 'none', `${mt}: the building tools are hidden`);
    if (SHOTS) { await g.wait(3000); await g.page.screenshot({ path: `solo-view-${mt}.png` }); }
    const v = await g.ev(`(() => {
      const P = PARCELS[0], i = Math.round((P.i0 + P.i1) / 2), j = Math.round((P.j0 + P.j1) / 2), at = () => [...terrainGeo.attributes.color.array.slice((j * NV + i) * 3, (j * NV + i) * 3 + 3)].map((c) => +c.toFixed(3)).join();
      const before = at(); $('vSlope').click(); const slope = at(); $('vSlope').click();
      const hid = mapViewer.landTags.every((T) => T.hide); $('vSizes').click(); const shown = mapViewer.landTags.every((T) => !T.hide);
      $('vLand').click(); const off = [mapViewer.parcels.grp.visible, mapViewer.landTags.every((T) => T.hide)]; $('vLand').click(); $('vSizes').click();
      soloGo(1); camTween.t = 1;
      return { coloured: before !== slope, sizes: [hid, shown], off, on: mapViewer.parcels.grp.visible, to: [Math.round(camTween.to.x - mapViewer.spots[1].p.x), Math.round(camTween.to.z - mapViewer.spots[1].p.z)] };
    })()`);
    assert(v.coloured, `${mt}: steepness colours reach the land for sale`);
    eq([v.sizes, v.off, v.on, v.to], [[true, true], [false, true], true, [0, 0]], `${mt}: parcel sizes off at first and on, land for sale off and on, and flying to a spot`);
    const saved = await g.page.evaluate(() => Object.keys(localStorage).filter((k) => /^skiTycoon\.juniperRidge\.v1\.[a-z0-9]+$/i.test(k) && !/slots|tutorial|boot/.test(k)));
    eq(saved, [], `${mt}: the viewer is never saved`);
    eq(g.errors, [], `${mt}: no page errors`);
    await g.page.close();
  }
}
