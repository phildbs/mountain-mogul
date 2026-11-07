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
      runs: mapViewer.runs.out.map((r) => [r.green.rating, r.blue.rating, r.black.rating >= 2, r.green.uphill || r.blue.uphill, Math.round(r.green.len * FT_PER_UNIT)]),
      lots: mapViewer.lots.out.map((l) => [l.free, l.bought]),
      land: mapViewer.parcels.out.map((l) => l.map((P) => [Math.round(P.acres), P.grade < 0.1])),
      trees: S.map((x) => x.trees || 0),
      acres: S.map((x) => Math.round(x.cells * ACRES_PER_CELL)), top: S.map((x) => Math.round(x.flatTop * ACRES_PER_CELL)), vert: S.map((x) => Math.round((x.hi - x.lo) * FT_PER_UNIT)) };
  })()`);
  eq([q.mt, q.rows, q.picker, q.bases], ['ridge', 4, 3, [0, 1, 2, 3]], 'Long Ridge: four slices, each base on its own, and the map picker (Crown Peak, Ridgeline, Mount Ember)');
  assert(Math.max(...q.acres) - Math.min(...q.acres) <= 2, `the strips are the same size (${q.acres})`);
  assert(Math.max(...q.vert) / Math.min(...q.vert) < 1.2, `no slice has much more vertical than another (${q.vert})`);
  assert(q.top.every((a) => a >= 15), `every slice has a flat summit to build on (${q.top} acres)`);
  eq(q.runs.map((x) => x.slice(0, 4)), [0, 1, 2, 3].map(() => [0, 1, true, false]), 'a green, a blue and a black from every summit, rated by the game');
  assert(q.runs.every((x) => x[4] > 7000), `the greens are long (${q.runs.map((x) => x[4])} ft)`);
  eq(q.land, [0, 1, 2, 3].map(() => [[16, true], [16, true]]), 'two flat parcels of valley land for sale below every slice');
  assert(q.lots.every(([a, b]) => a >= 4 && b >= 4), `a first row of parking on every slice's own land, a second on the land for sale (${JSON.stringify(q.lots)})`);
  assert(Math.min(...q.trees) > 5000 && Math.max(...q.trees) / Math.min(...q.trees) < 1.05, `every slice has about as many trees to clear (${q.trees})`);
  eq(r.errors, [], 'no page errors on Long Ridge');
  await r.page.close();
  // Mount Ember (draft): a volcano cut into halves, thirds or quarters for 2, 3 or 4 resorts, the crater nobody's.
  // Natural ground, not mirrored, so each slice is about as good as the others rather than the same.
  for (const n of [2, 3, 4]) {
    const m = await openGame(browser, url, { query: `?mapView=volcano${n}`, mountain: 'fresh' });
    await m.page.waitForFunction(() => !!document.getElementById('mapView'), null, { timeout: 30000 });
    const w = await m.ev(`(() => {
      const S = viewStats(), C = viewCentre();
      return { mt: MOUNTAIN.id, rows: document.querySelectorAll('#mapView .vrow').length, crater: sliceAt(C.x + HALF, C.z + HALF), lake: !!steam.pts,
        bases: Array.from({ length: MOUNTAIN.slices }, (_, k) => { const b = viewBase(k); return sliceAt(b.x + HALF, b.z + HALF); }),
        mix: S.map((x) => x.mix.map((c) => c / x.cells * 100)),
        runs: mapViewer.runs.out.map((r) => [r.green.rating, r.blue.rating, r.black.rating >= 2, r.green.uphill || r.blue.uphill]),
        trees: S.map((x) => x.trees || 0), acres: S.map((x) => Math.round(x.cells * ACRES_PER_CELL)), top: S.map((x) => Math.round(x.flatTop * ACRES_PER_CELL)),
        vert: S.map((x) => Math.round((x.hi - x.lo) * FT_PER_UNIT)) };
    })()`);
    const ks = Array.from({ length: n }, (_, k) => k), spread = (a) => Math.max(...a) - Math.min(...a);
    eq([w.mt, w.rows, w.crater, w.lake, w.bases], [`volcano${n}`, n, -1, true, ks], `Mount Ember for ${n}: ${n} slices, a base on each, the crater nobody’s, with its lake`);
    assert(spread(w.acres) <= 4 && w.acres.every((a) => a > 360), `the slices are the same size (${w.acres} acres)`);
    assert([0, 1, 2, 3].every((i) => spread(w.mix.map((x) => x[i])) < 6), `every slice has about the same mix of easy and steep ground (${JSON.stringify(w.mix.map((x) => x.map(Math.round)))})`);
    assert(spread(w.vert) < 60 && w.vert.every((v) => v > 1150) && w.top.every((a) => a >= 8), `a tall cone, a flat shelf below the rim on every slice (${w.vert} ft, ${w.top} acres flat)`);
    eq(w.runs, ks.map(() => [0, 1, true, false]), 'a green, a blue and a black from every stretch of rim, rated by the game');
    // (the viewer's own road and creek cut a few trees from the slices beside them)
    assert(Math.min(...w.trees) > 5000 && Math.max(...w.trees) / Math.min(...w.trees) < 1.15, `every slice has about as many trees to clear (${w.trees})`);
    eq(m.errors, [], `no page errors on Mount Ember for ${n}`);
    await m.page.close();
  }
  // and its match demo: each game turns the whole mountain so its own slice is in front, the rivals on the others
  const dd = await openGame(browser, url, { query: '?matchDemo=volcano3', mountain: 'fresh' });
  await dd.page.waitForFunction(() => window.__dbg('!!(matchView && matchView.demo)'), null, { timeout: 30000 });
  const dm = await dd.ev(`({ mt: MOUNTAIN.id, rivals: matchView.resorts.map((r) => r.slot), drawn: matchView.drawn,
    turned: Math.abs(MOUNTAIN.height(0.3, 0.4) - MATCH_MAPS.volcano3.height(...MATCH_MAPS.volcano3.turn(0.3, 0.4, 1))) < 1e-9 })`);
  eq([dm.mt, dm.rivals, dm.turned], ['volcano3@1', [0, 2], true], 'the Mount Ember demo is slot 2’s game, the mountain turned to it, a rival on each other slice');
  assert(dm.drawn >= 2, `their lifts are drawn (${dm.drawn})`);
  eq(dd.errors, [], 'no page errors in the Mount Ember demo');
  await dd.page.close();
}
