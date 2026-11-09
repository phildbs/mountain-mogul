// More people wanting to come than a day can hold (5,000 day skiers, hotel guests and condo owners) stopped the count
// with no word why, and a player thought it was a bug (Adum888). The day report now says the mountain was full.
import { openGame, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  // A normal day first: no note.
  await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
  const a = await g.ev(`({ full: state.lastReport.full, text: $('rpBody').textContent })`);
  assert(a.full === false && !/Full house/.test(a.text), 'an ordinary day is not full');
  // Far more wanting to come than fit (a small crowd plays the day, so the test stays quick).
  const ph = await g.ev(`(() => { const real = demandForDay; demandForDay = () => { real(); dayWant = MAX_G * AGENT * 2; return 60; }; nextDay(); openDay(); demandForDay = real; return state.phase; })()`); assert(ph === "open", `the next day opened (${ph})`);
  await g.ev(SETUPS.finishDay);
  const b = await g.ev(`({ full: state.lastReport.full, text: $('rpBody').textContent })`);
  assert(b.full === true && /Full house/.test(b.text) && /5,000/.test(b.text), `the report says the mountain was full (${b.full})`);
  assert(g.errors.length === 0, 'no page errors: ' + g.errors.join('; '));
  await g.page.close();
}
