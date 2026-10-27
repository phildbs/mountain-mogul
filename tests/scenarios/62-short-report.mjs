// The day report's two sizes: new players get the Summary (headline numbers, one money line, the tip
// and the top notes); Full shows everything. The choice is remembered, and established players start on Full.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.ev(`localStorage.removeItem('mm.rpView')`); // as a brand-new player
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`(() => { state.history = []; openDay(); })()`); await g.ev(SETUPS.finishDay); await g.wait(300);
  eq(await g.ev(`$('report').hidden`), false, 'the day report opens');
  eq(await g.ev(`localStorage.getItem('mm.rpView')`), 'short', 'a new player starts on the summary');
  const short = await g.ev(`$('rpBody').innerText`);
  assert(/Profit/i.test(short) && /Guests/i.test(short) && /Satisfaction/i.test(short), 'the headline numbers');
  assert(/Revenue [$][0-9,]+ · Expenses [$][0-9,]+/.test(short), 'revenue and expenses on one line: ' + short.slice(0, 300));
  assert(/See the full report/.test(short), 'a way to the full report');
  assert(!/Lift operations/.test(short), 'no line-by-line expenses');
  assert(await g.ev(`$('rpBody').querySelectorAll('.rp-short .rp-notes li').length <= 3`), 'at most three notes');
  // to the full report, and it sticks
  await g.click('#rpBody .rp-short [data-rpview=full]'); await g.wait(100);
  const full = await g.ev(`$('rpBody').innerText`);
  assert(/Lift operations/i.test(full) && /Total revenue/i.test(full), 'Full shows every line');
  eq(await g.ev(`[localStorage.getItem('mm.rpView'), $('rpBody').querySelector('[data-rpview=full]').getAttribute('aria-pressed')]`), ['full', 'true'], 'remembered, and the switch shows it');
  await g.ev(`showReport(state.lastReport, true)`); await g.wait(100);
  assert(/Lift operations/.test(await g.ev(`$('rpBody').innerText`)), 'the next report opens full');
  await g.click('#rpBody .rp-view [data-rpview=short]'); await g.wait(100);
  assert(!/Lift operations/.test(await g.ev(`$('rpBody').innerText`)), 'and back to the summary');
  // an established player with no choice made yet keeps the full report
  await g.ev(`(() => { localStorage.removeItem('mm.rpView'); state.history = new Array(14).fill(state.lastReport); showReport(state.lastReport, true); })()`); await g.wait(100);
  eq(await g.ev(`localStorage.getItem('mm.rpView')`), 'full', 'established players start on Full');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
