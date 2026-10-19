// Maple Notch: picked from the mountain list, builds its own small hill with its own goals and milder weather.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('[data-slot=new]'); await g.wait(100);
  assert(/Maple Notch/i.test(await g.ev(`$('titleSlots').innerText`)), 'picker lists Maple Notch');
  await g.click('[data-slot=pick][data-mt=maple]'); await g.reloaded();
  const m = await g.ev(`({ id: MOUNTAIN.id, cash: state.cash, vert: ft(MOUNTAIN.summitH) - ft(MOUNTAIN.baseH), base: ft(MOUNTAIN.baseH), level: $('mLevel').textContent, goals: goalList().map((G) => G.id) })`);
  eq([m.id, m.cash], ['maple', 2200000], 'Maple Notch with its starting cash');
  assert(m.vert > 600 && m.vert < 900 && m.base < 1500, `a small, low hill (${m.base} ft base, ${m.vert} ft vertical)`);
  assert(/Easy/.test(m.level), 'labelled easy');
  eq(m.goals, ['firstDay', 'learn', 'guns', 'crowd350', 'profit'], 'its own goals');
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.mapleStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
  const r = await g.ev(`({ guests: state.lastReport.guests, goals: state.lastReport.goals })`);
  assert(r.guests > 50, `guests came (${r.guests})`);
  assert(r.goals.includes('First chair'), 'first goal on the first day');
  // milder: the same calendar day runs warmer than the climate table, and freezing rain is likelier
  eq(await g.ev(`MOUNTAIN.weather.temp`), 4, 'milder climate');
  await g.ev(`saveNow(); $('mTitle').onclick()`); await g.wait(500);
  assert(/Maple Notch/i.test(await g.ev(`$('titleSlots').innerText`)), 'saved mountain listed as Maple Notch');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
