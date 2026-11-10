// Snowmaking water: village water runs up to 120 guns; a painted pond adds guns and cheaper water. Short of water,
// every gun makes its share. Ponds dig the ground, save and load, fill back in, and undo.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter);
  await g.ev(`state.cash = 5e6; updateCash(false)`);
  const ht = `Array.from(HT)`, diff = (a, b) => a.reduce((m, v, k) => Math.max(m, Math.abs(v - b[k])), 0);

  // a flat open spot for the pond: every square of a 7x7 patch paintable
  const spot = await g.ev(`(() => { const blocks = areaBlocks(null);
    for (let z = 60; z > -90; z -= 3) for (let x = -90; x < 90; x += 3) {
      let ok = true; for (let dz = -4; dz <= 4 && ok; dz++) for (let dx = -4; dx <= 4 && ok; dx++) if (pondCellProblem(x + dx, z + dz, blocks)) ok = false;
      if (ok) return [x, z]; } return null; })()`);
  assert(spot, 'found open, flat ground for a pond');
  const [x, z] = spot;

  // the Snow panel offers it
  await g.ev(`select({ kind: 'manage', obj: 'snow' })`); await g.wait(50);
  assert(await g.ev(`!!$('sheet').querySelector('[data-action=pondTool]')`), 'Manage › Snow offers a pond');
  await g.ev(`openLandscape()`); await g.wait(50);
  await g.click('[data-action=landMode][data-v=pond]'); await g.wait(50);
  eq(await g.ev(`[state.tool, state.landMode, $('tClear').getAttribute('aria-pressed')]`), ['clear', 'pond', 'true'], 'Landscape › Pond opens it too');
  await g.click('[data-action=landMode][data-v=trees]'); await g.wait(50);
  await g.ev(`select({ kind: 'manage', obj: 'snow' })`); await g.ev(`setTool('explore')`); await g.ev(`select({ kind: 'manage', obj: 'snow' })`); await g.wait(50);
  await g.click('[data-action=pondTool]'); await g.wait(50);
  eq(await g.ev(`[state.tool, state.landMode]`), ['clear', 'pond'], 'pond tool open');

  // paint and dig
  const h0 = await g.ev(ht), cash0 = await g.ev(`state.cash`), undo0 = await g.ev(`undoStack.length`);
  await g.ev(`(() => { state.brushR = 3.6; stroke.active = true; strokeTo(new THREE.Vector3(${x}, heightAt(${x}, ${z}), ${z})); endStroke(); })()`);
  const info = await g.ev(`(() => { const i = areaDraftInfo(); return { n: i.n, guns: i.guns, cost: i.cost, problems: i.problems }; })()`);
  eq(info.problems, [], 'the painted pond has no problems');
  assert(info.n >= 16 && info.guns === Math.round(info.n * 1.5), `adds 1.5 guns a square (${info.n} squares, ${info.guns} guns)`);
  assert(/Dig it/.test(await g.ev(`$('sheet').innerText`)), 'the panel offers to dig it');
  await g.click('[data-action=areaBuild]'); await g.wait(100);
  const P = await g.ev(`(() => { const P = world.ponds[0]; return P && { name: P.name, n: P.cells.length, water: P.water, orig: P.orig.length, sel: selected && selected.kind, mesh: P.waterMesh.geometry.index.count, pump: !!P.pump }; })()`);
  assert(P && P.n === info.n && P.sel === 'pond' && P.mesh > 0 && P.pump, 'pond dug, with water and a pumphouse, and selected');
  eq(Math.round(await g.ev(`state.cash`)), Math.round(cash0 - info.cost), 'paid for');
  eq(await g.ev(`undoStack.length`), undo0 + 1, 'one Undo step');
  const bed = await g.ev(`(() => { const P = world.ponds[0]; let below = 0, n = 0; for (const k of P.cells) { const i = (keyZ(k) + HALF) * NV + keyX(k) + HALF; n++; if (HT[i] < P.water - 0.05) below++; } return below / n; })()`);
  assert(bed > 0.8, `the bed is under the water (${Math.round(bed * 100)}% of squares)`);
  const h1 = await g.ev(ht);
  assert(diff(h1, h0) > 0.5, 'the ground was dug');

  // a gondola over it hangs clear of the water, not the bed (a player's gondola dipped into a pond, Nov 8)
  const over = await g.ev(`(() => { const P = world.ponds[0], a = { x: ${x}, z: ${z} - 18 }, b = { x: ${x}, z: ${z} + 18 };
    const lay = liftLayout(a, b, 'gondola'); let low = Infinity;
    for (let k = 0; k < lay.sup.length - 1; k++) { const p = lay.sup[k], q = lay.sup[k + 1];
      for (let j = 0; j <= 12; j++) { const s = lerp(p.s, q.s, j / 12), px = a.x + lay.dx * s, pz = a.z + lay.dz * s;
        if (pondAt(px, pz)) low = Math.min(low, lerp(p.y, q.y, j / 12) - P.water * VEX); } }
    return { low, station: evalLift({ x: ${x}, z: ${z} }, b, 'gondola', false).problems.some((m) => m.includes('pond')) }; })()`);
  assert(over.low > 1.2 && over.low < Infinity, `the cable clears the water by ${over.low.toFixed(2)}`);
  assert(over.station, 'a station in the pond is refused');
  // and it spans the pond from dry ground, keeping to the slope as it was before digging rather than dipping into the
  // hole (Phil, Nov 10: a pond dug into a hillside pulled the cable down into it)
  for (const type of ['double', 'gondola']) {
    const span = await g.ev(`(() => { const P = world.ponds[0], a = { x: ${x}, z: ${z} - 18 }, b = { x: ${x}, z: ${z} + 18 }, orig = new Map(P.orig);
      const lay = liftLayout(a, b, '${type}'), pt = (s) => ({ x: a.x + lay.dx * s, z: a.z + lay.dz * s }), key = (q) => (Math.round(q.z) + HALF) * NV + Math.round(q.x) + HALF;
      const wetTowers = lay.sup.filter((p) => !p.term && (pondWaterAt(pt(p.s).x, pt(p.s).z) > -Infinity || orig.has(key(pt(p.s))))).length;
      let low = Infinity; for (let i = 1; i < 200; i++) { const s = i / 200, q = pt(s); if (!orig.has(key(q))) continue; low = Math.min(low, cableAt(lay, s) - orig.get(key(q)) * VEX); }
      return { wetTowers, low }; })()`);
    eq(span.wetTowers, 0, `${type}: no tower in the pond or on its dug banks`);
    assert(span.low > 0.5 && span.low < Infinity, `${type}: the cable stays above the ground as it was before the pond (${span.low.toFixed(2)})`);
  }
  eq(await g.ev(`(() => { world.lifts.push({ a: { x: ${x} + 30, z: ${z} }, b: { x: ${x} + 30, z: ${z} + 40 } }); const why = pondCellProblem(${x} + 27, ${z}, null); world.lifts.pop(); return why; })()`), 'too close to a lift station', 'no pond dug at a lift station');

  // a trail can't run into it; a building can't sit in it
  eq(await g.ev(`analyzeTrail(trailSamples([{ x: ${x}, z: ${z} - 12 }, { x: ${x}, z: ${z} + 12 }], 2.6)).problems.some((p) => p.includes('pond'))`), true, 'a trail through it is refused');

  // water: put snowmaking on both starter trails and run a cold night
  await g.ev(`(() => { for (const t of realTrails()) t.sm = { on: true, mode: 'always', target: 24 }; })()`);
  const night = (lo) => g.ev(`(() => { for (const t of realTrails()) t.machine = 0; const r = runSnowmaking(${lo}); return { ...r, made: realTrails().map((t) => t.machine) }; })()`);
  const withPond = await night(0);
  assert(withPond.want > 0 && withPond.ran === withPond.want, `all ${withPond.want} guns ran`);
  assert(withPond.pond === Math.min(withPond.want, P.n * 1.5 | 0) || withPond.pond === Math.min(withPond.want, Math.round(P.n * 1.5)), 'pond water used first');
  // without the pond: same snow, full price
  const saved = await g.ev(`JSON.stringify(saveData(false))`);
  await g.ev(`(() => { const P = world.ponds[0]; world.ponds = []; window.__p = P; })()`);
  const noPond = await night(0);
  await g.ev(`world.ponds = [__p]`);
  eq(noPond.made.map((v) => v.toFixed(3)), withPond.made.map((v) => v.toFixed(3)), 'the same snow either way');
  const share = withPond.pond / withPond.want, want = noPond.cost * (share * 0.55 + 1 - share);
  assert(Math.abs(withPond.cost - want) <= 2, `pond water is cheaper (${withPond.cost} vs ${noPond.cost})`);
  // short of water: make the trails want far more guns than there's water for
  const short = await g.ev(`(() => { const T = realTrails(); const keep = T.map((t) => t.an.len); T.forEach((t) => t.an.len = 600); for (const t of T) t.machine = 0;
    const r = runSnowmaking(0); const made = T.map((t) => t.machine); T.forEach((t, i) => t.an.len = keep[i]); return { ...r, made }; })()`);
  assert(short.want > short.ran && short.ran === 120 + Math.round(P.n * 1.5), `short of water: ${short.want} guns wanted, water for ${short.ran}`);
  const f = short.ran / short.want;
  assert(Math.abs(short.made[0] - withPond.made[0] * f) < 0.01, 'each gun makes its share of snow');
  await g.ev(`select({ kind: 'manage', obj: 'snow' })`); await g.wait(50);
  assert(/Village water/.test(await g.ev(`$('sheet').innerText`)), 'the Snow panel shows the water');

  // save and load: the pond and its ground come back
  await g.ev(`(() => { applySave(JSON.parse(${JSON.stringify(saved)})); afterLoad(); })()`);
  eq(await g.ev(`[world.ponds.length, world.ponds[0].water, world.ponds[0].cells.length]`), [1, P.water, P.n], 'pond loads');
  eq(diff(await g.ev(ht), h1) < 1e-4, true, 'with its ground');

  // fill it in: the ground goes back
  await g.ev(`select({ kind: 'pond', obj: world.ponds[0] })`); await g.wait(50);
  await g.click('[data-action=remove]'); await g.wait(50); await g.click('[data-action=removeYes]'); await g.wait(100);
  eq(await g.ev(`world.ponds.length`), 0, 'filled in');
  eq(diff(await g.ev(ht), h0) < 1e-4, true, 'the ground is back as it was');
  await g.click('#tUndo'); await g.wait(200);
  eq(await g.ev(`world.ponds.length`), 1, 'Undo brings the pond back');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
