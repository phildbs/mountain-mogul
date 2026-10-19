// Switching between mountains reloads onto the right terrain and never damages a save.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { render: true });
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(600);
  await g.click('[data-slot=new]'); await g.wait(100);
  await g.click('[data-slot=pick][data-mt=raven]'); await g.reloaded();
  eq(await g.ev(`MOUNTAIN.id + '/' + state.started + '/' + Math.round(state.cash)`), 'raven/true/2000000', 'started on Raven Peak');
  await g.ev(`(() => { const i = evalLift({x:0,z:56},{x:-5,z:-10},'double'); commitLift(i,'double'); computeNetwork(); syncLabels(); saveNow(); cloudSave(true); })()`); await g.wait(300);
  await g.ev(`$('mTitle').onclick()`); await g.wait(500);
  await g.click('[data-slot=new]'); await g.wait(100); await g.click('[data-slot=pick][data-mt=juniper]'); await g.reloaded();
  eq(await g.ev(`MOUNTAIN.id`), 'juniper', 'new Juniper mountain');
  await g.ev(`saveNow(); cloudSave(true); $('mTitle').onclick()`); await g.wait(500);
  const raven = await g.ev(`slots.list.find(s => s.mountain === 'raven').id`);
  await g.click(`[data-slot=play][data-id="${raven}"]`); await g.reloaded();
  eq(await g.ev(`MOUNTAIN.id + '/' + world.lifts.length`), 'raven/1', 'back on Raven with its lift');
  await g.ev(`$('mTitle').onclick()`); await g.wait(500);
  await g.click('#tutBtn'); await g.reloaded();
  eq(await g.ev(`MOUNTAIN.id + '/' + practice`), 'juniper/true', 'tutorial runs on Juniper');
  await g.ev(`$('mTitle').onclick()`); await g.reloaded();
  eq(await g.ev(`MOUNTAIN.id + '/' + world.lifts.length`), 'raven/1', 'leaving the tutorial returns to Raven intact');
  // leaderboards are per mountain; visiting a resort on the other mountain reloads and comes back
  await g.ev(`(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.users['other'] = { anon: false }; const j = d.rows.find(r => r.summary.mt === 'juniper'); d.rows.push({ ...j, id: 'theirs', owner: 'other', public: true, summary: { ...j.summary, name: 'Their Hill' } }); localStorage.setItem('FAKE_DB', JSON.stringify(d)); })()`);
  await g.ev(`loadBoard(true)`); await g.wait(300);
  eq(await g.ev(`ranked('guests', 'raven').some(m => m.id === 'theirs')`), false, 'Juniper resort not on the Raven board');
  eq(await g.ev(`ranked('guests', 'juniper').some(m => m.id === 'theirs')`), true, 'but on the Juniper board');
  await g.ev(`visitResort('theirs')`); await g.reloaded(); await g.wait(1500);
  eq(await g.ev(`MOUNTAIN.id + '/' + (visiting && visiting.name)`), 'juniper/Their Hill', 'visiting on Juniper');
  await g.click('#visitHome'); await g.reloaded();
  eq(await g.ev(`MOUNTAIN.id + '/' + world.lifts.length + '/' + JSON.parse(localStorage.getItem(slotKey(slots.active))).world.lifts.length`), 'raven/1/1', 'Raven save untouched after everything');
  assert(!g.errors.length, 'no page errors: ' + g.errors[0]);
  await g.page.close();
}
