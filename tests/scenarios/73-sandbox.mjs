// Sandbox: start any mountain with unlimited money and no goals, for building for the fun of it.
// Land is open from day one, the cash never runs out, it stays a sandbox through saves and starting
// over, and sandbox resorts stay off the leaderboards.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  assert(await g.ev(`!!document.querySelector('[data-slot=sandboxStart]')`), 'the first mountain card offers Sandbox');
  await g.click('[data-slot=sandboxStart]'); await g.wait(500);
  eq(await g.ev(`[state.started, state.sandbox, $('cash').textContent, $('resortSub').textContent.startsWith('Sandbox'), landOpen()]`), [true, true, 'Unlimited', true, true], 'a sandbox: unlimited money, land open from day one');
  eq(await g.ev(`(() => { $('badge').onclick(); const h = $('mGoalsMenu').hidden; closeMenu(); return h; })()`), true, 'no goals in the menu');

  // spend freely: the money never runs out
  await g.ev(SETUPS.juniperStarter);
  await g.ev(`(() => { for (const id of ['S1', 'S2', 'W2']) landTake(id, 'buy'); updateCash(); })()`);
  eq(await g.ev(`[state.cash >= SANDBOX_CASH / 2, $('cash').textContent, state.land.length]`), [true, 'Unlimited', 3], 'built a resort and bought land, still unlimited');
  eq(await g.ev(`(() => { state.cash = 5; updateCash(); return state.cash; })()`), 1e12, 'topped up whenever it runs low');
  eq(await g.ev(`checkGoals('day', { guests: 1e6, profit: 1e9 }).length`), 0, 'goals never complete');
  // a day runs and reports as usual
  await g.ev(SETUPS.midwinter); await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
  eq(await g.ev(`[typeof state.lastReport.profit, state.lastReport.guests > 0]`), ['number', true], 'the day still reports profit and guests');
  await g.ev(`(() => { $('report').hidden = true; nextDay(); openManage('money'); })()`); await g.wait(100);
  eq(await g.ev(`(() => { const d = state.seasonStats.daily; d.push({ ...d[0], d: d[0].d + 1 }); const h = seasonChartsHtml(); d.pop(); return [...h.matchAll(/data-k="(\\w)"/g)].map((m) => m[1]); })()`), ['g', 'p', 's'], 'no cash chart');
  assert(!/1,000,000,000/.test(await g.ev(`$('sheet').innerText`)), 'no trillion-dollar figures');

  // saved, off the boards, and starting over keeps it a sandbox
  eq(await g.ev(`(() => { const sv = JSON.parse(JSON.stringify(saveData(false))); applySave(sv); return [state.sandbox, summaryDoc().sandbox, summaryDoc().cash]; })()`), [true, true, null], 'saved as a sandbox, no cash in its summary');
  eq(await g.ev(`ranked('guests', MOUNTAIN.id).filter((m) => m.me).length`), 0, 'not on the leaderboard');
  eq(await g.ev(`(() => { $('mResetYes').onclick(); return [state.sandbox, world.lifts.length, $('cash').textContent]; })()`), [true, 0, 'Unlimited'], 'starting over keeps it a sandbox');

  // the picker: Sandbox or a normal start, per mountain
  await g.ev(`showTitle()`); await g.wait(300);
  await g.click('[data-slot=new]'); await g.wait(200);
  assert(await g.ev(`!!document.querySelector('[data-slot=pick][data-mt=juniper][data-sandbox]')`), 'each mountain in the picker offers Sandbox');
  await g.click('[data-slot=pick][data-mt=juniper]:not([data-sandbox])'); await g.wait(500);
  eq(await g.ev(`(() => { $('badge').onclick(); const h = $('mGoalsMenu').hidden; closeMenu(); return [state.sandbox, state.cash, h]; })()`), [false, await g.ev(`START_CASH`), false], 'a normal start is not a sandbox');
  eq(await g.ev(`ranked('guests', MOUNTAIN.id).length >= 0 && !summaryDoc().sandbox`), true, 'and counts for the boards');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
