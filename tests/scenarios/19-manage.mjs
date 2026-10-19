// The Manage bar and its panels: lists with live status and quick controls, Money with history,
// and the old ways in (cash, weather, plan chip) landing on the right panel.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`world.trails[1].sm = { on: true, mode: 'auto', target: 30 }`);

  // trails list: one row per trail, quick controls change the trail
  await g.click('#manage [data-m=trails]'); await g.wait(200);
  eq(await g.ev(`[selected.kind, selected.obj, document.querySelectorAll('#sheet .lrow[data-k=trail]').length]`), ['manage', 'trails', 2], 'trails list shows each trail');
  eq(await g.ev(`document.querySelector('#manage [data-m=trails]').getAttribute('aria-current')`), 'true', 'Manage bar marks the open panel');
  const t0 = await g.ev(`world.trails[0].id`);
  await g.click(`[data-action=qOpen][data-id="${t0}"]`);
  eq(await g.ev(`world.trails[0].open`), false, 'close a trail from the list');
  assert(/Closed/.test(await g.ev(`$('sheet').innerText`)), 'row shows it closed');
  await g.click(`[data-action=qOpen][data-id="${t0}"]`);
  await g.click(`[data-action=qGroom][data-id="${t0}"]`);
  eq(await g.ev(`world.trails[0].groomed`), true, 'groom from the list');
  const t1 = await g.ev(`world.trails[1].id`);
  await g.click(`[data-action=qSm][data-id="${t1}"]`);
  eq(await g.ev(`world.trails[1].sm.mode`), 'always', 'snow guns step to Always');
  await g.click('[data-action=bulkSm][data-v=off]');
  eq(await g.ev(`world.trails[1].sm.mode`), 'off', 'bulk snow guns off');
  await g.click('[data-action=listFilter][data-k=trails][data-v=care]');
  await g.click('[data-action=listSort]');
  eq(await g.ev(`[listView.trails.filter, listView.trails.sort]`), ['care', 'name'], 'filter and sort');
  await g.click('[data-action=listFilter][data-k=trails][data-v=all]');

  // tapping a row opens the trail, with a way back
  await g.click(`.lrow[data-k=trail][data-id="${t0}"]`); await g.wait(200);
  eq(await g.ev(`[selected.kind, selected.obj.id, listBack]`), ['trail', t0, 'trails'], 'row opens the trail panel');
  await g.click('.back'); await g.wait(100);
  eq(await g.ev(`[selected.kind, selected.obj]`), ['manage', 'trails'], 'back to the list');

  // lifts and buildings, live during a day
  await g.ev(`openDay(); (() => { let n = 0; while (state.time < 660 && n < 90000) { simStep(1.5); n++; } })()`);
  await g.click('#manage [data-m=lifts]'); await g.wait(200);
  assert(/riding/.test(await g.ev(`$('sheet').innerText`)), 'lifts list shows riders');
  await g.click('#manage [data-m=blds]'); await g.wait(200);
  const bt = await g.ev(`$('sheet').innerText`);
  assert(/seats taken/.test(bt) && /Parking/.test(bt), 'buildings list shows seats and parking');
  await g.ev(SETUPS.finishDay);
  await g.click('#rpNext'); await g.wait(200);

  // the old ways in land on the right panels
  await g.click('#cashBox'); await g.wait(200);
  eq(await g.ev(`selected.obj`), 'money', 'cash opens Money');
  assert(/Last day|Last 1 day/i.test(await g.ev(`$('sheet').innerText`)), 'Money shows the history');
  eq(await g.ev(`state.history.length`), 1, 'one day of history');
  await g.click('.hist tr[data-action=pastReport]'); await g.wait(200);
  eq(await g.ev(`[$('report').hidden, $('rpNext').textContent]`), [false, 'Close'], 'a past report opens to read');
  await g.click('#rpNext'); await g.wait(100);
  eq(await g.ev(`[$('report').hidden, state.phase]`), [true, 'closed'], 'closing it changes nothing');
  await g.click('#tbWx'); await g.wait(200);
  eq(await g.ev(`selected.obj`), 'snow', 'weather opens Snow');
  await g.click('.tb-plan'); await g.wait(200);
  eq(await g.ev(`selected.obj`), 'ops', 'plan chip opens Operations');
  await g.ev(`resortTab = 'bank'; select({ kind: 'resort', obj: null })`);
  eq(await g.ev(`selected.obj`), 'money', 'old Resort panel links still work');

  // grouped menu
  await g.click('#badge'); await g.wait(100);
  assert(/This resort/i.test(await g.ev(`$('menu').innerText`)) && /★ \\d of 5/.test(await g.ev(`$('mGoalsN').textContent`)), 'menu is grouped and shows goals');
  // history survives a reload
  await g.ev(`closeMenu(); saveNow()`); await g.page.reload(); await g.reloaded();
  eq(await g.ev(`(state.history || []).length`), 1, 'history is saved');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
