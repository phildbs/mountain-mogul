// One-off balance check for summer 4.0 (not a scenario): a winter season, then a whole summer, on each mountain,
// with scenic rides only and with everything (a pavilion taking every booking, a zip line, a bike trail).
// node summer-bench.mjs [mountains] [full|short]   e.g. node summer-bench.mjs juniper,raven short   ('big' = the 26-lift resort)
import { startServer, launch, openGame } from './harness.mjs';
import { bigBuild } from './big-resort.mjs';
import { build as twinBuild } from './twin-resort.mjs';
import { SETUPS } from './harness.mjs';
const server = await startServer(), browser = await launch();
const mts = (process.argv[2] || 'juniper,raven,maple,twin').split(','), len = process.argv[3] || 'full';
const playSummer = (all) => `(async () => {
  state.sumLen = '${len}'; startSummer(); state.phase = 'closed';
  if (${all}) { window.__bk = demoBike().length; demoRides(); demoWedding(); $('report').hidden = true; }
  const bill = summerBillTotal(); let st = null, days = 0, owed = 0, away = 0, full = 0; const ex = {};
  while (summerLeft()) {
    const sum = state.sum;
    for (const o of sevList('offers').slice()) sevAnswer(o.id, true);
    const dow = dateOf(state.day).getUTCDay(); // a sensible full summer: open Friday to Sunday and on holidays
    if (state.sumLen === 'short' || [5, 6, 0].includes(dow) || summerStop().holiday) openDay();
    if (state.phase === 'open') { let n = 0; while (state.phase === 'open' && n++ < 200000) simStep(1.5); days++; }
    st = JSON.parse(JSON.stringify(sum.stats));
    if (state.phase === 'report') { const r = state.lastReport; away += r.turnedAway || 0; full += r.full ? 1 : 0; for (const [k, v] of Object.entries(r.exp || {})) if (typeof v === 'number') ex[k] = (ex[k] || 0) + v; } owed = Math.max(0, bill - sum.paid);
    if (state.phase === 'report') nextDay(); else waitDay();
    if (days % 6 === 0) await new Promise((r) => setTimeout(r));
  }
  const by = (st && st.by) || {}, r = (v) => Math.round((v || 0) / 1000);
  return { bill: r(bill), days, rev: r(st && st.revenue), exp: r(st && st.expenses), profit: r(st && st.profit), net: r((st ? st.profit : 0) - owed), visitors: st && st.visitors,
    scenic: r(by.tickets), bikes: r(by.bikes), events: r(by.events), zip: r(by.rides), food: r((by.food || 0) + (by.dining || 0)), rooms: r(by.lodging), laps: st && st.laps, evs: st && st.events, bikeBuilt: window.__bk, away, full, ex: Object.fromEntries(Object.entries(ex).filter(([, v]) => v > 500).map(([k, v]) => [k, r(v)])) };
})()`;
for (const mt of mts) {
  const g = await openGame(browser, server.url, { query: '?dev&summer=1', mountain: mt === 'big' ? 'juniper' : mt });
  await g.click('#startBtn'); await g.wait(400);
  if (mt === 'big') await g.ev(bigBuild); else if (mt === 'twin') await g.ev(twinBuild); else if (mt === 'raven') await g.ev(SETUPS.ravenStarter); else await g.ev(`(() => { select(null); buildStarter(); })()`);
  await g.ev(`(() => { for (let i = 0; i < 6; i++) growLot(); })()`); // room for a busy summer day
  const w = await g.ev(`(async () => { const r = await window.mmDev.simulate({ seasons: 1, keep: true }); return { profit: Math.round(r.log.reduce((a, x) => a + x.profit, 0) / 1000), days: r.log.length, summer: !!state.summer }; })()`);
  const snap = await g.ev(`JSON.stringify(saveData(false))`);
  const plain = await g.ev(playSummer(false));
  await g.page.evaluate((s) => window.__dbg(`applySave(JSON.parse(${JSON.stringify(s)}))`), snap);
  const all = await g.ev(playSummer(true));
  console.log(`${mt} (${len}): winter profit $${w.profit}k over ${w.days} days (in summer after: ${w.summer})\n  scenic only: ${JSON.stringify(plain)}\n  everything:  ${JSON.stringify(all)}\n  errors: ${JSON.stringify(g.errors)}`);
  await g.page.close();
}
await browser.close(); server.close();
