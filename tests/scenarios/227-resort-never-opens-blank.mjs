// A guest's two hand-shaped resorts were wiped (Nov 13): a tab still on a version from before 4.9 grew one tree fewer
// on their mountain than the new version, so each save the other tab made failed the tree count, opened as a blank
// resort, and its autosave went over the real one, here and online. Now a save a few trees off opens with everything
// in it, one far off opens with the forest grown back, and a page older than the save it opens saves nothing over it.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(`state.resortName = 'Kept Resort'; saveNow()`);
  const look = `[state.resortName, world.lifts.length, world.trails.length, world.buildings.length, Math.round(state.cash), trees.alive.reduce((a, x) => a + (x ? 0 : 1), 0)]`;
  const before = await g.ev(look);
  assert(before[5] > 50, `the starter felled trees (${before[5]})`);
  eq(await g.ev(`JSON.parse(localStorage.getItem(saveKey())).gv === VERSION`), true, 'a save notes the version that made it');
  // (each change is made with the page no longer saving, as it would on the way out)
  // the forest grew a tree more or less since: everything comes back, the felled trees with it
  const tamper = (code) => g.ev(`(() => { leaving = true; const sv = JSON.parse(localStorage.getItem(saveKey())); ${code}; localStorage.setItem(saveKey(), JSON.stringify(sv)); })()`);
  await tamper('sv.n += 1');
  await g.page.reload(); await g.reloaded(); await g.click('#startBtn'); await g.wait(300);
  eq(await g.ev(look), before, 'a save a tree off opens with everything, felled trees and all');
  assert(await g.ev(`[...errSeen].some((m) => /didn’t match its mountain \\(kept\\)/.test(m))`), 'and the owner hears of it');
  // far off: still the whole resort, with the forest grown back rather than odd gaps
  await tamper('sv.n += 5000');
  await g.page.reload(); await g.reloaded(); await g.click('#startBtn'); await g.wait(300);
  const far = await g.ev(look);
  eq(far.slice(0, 5), before.slice(0, 5), 'a save far off keeps the resort');
  assert(far[5] < before[5] / 5, `with the forest grown back (${far[5]} felled, the lot's own, against ${before[5]})`);
  // a page older than the save: it opens the resort but saves nothing over it, here or online, and says to reload
  await tamper(`sv.gv = '99.0'; sv.clock.resortName = 'Newer Resort'`);
  await g.page.reload(); await g.reloaded();
  const at = await g.ev(`JSON.parse(localStorage.getItem(saveKey())).savedAt`);
  eq(await g.ev(`[staleFor, document.getElementById('updateBar').hidden, document.querySelector('#updateBar span').textContent.includes('saved by version 99.0'), state.resortName]`), ['99.0', false, true, 'Newer Resort'], 'an old page says to reload');
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(`state.cash -= 1000; saveNow(); CLOUD.lastUp = 0; cloudSave(false)`); await g.wait(300);
  eq(await g.ev(`JSON.parse(localStorage.getItem(saveKey())).savedAt`), at, 'and saves nothing over the newer save');
  eq(g.errors, [], 'no page errors');
  return 'a forest change no longer opens a resort blank, and an old page never saves over a newer save';
}
