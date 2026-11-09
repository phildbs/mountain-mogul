// Price complaints in the day report: which service, how many guests, the price charged next to the usual one,
// and a button to Prices when a price is above the usual. Older reports without the breakdown keep the plain line.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const day = await g.ev(`(() => { state.prices.food = 40; openDay(); ${SETUPS.finishDay};
    const r = state.lastReport, by = r.priceBy || {}, sum = Object.values(by).reduce((a, x) => a + x.n, 0) * AGENT;
    const txt = document.querySelector('#rpBody').textContent;
    return { phase: state.phase, price: r.complaints.price, sum, food: by.food || null, txt: (txt.match(/guests decided a price was too high.*?\\$\\d+\\)\\./) || [''])[0],
      btn: !!document.querySelector('#rpBody [data-rp=prices]') }; })()`);
  eq(day.phase, 'report', 'the day ends in a report');
  assert(day.price > 0 && day.sum === day.price, `the breakdown adds up to the count: ${JSON.stringify(day)}`);
  assert(day.food && day.food.price === 40 && day.food.ref === 16, `lodge meals carry the price and the usual: ${JSON.stringify(day.food)}`);
  assert(/lodge meals [\d,]+ \(\$40, usually \$16\)/.test(day.txt) && day.btn, `the note names the service and prices: ${day.txt}`);
  const open = await g.ev(`(() => { document.querySelector('#rpBody [data-rp=prices]').click(); return { phase: state.phase, sel: selected && selected.obj }; })()`);
  eq(open, { phase: 'closed', sel: 'prices' }, 'the button opens Prices for the night');
  const old = await g.ev(`(() => { const r = { ...state.lastReport, priceBy: undefined }; showReport(r, true);
    return { plain: /\\d+ guests decided a price was too high\\./.test(document.querySelector('#rpBody').textContent), btn: !!document.querySelector('#rpBody [data-rp=prices]') }; })()`);
  eq(old, { plain: true, btn: false }, 'an older report keeps the plain line');
}
