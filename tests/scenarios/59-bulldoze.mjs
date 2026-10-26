// Bulldoze (Landscape, or B): one tap removes one tree, one trail light (automatic ones too, and they stay
// gone across saves) or one placed lamp post or fire pit; Ctrl+Z puts it back.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 1e6`);
  // tap at a spot in the world, the way a player would: centre the view on it first
  const tapAt = (x, y, z) => g.ev(`(() => { cam.target.x = ${x}; cam.target.z = ${z}; updateCamera(); camera.updateMatrixWorld(); const q = project(${x}, ${y}, ${z}); onTap(q.x, q.y, 'mouse'); })()`);

  await g.page.keyboard.press('b'); await g.wait(100);
  eq(await g.ev(`[state.tool, state.landMode, $('sizes').hidden]`), ['clear', 'doze', true], 'B opens Bulldoze, with no brush sizes');
  assert(/Bulldoze/.test(await g.ev(`$('sheet').innerText`)), 'the Landscape panel shows Bulldoze');

  // an automatic trail light
  const n0 = await g.ev(`(() => { const t = realTrails()[0]; t.lit = true; rebuildLights(); return autoPoles.length; })()`);
  assert(n0 > 2, `a lit trail has automatic poles (${n0})`);
  const pole = await g.ev(`autoPoles[1]`);
  const cash0 = await g.ev(`state.cash`);
  await tapAt(pole.x, await g.ev(`heightAt(${pole.x}, ${pole.z}) + 1.2`), pole.z);
  eq(await g.ev(`[autoPoles.length, world.noPoles.length, state.cash]`), [n0 - 1, 1, cash0], 'one tap removes that pole, for free');
  eq(await g.ev(`autoPoles.some((q) => Math.hypot(q.x - ${pole.x}, q.z - ${pole.z}) < 0.5)`), false, 'the tapped one');
  eq(await g.ev(`realTrails()[0].lit`), true, 'the trail stays lit');
  // it stays gone when the resort is saved and loaded
  await g.ev(`(() => { const w = JSON.parse(JSON.stringify(saveData(false).world)); rebuildWorld(w); })()`);
  eq(await g.ev(`autoPoles.length`), n0 - 1, 'still gone after loading the save');
  // undo puts it back
  await g.ev(`undoLast()`);
  eq(await g.ev(`[autoPoles.length, world.noPoles.length]`), [n0, 0], 'Ctrl+Z puts it back');
  await g.ev(`(() => { state.landMode = 'doze'; setTool('clear'); })()`);

  // a single tree
  const tree = await g.ev(`(() => { const L = world.lifts[0]; for (let k = 0; k < trees.n; k++) if (trees.alive[k] && trees.play[k] && Math.hypot(trees.x[k] - L.a.x, trees.z[k] - L.a.z) > 30 && Math.hypot(trees.x[k] - L.a.x, trees.z[k] - L.a.z) < 60) return { k, x: trees.x[k], y: trees.y[k] + trees.s[k] * 0.6, z: trees.z[k] }; })()`);
  const alive0 = await g.ev(`trees.alive.reduce((a, v) => a + v, 0)`), cash1 = await g.ev(`state.cash`);
  await tapAt(tree.x, tree.y, tree.z);
  eq(await g.ev(`[trees.alive[${tree.k}], trees.alive.reduce((a, v) => a + v, 0), state.cash]`), [0, alive0 - 1, cash1 - 250], 'one tap clears exactly that tree, at the usual price');

  // a lamp post you placed
  const lamp = await g.ev(`(() => { const lodge = world.buildings.find((B) => B.type === 'lodge');
    for (let r = 5; r <= 30; r += 1) for (let a = 0; a < 24; a++) { const x = Math.round((lodge.door.x + Math.cos(a / 24 * 6.283) * r) * 2) / 2, z = Math.round((lodge.door.z + Math.sin(a / 24 * 6.283) * r) * 2) / 2;
      const v = evalBuilding('lamp', x, z, 0, false); if (!v.problems.length) { commitBuilding(v, 'lamp', x, z, 0); computeNetwork(); const B = world.buildings.find((b) => b.type === 'lamp'); return { x: B.x, y: B.baseY + 1.2, z: B.z, spent: B.spent }; } } })()`);
  const cash2 = await g.ev(`state.cash`);
  await tapAt(lamp.x, lamp.y, lamp.z);
  eq(await g.ev(`[world.buildings.some((B) => B.type === 'lamp'), state.cash]`), [false, cash2 + Math.round(lamp.spent * 0.25)], 'a placed lamp post comes out with a quarter back');

  // only overnight
  await g.ev(`(() => { setTool('explore'); state.phase = 'open'; setTool('clear'); })()`);
  eq(await g.ev(`state.tool`), 'explore', 'no bulldozing while the resort is open');
  await g.ev(`state.phase = 'closed'`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
