// Undo puts back overnight changes, newest first: ground, trees, trails and cash.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
const trees = `Array.from(trees.alive).reduce((a, b) => a + b, 0)`;
const ground = `Math.round(Array.from(HT).reduce((a, b) => a + b, 0) * 100)`;
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter);
  eq(await g.ev(`$('tUndo').disabled`), true, 'nothing to undo yet');
  const s0 = await g.ev(`({ cash: Math.round(state.cash), trees: ${trees}, ground: ${ground}, trails: world.trails.length })`);

  // clear trees, as a brush stroke does
  await g.ev(`(() => { setTool('clear'); state.landMode = 'clear'; pushUndo('clearing trees'); stroke.active = true;
    for (let x = -30; x <= -20; x += 1) strokeTo(new THREE.Vector3(x, heightAt(x, 20), 20)); endStroke(); })()`);
  const s1 = await g.ev(`({ cash: Math.round(state.cash), trees: ${trees} })`);
  assert(s1.trees < s0.trees && s1.cash < s0.cash, 'trees cleared, for a price');
  // level some ground
  await g.ev(`(() => { state.landMode = 'level'; pushUndo('leveling the ground'); stroke.active = true; stroke.target = trueY(-25, 30) + 2;
    for (let x = -30; x <= -20; x += 1) strokeTo(new THREE.Vector3(x, heightAt(x, 30), 30)); endStroke(); setTool('explore'); })()`);
  assert((await g.ev(ground)) !== s0.ground, 'ground reshaped');
  // a stroke that changes nothing leaves nothing to undo
  const n = await g.ev(`undoStack.length`);
  await g.ev(`(() => { setTool('clear'); state.landMode = 'clear'; pushUndo('clearing trees'); stroke.active = true; endStroke(); setTool('explore'); })()`);
  eq(await g.ev(`undoStack.length`), n, 'an empty stroke is not kept');

  // undo the leveling, then the clearing: back exactly where we were
  await g.click('#tUndo'); await g.wait(200);
  eq(await g.ev(`${trees}`), s1.trees, 'leveling undone, clearing still there');
  await g.ev(`$('tUndo').click()`); await g.wait(200);
  const back = await g.ev(`({ cash: Math.round(state.cash), trees: ${trees}, ground: ${ground}, trails: world.trails.length, started: state.started })`);
  eq(back, { ...s0, started: true }, 'trees, ground and cash all back');
  assert(/Undid clearing trees/.test(await g.ev(`$('toast').textContent`)), 'says what was undone');

  // remove the lodge from its panel, then Ctrl+Z brings it back
  await g.ev(`select({ kind: 'bld', obj: world.buildings[0] })`); await g.wait(100);
  await g.click('[data-action=remove]'); await g.wait(50); await g.click('[data-action=removeYes]'); await g.wait(200);
  eq(await g.ev(`world.buildings.length`), 0, 'lodge removed');
  await g.ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))`); await g.wait(200);
  eq(await g.ev(`[world.buildings.length, world.buildings[0].type, Math.round(state.cash)]`), [1, 'lodge', s0.cash], 'Ctrl+Z brought the lodge back, salvage and all');
  // opening for the day clears the history
  await g.ev(SETUPS.midwinter); await g.ev(`openDay()`);
  eq(await g.ev(`[undoStack.length, $('tUndo').disabled]`), [0, true], 'opening for the day clears undo');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
