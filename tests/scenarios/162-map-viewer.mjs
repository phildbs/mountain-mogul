// The map viewer (?mapView=1): Crown Peak with every slice in full, its own panel instead of the game's tools,
// each slice's numbers (all the same on Crown Peak, which is the same all the way round), flying to each base,
// tilting to straight down, steepness colours on rivals' slices too, and summer and back. Never saves.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { query: '?mapView=1', mountain: 'fresh' });
  await g.page.waitForFunction(() => !!document.getElementById('mapView'), null, { timeout: 20000 });
  const s = await g.ev(`(() => {
    const S = viewStats(), k = MOUNTAIN.slices, C = viewCentre(), back = viewTurn(1)(roadEnd());
    return { mt: MOUNTAIN.id, k, rows: document.querySelectorAll('#mapView .vrow').length, tags: mapViewer.tags.length,
      // the same within a sliver: the grid's squares don't turn exactly onto each other
      same: S.map((x) => [x.cells / S[0].cells, ...x.mix.map((m, i) => (m - S[0].mix[i]) / S[0].cells), x.hi - S[0].hi]),
      acres: Math.round(S[0].cells * ACRES_PER_CELL), haze: Math.max(hazeAt(back.x + HALF, back.z + HALF), hazeAt(C.x + HALF, C.z + HALF)),
      slices: [sliceAt(roadEnd().x + HALF, roadEnd().z + HALF), sliceAt(back.x + HALF, back.z + HALF), sliceAt(viewTurn(2)(roadEnd()).x + HALF, viewTurn(2)(roadEnd()).z + HALF)],
      dock: getComputedStyle($('dock')).display, rivals: rivalGroup.children.length };
  })()`);
  eq([s.mt, s.k, s.rows, s.tags], ['match', 3, 3, 4], 'Crown Peak, three slices in the panel, a tag at each base and the summit');
  assert(s.same.every(([n, ...r]) => Math.abs(n - 1) < 0.01 && r.slice(0, 5).every((m) => Math.abs(m) < 0.02) && Math.abs(r[5]) < 0.2), `every slice of Crown Peak has the same ground (${JSON.stringify(s.same.map((r) => r.map((x) => +x.toFixed(3))))})`);
  assert(s.acres > 300 && s.acres < 450, `a slice is a third of the mountain (${s.acres} acres)`);
  eq(s.slices, [0, 1, 2], 'each base is on its own slice');
  assert(s.haze < 0.01, `rivals' slices aren't hazed (${s.haze})`);
  eq(s.dock, 'none', 'the building tools are hidden');
  assert(s.rivals >= 4, `the other bases' roads and lots are drawn (${s.rivals})`);
  // Fly to slice 3: the camera turns to look up it from its base.
  const az = await g.ev(`(() => { viewGo(2); camTween.t = 1; return { az: camTween.to.az, want: -2 * 2 * Math.PI / 3 }; })()`);
  const d = ((az.az - az.want) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  assert(d < 0.01 || d > 2 * Math.PI - 0.01, `facing slice 3 (${az.az.toFixed(2)})`);
  // Straight down, steepness colours (on a rival's slice too), summer and back to winter.
  const v = await g.ev(`(() => {
    const t = $('vTilt'); t.value = 85; t.dispatchEvent(new Event('input'));
    const p = viewTurn(1)({ x: lerp(roadEnd().x, viewCentre().x, 0.5), z: lerp(roadEnd().z, viewCentre().z, 0.5) }), i = Math.round(p.x + HALF), j = Math.round(p.z + HALF), at = () => [...terrainGeo.attributes.color.array.slice((j * NV + i) * 3, (j * NV + i) * 3 + 3)].map((c) => +c.toFixed(3)).join();
    const before = at(); $('vSlope').click(); const slope = at(); $('vSlope').click();
    $('vSummer').click(); const summer = { s: state.summer, w: winterView, ns: Math.max(...NS) }; $('vSummer').click();
    return { el: +EL.toFixed(2), coloured: before !== slope, summer, back: { s: state.summer, w: winterView, ns: Math.max(...NS) > 0 } };
  })()`);
  eq(v.el, 1.48, 'tilted to 85 degrees');
  assert(v.coloured, 'steepness colours reach a rival’s slice');
  eq([v.summer.s, v.summer.w, v.summer.ns], [true, false, 0], 'summer: no snow');
  eq([v.back.s, v.back.w, v.back.ns], [false, true, true], 'back to winter with the snow restored');
  const saved = await g.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('skiTycoon') && /"mt":"match"/.test(localStorage.getItem(k) || '')));
  eq(saved, [], 'the viewer is never saved');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
  // Long Ridge (draft): four strips side by side, a base on each, the picker to switch maps.
  const r = await openGame(browser, url, { query: '?mapView=ridge', mountain: 'fresh' });
  await r.page.waitForFunction(() => !!document.getElementById('mapView'), null, { timeout: 20000 });
  const q = await r.ev(`(() => {
    const S = viewStats();
    return { mt: MOUNTAIN.id, rows: document.querySelectorAll('#mapView .vrow').length, picker: $('vMap').options.length,
      bases: [0, 1, 2, 3].map((k) => { const b = viewBase(k); return sliceAt(b.x + HALF, b.z + HALF); }),
      runs: mapViewer.runs.out.map((r) => [r.green.rating, r.blue.rating, r.green.uphill || r.blue.uphill, Math.round(r.green.len * FT_PER_UNIT)]),
      acres: S.map((x) => Math.round(x.cells * ACRES_PER_CELL)), top: S.map((x) => Math.round(x.flatTop * ACRES_PER_CELL)), vert: S.map((x) => Math.round((x.hi - x.lo) * FT_PER_UNIT)) };
  })()`);
  eq([q.mt, q.rows, q.picker, q.bases], ['ridge', 4, 2, [0, 1, 2, 3]], 'Long Ridge: four slices, each base on its own, and the map picker');
  assert(Math.max(...q.acres) - Math.min(...q.acres) <= 2, `the strips are the same size (${q.acres})`);
  assert(Math.max(...q.vert) / Math.min(...q.vert) < 1.2, `no slice has much more vertical than another (${q.vert})`);
  assert(q.top.every((a) => a >= 15), `every slice has a flat summit to build on (${q.top} acres)`);
  eq(q.runs.map((x) => x.slice(0, 3)), [0, 1, 2, 3].map(() => [0, 1, false]), 'a green and a blue from every summit, rated by the game');
  assert(q.runs.every((x) => x[3] > 7000), `the greens are long (${q.runs.map((x) => x[3])} ft)`);
  eq(r.errors, [], 'no page errors on Long Ridge');
  await r.page.close();
}
