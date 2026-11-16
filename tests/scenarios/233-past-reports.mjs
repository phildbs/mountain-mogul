// Earlier day reports (feedback, Nov 16: "I can't see the previous days' summary page"). They were only reachable from a
// table under the charts in Money. Now Money's Last day opens the latest report, the table sits above the charts, and
// a report steps to the day before or after (buttons, or the ← → keys).
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  for (let d = 0; d < 3; d++) { await g.ev(`openDay(); state.speed = 0`); await g.ev(SETUPS.finishDay); if (d < 2) await g.ev(`nextDay()`); }
  const view = `(() => ({ title: $('rpTitle').textContent, open: !$('report').hidden, btn: $('rpNext').textContent,
    before: !!document.querySelector('#rpBody [data-rpstep="-1"]:not([disabled])'), after: !!document.querySelector('#rpBody [data-rpstep="1"]:not([disabled])') }))()`;
  const days = await g.ev(`state.history.map((h) => h.when)`);
  eq(days.length, 3, 'three days kept');
  // today's report: step back a day, then back again with the ← key
  eq(await g.ev(view), { title: days[2], open: true, btn: 'Start the next day', before: true, after: false }, 'today’s report steps back');
  await g.click('#rpBody [data-rpstep="-1"]');
  eq(await g.ev(view), { title: days[1], open: true, btn: 'Back to the latest day', before: true, after: true }, 'the day before');
  await g.page.keyboard.press('ArrowLeft');
  eq(await g.ev(view), { title: days[0], open: true, btn: 'Back to the latest day', before: false, after: true }, 'the ← key steps back too');
  await g.page.keyboard.press('ArrowRight');
  eq((await g.ev(view)).title, days[1], 'and → forward');
  // the main button goes back to today's report, which still starts the next day
  await g.click('#rpNext');
  eq(await g.ev(view), { title: days[2], open: true, btn: 'Start the next day', before: true, after: false }, 'back to the latest day');
  eq(await g.ev(`state.phase`), 'report', 'still on the report');
  await g.click('#rpNext');
  eq([await g.ev(`state.phase`), await g.ev(`$('report').hidden`)], ['closed', true], 'Start the next day carries on');
  // Money: Last day opens the latest report; the day list sits above the charts
  await g.ev(`select({ kind: 'manage', obj: 'money' })`);
  const money = await g.ev(`(() => { const t = $('sheet').innerText; return { last: !!document.querySelector('#sheet dd [data-action="pastReport"]'), order: t.indexOf('OPEN DAYS') >= 0 && t.indexOf('OPEN DAYS') < t.indexOf('BY DAY') }; })()`);
  eq(money, { last: true, order: true }, 'Last day can be tapped, and the day list comes before the charts');
  await g.click('#sheet dd [data-action="pastReport"]');
  eq(await g.ev(view), { title: days[2], open: true, btn: 'Close', before: true, after: false }, 'Last day opens the latest report');
  await g.click('#rpBody [data-rpstep="-1"]');
  eq((await g.ev(view)).title, days[1], 'and it steps back from there too');
  await g.click('#rpNext');
  eq([await g.ev(`$('report').hidden`), await g.ev(`state.phase`)], [true, 'closed'], 'Close closes it');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
