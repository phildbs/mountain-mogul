// The welcome offers two clear ways to begin. "Build me a starter resort" builds a double chair from
// the base, a green trail back down and a lodge, ready to open; one undo takes it all back.
// "Build it myself" goes to the lift tool. The choice is only offered on an empty mountain.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(2200);
  eq(await g.ev(`selected && selected.obj`), 'welcome', 'the welcome opens');
  eq(await g.ev(`[...document.querySelectorAll('#sheet .startpick .pick b')].map((b) => b.textContent)`), ['Build it myself', 'Build me a starter resort'], 'two clear choices');
  await g.wait(2500);
  assert(/for about \$[0-9,]+/.test(await g.ev(`$('sheet').innerText`)), 'with a price for the starter resort');
  const cash0 = await g.ev(`state.cash`);
  await g.click('#sheet [data-action=startAuto]'); await g.wait(400);
  const r = await g.ev(`({ lifts: world.lifts.filter((L) => L.fromBase).length, trails: realTrails().filter((t) => t.reachable && t.returns).map((t) => t.an.rating), lodges: world.buildings.filter((b) => b.type === 'lodge').length, cash: state.cash, status: $('tbSub').querySelector('.tb-st').textContent })`);
  eq(r.lifts, 1, 'a lift from the base');
  eq(r.trails, [0], 'a green trail back to the base');
  eq(r.lodges, 1, 'and a lodge');
  assert(r.cash < cash0 && cash0 - r.cash < cash0 * 0.6, `paid for, with money left over (${cash0 - r.cash} of ${cash0})`);
  eq(r.status, 'Ready for opening day!', 'ready to open');
  eq(await g.ev(`starterOffered()`), false, 'not offered again once built');
  // one undo takes it all back
  await g.ev(`undoLast()`); await g.wait(200);
  eq(await g.ev(`[world.lifts.length, realTrails().length, world.buildings.filter((b) => b.type === 'lodge').length, state.cash]`), [0, 0, 0, cash0], 'undo takes back the whole starter resort');
  // build it myself: the lift tool, with the suggested spot
  await g.ev(`select({ kind: 'advice', obj: 'welcome' })`); await g.wait(100);
  await g.click('#sheet [data-action=startSelf]'); await g.wait(200);
  eq(await g.ev(`[state.tool, draft.liftType, !!liftHint()]`), ['lift', 'double', true], 'Build it myself opens the lift tool with a suggestion');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
