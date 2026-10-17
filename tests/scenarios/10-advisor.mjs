// The day report's tip points at the biggest fixable loss, and the bank warns before it acts.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  // a Saturday: the small starter lot fills up
  await g.ev(`(() => { while (dateOf(state.day).getUTCDay() !== 6) state.day++; state.passPrice = 0; refreshSnowState(todayWx()); openDay(); })()`);
  await g.ev(SETUPS.finishDay); await g.wait(300);
  const r = await g.ev(`({ away: state.lastReport.turnedAway, tip: $('rpBody').querySelector('.rp-tip') ? $('rpBody').querySelector('.rp-tip').textContent : '' })`);
  assert(r.away > 0, `lot filled up (${r.away} turned away)`);
  assert(/parking/i.test(r.tip), `tip points at parking: "${r.tip}"`);
  const notes = await g.ev(`$('rpBody').querySelectorAll('.rp-notes li').length`);
  assert(notes >= 1, 'notes shown');
  await g.click('#rpNext'); await g.wait(200);

  // owe more than the limit, but not enough for the bank to call it in
  await g.ev(`(() => { borrow(1000000); state.cash = -150000; waitDay(); })()`); await g.wait(200);
  eq(await g.ev(`$('crisis').hidden`), true, 'no crisis yet');
  assert(/getting nervous/.test(await g.ev(`$('toast').textContent`)), 'bank warns');
  await g.ev(`select({ kind: 'resort', obj: null })`); await g.wait(200);
  assert(/bank is nervous/.test(await g.ev(`$('sheet').innerText`)), 'Resort panel shows the warning');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
