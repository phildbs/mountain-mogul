// Night costs: grooming is paid once, and snowmaking on closed nights reaches the next day report.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`(() => { state.passPrice = 0; for (const t of realTrails()) t.groomed = true; })()`);
  // first day, so the next one starts from a report
  await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
  for (let d = 0; d < 3; d++) {
    const cash0 = await g.ev(`state.cash`);
    await g.ev(`nextDay()`); await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
    const r = await g.ev(`({ profit: state.lastReport.profit, groom: state.lastReport.exp.grooming, cash: state.cash })`);
    assert(r.groom > 0, 'trails were groomed');
    assert(Math.abs(r.cash - cash0 - r.profit) < 2, `day ${d}: cash moved ${Math.round(r.cash - cash0)} but the report says ${r.profit}`);
  }
  // several closed nights of snowmaking before opening: every one reaches the report
  await g.ev(`(() => { for (const t of realTrails()) t.sm = { on: true, mode: 'auto', target: 200 }; })()`);
  const { paid, nights } = await g.ev(`(() => { let paid = 0, nights = 0; for (let k = 0; k < 12 && nights < 2; k++) { nextDay(); paid += state.nightCost.snowmaking; if (state.nightCost.snowmaking > 0) nights++; } return { paid, nights }; })()`);
  assert(nights >= 2, `snowmaking ran on closed nights: ${nights}`);
  await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
  eq(await g.ev(`state.lastReport.exp.snowmaking`), paid, 'report has every night of snowmaking');
  eq(await g.ev(`state.lastReport.smNights`), nights, 'nights counted');
  assert(new RegExp(`Snowmaking \\(${nights} nights\\)`).test(await g.ev(`$('rpBody').textContent`)), 'report says how many nights');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
