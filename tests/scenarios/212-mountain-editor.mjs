// The mountain editor (?editor=1): brushes shape the ground, the mountain is kept on this device, and playing it
// starts a resort whose save carries the mountain, so it opens again without the editor's copy.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  let g = await openGame(browser, url, { query: '?editor=1', mountain: 'fresh' });
  assert(await g.ev(`MOUNTAIN.hand && ED.blank && ED.noRoad && !ED.road && edCreeks().length === 0 && !!document.getElementById('edPanel')`), 'the editor opens on a blank slate: no road, no streams');
  const mix = await g.ev(`(() => { const S = edStats(); return [S.mix[0] / S.cells, S.hi - S.lo]; })()`);
  assert(mix[0] > 0.97 && mix[1] > 8 && mix[1] < 30, `gently tilted: nearly all of it Easier, a little rise from front to back (${mix.map((x) => x.toFixed(2))})`);
  assert(await g.ev(`(!roadMesh || !roadMesh.visible) && !lotGroup.visible && CREEKD.every((d) => d > 2)`), 'no road, lot or creek drawn');
  await g.click('#edPlay');
  assert(await g.ev(`EDITOR && ED.noRoad`), 'Play waits for an access road');
  eq(await g.ev(`draftList().length`), 0, 'nothing is kept until the ground changes');
  // editing one of the game's own mountains
  await g.click('#edMaps');
  await g.ev(`document.getElementById('edFrom').value = 'juniper'`); await g.click('#crisis [data-ed-new=shape]'); await g.reloaded();
  assert(await g.ev(`MOUNTAIN.from === 'juniper' && !ED.blank && !ED.noRoad && ED.name === 'My Juniper Ridge' && draftList().length === 1`), 'a new mountain from Juniper Ridge’s own shape');
  // packing the ground: small, and exact to 1/64
  const pack = await g.ev(`(() => { const h = encodeHeights(ED.E), D = decodeHeights(h); let m = 0; for (let k = 0; k < D.length; k++) m = Math.max(m, Math.abs(D[k] - ED.E[k])); return [h.length, m, decodeHeights(h.slice(0, 900)), decodeHeights('zz!')]; })()`);
  assert(pack[0] < 60000 && pack[1] <= 1 / 128 + 1e-6, `the ground packs small and comes back the same (${pack[0]} characters, off by ${pack[1]})`);
  assert(pack[2] === null && pack[3] === null, 'a broken document is refused');
  // each brush does its job, and the world follows
  const at = `{ x: 10, z: -20 }`, h = `heightAt(10, -20) / VEX`;
  const h0 = await g.ev(h), n0 = await g.ev('trees.n');
  await g.ev(`(() => { const p = ${at}; ED.tool = 'raise'; ED.r = 10; ED.k = 5; edStrokeStart(p); for (let i = 0; i < 30; i++) edBrush(p, 0.05); edStrokeEnd(); edRegrow(); })()`);
  const h1 = await g.ev(h);
  assert(h1 > h0 + 8, `Raise lifts the ground (${h0.toFixed(1)} to ${h1.toFixed(1)})`);
  // Wide reach: the land well outside the ring came up too, less the further out; with it off, only the ring moves
  const far = `[sampleGrid(ED.E, 10 + 15 + HALF, -20 + HALF), sampleGrid(ED.E, 10 + 28 + HALF, -20 + HALF), sampleGrid(ED.E, 10 + 45 + HALF, -20 + HALF)]`;
  const f1 = await g.ev(far); await g.ev('edUndo(false)'); const f0 = await g.ev(far); await g.ev('edUndo(true)');
  assert(f1[0] - f0[0] > 1 && f1[0] - f0[0] > f1[1] - f0[1] && f1[1] - f0[1] > 0.1 && f1[2] === f0[2], `Wide reach lifts the flanks too (${f1.map((x, i) => (x - f0[i]).toFixed(2))})`);
  await g.click('#edWide');
  await g.ev(`(() => { const p = ${at}; edStrokeStart(p); for (let i = 0; i < 10; i++) edBrush(p, 0.05); edStrokeEnd(); })()`);
  const f2 = await g.ev(far); assert(f2[0] === f1[0] && await g.ev(h) > h1 + 2, 'with Wide reach off, only the ground under the brush moves');
  await g.ev('edUndo(false)');
  assert(await g.ev(`Math.abs(terrainGeo.attributes.position.array[((-20 + HALF) * NV + 10 + HALF) * 3 + 1] - heightAt(10, -20)) < 1e-3 && Math.abs(MOUNTAIN.summitH - Math.max(...HT.filter((_, k) => inGridLand(k % NV, Math.floor(k / NV))))) < 1e-3`), 'the drawn ground and the summit follow');
  assert(await g.ev('trees.n') !== n0, 'the forest grows back to suit the new ground');
  await g.ev(`(() => { const p = ${at}; ED.tool = 'lower'; edStrokeStart(p); for (let i = 0; i < 10; i++) edBrush(p, 0.05); edStrokeEnd(); })()`);
  const h2 = await g.ev(h); assert(h2 < h1 - 2, 'Lower digs it down');
  const rough = () => g.ev(`(() => { let s = 0; for (let j = -24; j < -16; j++) for (let i = 6; i < 14; i++) s += Math.abs(4 * ED.E[(j + HALF) * NV + i + HALF] - ED.E[(j + HALF) * NV + i + HALF - 1] - ED.E[(j + HALF) * NV + i + HALF + 1] - ED.E[(j + HALF - 1) * NV + i + HALF] - ED.E[(j + HALF + 1) * NV + i + HALF]); return s; })()`);
  await g.ev(`(() => { const p = ${at}; ED.tool = 'rough'; edStrokeStart(p); for (let i = 0; i < 20; i++) edBrush(p, 0.05); edStrokeEnd(); })()`);
  const r1 = await rough();
  await g.ev(`(() => { const p = ${at}; ED.tool = 'smooth'; edStrokeStart(p); for (let i = 0; i < 20; i++) edBrush(p, 0.05); edStrokeEnd(); })()`);
  assert(await rough() < r1 * 0.6, 'Roughen adds bumps and Smooth takes them out');
  await g.ev(`(() => { const p = ${at}; ED.tool = 'flatten'; ED.k = 10; edStrokeStart(p); for (let i = 0; i < 40; i++) edBrush(p, 0.05); edStrokeEnd(); })()`);
  assert(await g.ev(`sampleGrid(GR, 10 + HALF, -20 + HALF)`) < 0.03, 'Flatten levels the ground');
  // undo and redo, a stroke at a time
  const sum = () => g.ev(`ED.E.reduce((a, b) => a + b, 0)`), flat = await sum();
  await g.ev('edUndo(false)'); assert(Math.abs(await sum() - flat) > 0.5 && await g.ev(`sampleGrid(GR, 10 + HALF, -20 + HALF)`) > 0.03, 'Undo takes the last stroke back');
  await g.ev('edUndo(true)'); assert(Math.abs(await sum() - flat) < 1e-3, 'Redo puts it back');
  for (let i = 0; i < 5; i++) await g.ev('edUndo(false)');
  assert(Math.abs(await g.ev(h) - h0) < 1e-4 && await g.ev('ED.undo.length') === 0, 'undoing every stroke gives the mountain it started as');
  for (let i = 0; i < 5; i++) await g.ev('edUndo(true)');
  // a real drag on the map is a stroke; with Move on, it moves the view instead
  await g.ev(`ED.tool = 'raise'; ED.paint = true; edSync()`);
  let s0 = await sum();
  await g.page.mouse.move(800, 450); await g.page.mouse.down(); await g.page.mouse.move(820, 460, { steps: 3 }); await g.page.mouse.up();
  assert(await sum() > s0, 'dragging on the map uses the brush');
  await g.click('#edPanel [data-mode=move]'); s0 = await sum();
  const cx = await g.ev('cam.target.x');
  await g.page.mouse.move(800, 450); await g.page.mouse.down(); await g.page.mouse.move(700, 400, { steps: 3 }); await g.page.mouse.up();
  assert(await sum() === s0 && await g.ev('cam.target.x') !== cx, 'with Move on, a drag moves the view and leaves the ground alone');
  // a stream is drawn by dragging along its course; Undo takes it away again
  await g.ev(`ED.paint = true; ED.tool = 'stream'; edSync()`);
  const wet = `[CREEKD[(-30 + HALF) * NV + 20 + HALF] < 1, edCreeks().length, !!ED.creeks]`;
  eq(await g.ev(wet), [false, 1, false], 'Juniper Ridge’s own creek to start with');
  await g.ev(`(() => { edStrokeStart({ x: 20, z: -50 }); for (let z = -48; z <= 10; z += 2) edDrawTo({ x: 20, z }); edStrokeEnd(); })()`);
  eq(await g.ev(wet), [true, 2, true], 'a stream runs where it was drawn');
  assert(await g.ev(`HT[(-30 + HALF) * NV + 20 + HALF] < ED.E[(-30 + HALF) * NV + 20 + HALF] - 0.5`), 'and cuts its bed into the ground');
  await g.ev('edUndo(false)'); eq(await g.ev(wet), [false, 1, false], 'Undo takes the stream away');
  await g.ev('edUndo(true)'); eq(await g.ev(wet), [true, 2, true], 'Redo brings it back');
  await g.click('#edNoStreams'); eq(await g.ev(`[edCreeks().length, Math.min(...CREEKD) > 2]`), [0, true], 'Clear streams leaves none');
  await g.ev('edUndo(false)');
  // the access road is drawn the same way: the base goes at its end, and its start is carried off the map
  await g.ev(`ED.tool = 'road'; edStrokeStart({ x: 60, z: 70 }); edDrawTo({ x: 60, z: 110 }); edStrokeEnd()`);
  assert(await g.ev('ED.road') === null, 'a road that ends off the resort’s land is refused');
  await g.ev(`edStrokeStart({ x: 100, z: 20 }); for (let x = 96; x >= 40; x -= 4) edDrawTo({ x, z: 20 + (100 - x) * 0.4 }); edStrokeEnd()`);
  await g.reloaded();
  eq(await g.ev(`[Math.round(roadEnd().x), Math.round(roadEnd().z), ED.road[0][0] > 1.2, ROAD_WORLD.length > 10, !!lotCenter() && Math.hypot(lotCenter().x - 40, lotCenter().z - 44) < 20, ED.creeks.length]`), [40, 44, true, true, true, 2], 'the road comes in from off the map to the new base, with the lot at its end, and the streams are kept');
  // a snowmaking pond, painted on flattened ground: dug into it, kept clear of trees, and undone like the rest
  await g.ev(`(() => { const p = { x: -30, z: 10 }; ED.tool = 'flatten'; ED.r = 14; ED.k = 10; edStrokeStart(p); for (let i = 0; i < 40; i++) edBrush(p, 0.05); edStrokeEnd(); edRegrow(); })()`);
  await g.ev(`(() => { ED.tool = 'pond'; ED.r = 5; edStrokeStart({ x: -33, z: 10 }); for (let x = -33; x <= -27; x++) edDrawTo({ x, z: 10 }); edStrokeEnd(); edRegrow(); })()`);
  const pond = `[ED.ponds.length, world.ponds.length, HT[(10 + HALF) * NV - 30 + HALF] < ED.E[(10 + HALF) * NV - 30 + HALF] - 0.5, (() => { let n = 0; for (let k = 0; k < trees.n; k++) if (Math.hypot(trees.x[k] + 30, trees.z[k] - 10) < 3) n++; return n; })()]`;
  eq(await g.ev(pond), [1, 1, true, 0], 'a painted pond is dug in, with no trees in it');
  await g.ev(`(() => { ED.tool = 'pond'; edStrokeStart({ x: 60, z: 36 }); for (let z = 30; z <= 44; z++) edDrawTo({ x: 60, z }); edStrokeEnd(); })()`);
  eq(await g.ev(`[ED.ponds.length, ED.ponds.length < 2 || ED.ponds[1].every((k) => roadDist(keyX(k), keyZ(k)) >= 2.5)]`), [2, true], 'a pond painted over the road keeps off it');
  await g.ev(`ED.tool = 'pond'; ED.r = 2; edStrokeStart({ x: 0, z: -60 }); edStrokeEnd()`);
  eq(await g.ev('ED.ponds.length'), 2, 'a pond too small is refused');
  await g.ev('edUndo(false)');
  await g.ev(`(() => { const p = { x: -30, z: 25 }; ED.tool = 'raise'; ED.r = 6; edStrokeStart(p); for (let i = 0; i < 10; i++) edBrush(p, 0.05); edStrokeEnd(); })()`);
  eq((await g.ev(pond)).slice(0, 3), [1, 1, true], 'shaping the ground beside it keeps the pond');
  await g.ev('edUndo(false); edUndo(false)'); eq((await g.ev(pond)).slice(0, 3), [0, 0, false], 'Undo takes the pond away');
  await g.ev('edUndo(true)'); eq((await g.ev(pond)).slice(0, 3), [1, 1, true], 'Redo brings it back');
  await g.ev('edUndo(true)');
  await g.ev(`ED.tool = 'raise'; edSync()`);
  // the name, and keeping it on this device
  await g.ev(`(() => { const el = document.getElementById('edName'); el.value = '  Stony <b>Top</b>  '; el.onchange({ target: el }); })()`);
  eq(await g.ev('ED.name'), 'Stony bTop/b', 'the name is tidied');
  assert(await g.ev(`edSave() && ED.saved`), 'kept');
  eq(await g.ev(`draftList().map((d) => d.name + '/' + d.from)`), ['Stony bTop/b/juniper'], 'one mountain under My mountains');
  const keep = await g.ev(`[${h}, encodeHeights(ED.E)]`);
  await g.page.reload(); await g.reloaded();
  assert(await g.ev(`ED.name === 'Stony bTop/b' && encodeHeights(ED.E)`) === keep[1] && Math.abs(await g.ev(h) - keep[0]) < 0.02, 'the editor opens it again as it was left');
  // My mountains: a new one from another mountain, and back
  await g.click('#edMaps');
  await g.click('#crisis [data-ed-new=blank]'); await g.reloaded();
  assert(await g.ev(`ED.blank && ED.noRoad && ED.name === 'My mountain' && draftList().length === 2`), 'a new blank slate from My mountains');
  assert(await g.ev(`edStats().mix[4]`) === 0, 'a blank slate has nothing too steep to ski');
  await g.click('#edMaps');
  await g.ev(`document.querySelector('#crisis [data-ed-open]').click()`); await g.reloaded();
  eq(await g.ev('ED.name'), 'Stony bTop/b', 'opening the first one again');
  // Play: a resort starts on a copy of the mountain
  await g.click('#edPlay'); await g.reloaded();
  const id = await g.ev('MOUNTAIN.id');
  assert(/^c:m[0-9a-z]{14}$/.test(id) && await g.ev(`state.started && !EDITOR && MOUNTAIN.hand && MOUNTAIN.custom && isCustomId(MOUNTAIN.id) && boardOf(MOUNTAIN.id) === 'custom'`), `playing starts a resort on the mountain (${id})`);
  assert(Math.abs(await g.ev(h) - keep[0]) < 0.02, 'with the ground as shaped');
  eq(await g.ev(`[MOUNTAIN.name, MOUNTAIN.cash, activeSlot().mountain, goalList().length > 0]`), ['Stony bTop/b', await g.ev('MOUNTAINS.juniper.cash'), id, true], 'its name, Juniper Ridge’s money, the custom goals');
  eq(await g.ev(`[Math.round(roadEnd().x), Math.round(roadEnd().z), CREEKD[(-30 + HALF) * NV + 20 + HALF] < 1, parks().length > 0 || state.lotSections > 0]`), [40, 44, true, true], 'with the road, the base and the stream as drawn');
  eq(await g.ev(`[world.ponds.length, world.ponds[0].free, world.ponds[0].cost, state.cash === START_CASH, pondGuns() > 0, HT[(10 + HALF) * NV - 30 + HALF] < HT0[(10 + HALF) * NV - 30 + HALF] - 0.5]`), [1, true, 0, true, true, true], 'its pond is dug, free, and adds snow guns');
  await g.ev(`state.cash -= 12345; saveNow()`);
  const cash = await g.ev('state.cash'), n = await g.ev('trees.n');
  assert(await g.ev(`mapIdOf(JSON.parse(localStorage.getItem(saveKey())).map)`) === id, 'the save carries the mountain');
  // the save alone brings the mountain back (another device has no editor copy), and shaping the draft further doesn't touch it
  await g.ev(`localStorage.removeItem(mapKey(MOUNTAIN.id)); for (const d of draftList()) localStorage.removeItem(DRAFT_KEY + d.key)`);
  await g.page.reload(); await g.reloaded();
  eq(await g.ev(`[MOUNTAIN.id, trees.n, state.cash, world.ponds.length, world.ponds[0].free]`), [id, n, cash, 1, true], 'the resort opens again from its save alone, pond and all');
  assert(await g.ev(`document.querySelector('#titleSlots .sc-badge') && [...document.querySelectorAll('#titleSlots .sc-badge')].some((b) => b.textContent === 'Hand-shaped')`), 'its card says Hand-shaped');
  // another player visiting it: the mountain comes with the resort's save, fetched before the page turns to it
  const theirs = await g.ev(`localStorage.getItem(saveKey())`);
  const v = await openGame(browser, url);
  await v.ev(`__fakeSwitch('user-B', 'b@example.com')`); await v.wait(600);
  await v.page.evaluate(({ theirs, id }) => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.users.other = { anon: false };
    d.rows.push({ id: 'theirs', owner: 'other', public: true, summary: { name: 'Sam Summit', creator: 'Sam', mt: id }, save: JSON.parse(theirs), updated_at: new Date().toISOString() });
    localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, { theirs, id });
  await v.ev(`loadBoard(true)`); await v.wait(300);
  assert(await v.ev(`mapDef('${id}') === null && mountainDef('${id}').id === 'juniper'`), 'a device that has never seen the mountain');
  await v.ev(`visitResort('theirs')`); await v.reloaded();
  await v.page.waitForFunction(() => window.__dbg('!!visiting'), null, { timeout: 15000 });
  eq(await v.ev(`[visiting.name, MOUNTAIN.id, MOUNTAIN.name, state.cash, localStorage.getItem(mapKey(MOUNTAIN.id))]`), ['Sam Summit', id, 'Stony bTop/b', cash, null], 'a visit opens on their mountain, which isn’t kept on the visitor’s device');
  eq(v.errors, [], 'no errors visiting'); await v.page.close();
  // a mountain whose document is missing never opens as something else that could be saved over it
  await g.ev(`(() => { const sv = JSON.parse(localStorage.getItem(saveKey())); delete sv.map; localStorage.setItem(saveKey(), JSON.stringify(sv)); window.removeEventListener('pagehide', saveNow); })()`);
  await g.page.reload(); await g.reloaded();
  assert(await g.ev(`MOUNTAIN.id === 'juniper' && !onThisMountain()`), 'without its mountain the resort isn’t opened or saved over');
  eq(g.errors, [], 'no errors');
}
