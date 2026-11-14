// Drawing less: zoomed out, trees use the simple shape; zoomed in, the full one. A computer whose graphics can't keep
// up draws fewer pixels (2x, 1.5x, 1x, remembered for next time), then is offered Low graphics once. A slow day's
// simulation (lots of work each frame) never turns the picture down.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter);

  // trees: the simple shape zoomed out, the full one close up, about a fifth of the drawing
  const lod = await g.ev(`(() => { const tri = (geo) => geo.attributes.position.count / 3, m = treeMesh.userData.lod;
    camTween = null; cam.viewH = 190; cam.viewGoal = null; treeLod(); const out = treeMesh.geometry === m.far;
    cam.viewH = 40; treeLod(); return { out, in: treeMesh.geometry === m.near, near: tri(m.near), far: tri(m.far), haze: m.far.attributes.ihaze === m.near.attributes.ihaze }; })()`);
  assert(lod.out && lod.in, 'simple trees zoomed out, full trees close up');
  assert(lod.far * 4 < lod.near, `the simple tree is a fraction of the drawing (${lod.far} vs ${lod.near} triangles)`);
  assert(lod.haze, 'both shapes share the trees’ haze');

  // close up, only the trees on screen are copied into the drawn mesh; the full forest still casts shadows (layer 1)
  const cull = await g.ev(`(() => { cam.viewH = 60; updateCamera(); treeLod(); cam.viewH = 30; updateCamera(); treeLod(); const v = treeMesh.userData.view, a = treeMesh.instanceMatrix.array;
    _cx.setFromMatrixColumn(camera.matrixWorld, 0); _cy.setFromMatrixColumn(camera.matrixWorld, 1);
    const p = new THREE.Vector3(), onScreen = []; for (let i = 0; i < treeMesh.count; i++) { p.set(a[i * 16 + 12], a[i * 16 + 13], a[i * 16 + 14]).project(camera); if (Math.abs(p.x) < 1 && Math.abs(p.y) < 1) onScreen.push(i); }
    const have = new Set(); for (let i = 0; i < v.count; i++) have.add(v.instanceMatrix.array.slice(i * 16 + 12, i * 16 + 15).join());
    const missing = onScreen.filter((i) => !have.has(a.slice(i * 16 + 12, i * 16 + 15).join())).length;
    const before = v.count, k = slotTree[onScreen[0]]; trees.alive[k] = 0; dropTree(k); treeLod();
    const after = v.count; trees.alive[k] = 1; packTrees(); treeLod();
    const out = { all: treeMesh.count, drawn: before, onScreen: onScreen.length, missing, after, back: v.count, shown: v.visible, viewShadow: v.castShadow };
    const pass = (c) => { treeMesh.onBeforeRender(renderer, scene, c); const n = treeMesh.count; treeMesh.onAfterRender(renderer, scene, c); return [n, treeMesh.count]; };
    out.view = pass(camera); out.sun = pass(sun.shadow.camera);
    cam.viewH = 190; updateCamera(); treeLod(); out.farHidden = !v.visible && pass(camera)[0] === treeMesh.count; return out; })()`);
  assert(cull.onScreen > 20 && cull.missing === 0, `every tree on screen is drawn (${cull.onScreen} on screen, ${cull.missing} missing)`);
  assert(cull.drawn < cull.all / 3, `most of the forest isn't drawn close up (${cull.drawn} of ${cull.all})`);
  eq([cull.after, cull.back], [cull.drawn - 1, cull.drawn], 'clearing a tree on screen takes it out of the drawing, and back');
  eq([cull.shown, cull.viewShadow, cull.view, cull.sun], [true, false, [0, cull.all], [cull.all, cull.all]], 'the whole forest casts the shadows; the view draws only the copy');
  eq(cull.farHidden, true, 'zoomed out, the whole forest is drawn again');

  // trail ribbons keep only the sample rows that change the picture; the heat map still paints each kept row
  const rib = await g.ev(`(() => { const t = realTrails()[0], geo = t.mesh.geometry, rows = geo.userData.rows, n = t.samples.length;
    heatVals.set(t.id, Array.from({ length: HEAT_BINS }, (_, i) => i / HEAT_BINS * 2)); paintHeat(t, true);
    const a = geo.attributes.color.array, m = ACROSS.length, first = a.slice(0, 3).join(), last = a.slice((rows.length - 1) * m * 4, (rows.length - 1) * m * 4 + 3).join();
    paintHeat(t, false); return { n, kept: rows.length, ends: rows[0] === 0 && rows[rows.length - 1] === n - 1, verts: geo.attributes.position.count === rows.length * m, gap: Math.max(...Array.from(rows).slice(1).map((r, i) => r - rows[i])), heat: first !== last }; })()`);
  assert(rib.kept < rib.n && rib.ends && rib.verts && rib.gap <= 8, `ribbon rows thinned (${rib.kept} of ${rib.n}, at most 8 apart, both ends kept)`);
  assert(rib.heat, 'the heat map still changes along the trail');

  // paused and untouched, the picture is drawn a few times a second; at 120 Hz and above, every other frame
  const gaps = await g.ev(`(() => { const t = performance.now() + 5000, out = {}, ph = state.phase; state.phase = 'open'; state.speed = 0; camTween = glide = null; cam.viewGoal = null; cam.azGoal = cam.az;
    const wf = weatherFall; weatherFall = 0; out.still = frameGap(t); weatherFall = 0.15; out.snow = frameGap(t); weatherFall = wf;
    out.touched = frameGap(inputT + 100); state.phase = 'open'; state.speed = 1; out.playing = frameGap(t); state.speed = 0; state.phase = ph; return out; })()`);
  eq(gaps, { still: 90, snow: 30, touched: 9.5, playing: 9.5 }, 'gap between pictures: still, snowing, just touched, playing');

  // buildings are drawn in batches (one mesh per material per patch of the map); their own meshes are kept for clicks
  const bat = await g.ev(`(() => { state.cash = 1e9; const placed = [];
    for (const [type, x, z] of [['lodge', 3, 64], ['cafe', 14, 62], ['rental', -10, 63]]) { const i = evalBuilding(type, x, z, 0); if (i && !i.problems.length) placed.push(commitBuilding(i, type, x, z, 0)); }
    bldBatchTick(); let own = 0, ownV = 0, hidden = 0; bldGroup.traverse((o) => { if (o.isMesh) { own++; ownV += o.geometry.attributes.position.count; if (o.layers.mask === 4) hidden++; } });
    let batV = 0; for (const m of BLD_BATCH.children) batV += m.geometry.attributes.position.count;
    const B = world.buildings.find((b) => b.type === 'lodge'), flr = BLD_BATCH.children.some((m) => Array.from(m.geometry.attributes.mmb.array).includes(Math.fround(B.baseY)));
    cam.viewH = 30; cam.target.x = B.x; cam.target.z = B.z; updateCamera(); const p = new THREE.Vector3(B.x, B.baseY + 1, B.z).project(camera);
    const picked = pickBldAt((p.x + 1) / 2 * W, (1 - p.y) / 2 * H) === B;
    const n0 = BLD_BATCH.children.length; removeBuilding(B); bldBatchTick(); let batV2 = 0; for (const m of BLD_BATCH.children) batV2 += m.geometry.attributes.position.count;
    let ownV2 = 0; bldGroup.traverse((o) => { if (o.isMesh) ownV2 += o.geometry.attributes.position.count; });
    return { placed: placed.length, own, hidden, batches: n0, same: batV === ownV, flr, picked, after: batV2 === ownV2 && batV2 < batV }; })()`);
  assert(bat.placed >= 2 && bat.batches < bat.own, `fewer draws than parts (${bat.batches} batches for ${bat.own} parts)`);
  eq([bat.hidden, bat.same, bat.flr, bat.picked, bat.after], [bat.own, true, true, true, true], 'every part is in a batch, the night light knows its floor, clicks still find the building, removing it redraws');

  // slow drawing: frames at 20 a second with little work each
  const feed = (iv, wk, n) => g.ev(`(() => { for (let i = 0; i < ${n}; i++) perfWatch(${iv}, ${wk}); return renderer.getPixelRatio(); })()`);
  await g.ev(`(() => { setDpr(2); perf.since = 0; perf.iv.length = perf.work.length = 0; perf.tipped = false; localStorage.removeItem('mm.dpr'); localStorage.removeItem('mm.gfxTip'); })()`);
  eq(await feed(50, 30, 400), 2, 'slow frames full of the game’s own work (a busy day) leave the picture alone');
  eq(await feed(16, 2, 400), 2, 'smooth frames leave it alone');
  eq(await feed(1500, 2, 400), 2, 'pauses (switched away and back) don’t count');
  await g.ev(`perf.since = 0; perf.iv.length = perf.work.length = 0`); // as just after loading
  eq(await feed(50, 3, 100), 2, 'not in the first seconds after loading, nor on a handful of frames');
  eq(await feed(50, 3, 60), 1.5, 'slow drawing: down to 1.5x');
  eq(await g.ev(`[localStorage.getItem('mm.dpr'), PR_U.value]`), ['1.5', 1.5], 'remembered for next time, and the snowflakes follow');
  eq(await feed(50, 3, 150), 1, 'still slow: the screen’s own pixels');
  eq(await g.ev(`$('toast').hidden`), true, 'no tip yet');
  await feed(50, 3, 150);
  eq(await g.ev(`[!$('toast').hidden, /Low graphics/.test($('toast').innerText), localStorage.getItem('mm.gfxTip')]`), [true, true, '1'], 'still slow: Low graphics is offered');
  await g.ev(`$('toast').hidden = true; perf.tipped = false`);
  await feed(50, 3, 150);
  eq(await g.ev(`$('toast').hidden`), true, 'only once');

  // a reload starts at the remembered sharpness
  await g.ev(`saveNow()`); await g.page.reload(); await g.reloaded();
  eq(await g.ev(`renderer.getPixelRatio()`), 1, 'the next visit starts at what worked');
}
