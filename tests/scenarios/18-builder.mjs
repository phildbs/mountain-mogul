// The mountain builder: design a mountain, start it, and the recipe travels with the save,
// the mountain list, the online summary and the custom leaderboard.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('[data-slot=new]'); await g.wait(100);
  await g.click('[data-slot=design]'); await g.wait(400);
  eq(await g.ev(`$('builder').hidden`), false, 'builder opens from the mountain list');
  assert(/Vertical/.test(await g.ev(`$('mbStats').innerText`)), 'preview shows stats');

  // settings change the design and its code; a pasted code loads a design
  const before = await g.ev(`$('mbCode').value`);
  await g.ev(`(() => { const r = document.querySelector('input[data-mb=vert]'); r.value = 9; r.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await g.click('[data-mb=bowl][data-v="1"]');
  eq(await g.ev(`[mb.vert, mb.bowl]`), [9, 1], 'slider and buttons set the recipe');
  assert((await g.ev(`$('mbCode').value`)) !== before, 'the code follows the settings');
  await g.ev(`$('mbCode').value = '7963-1382-621-K3P'; $('mbCode').dispatchEvent(new Event('input'))`);
  eq(await g.ev(`recipeCode(mb)`), '79631382621k3p', 'a pasted code loads');
  eq(await g.ev(`parseRecipe('nonsense')`), null, 'bad codes are refused');
  const seed = await g.ev(`mb.seed`);
  await g.click('#mbShuffle');
  assert((await g.ev(`mb.seed`)) !== seed, 'shuffle changes the land');
  await g.ev(`mb = parseRecipe('79631382621k3p'); renderBuilder()`);

  // start it: the page reloads onto the custom terrain
  await g.click('#mbStart'); await g.reloaded();
  const m = await g.ev(`({ id: MOUNTAIN.id, custom: MOUNTAIN.custom, cash: state.cash, name: state.resortName, badge: $('resortName').textContent, slot: activeSlot().mountain, goals: goalList().length, board: boardOf(MOUNTAIN.id) })`);
  eq([m.id, m.custom, m.slot, m.board], ['c:79631382621k3p', true, 'c:79631382621k3p', 'custom'], 'custom mountain is running and saved by recipe');
  eq(m.cash, 2200000, 'standard starting cash');
  eq(m.badge, m.name, 'badge shows the new mountain’s name');
  eq(m.goals, 5, 'custom goals');
  // the same recipe always makes the same land
  const h1 = await g.ev(`MOUNTAIN.height(0.4, 0.7).toFixed(4)`);
  eq(await g.ev(`makeCustom(parseRecipe('79631382621k3p')).height(0.4, 0.7).toFixed(4)`), h1, 'recipes are repeatable');
  // the summary carries the recipe, so visits and the custom leaderboard find it
  eq(await g.ev(`summaryDoc().mt`), 'c:79631382621k3p', 'online summary carries the recipe');
  await g.ev(`saveNow(); $('mTitle').onclick()`); await g.wait(500);
  assert(/Custom/.test(await g.ev(`$('mLevel').textContent`)), 'title shows a custom mountain');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
