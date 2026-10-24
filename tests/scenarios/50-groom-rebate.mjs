// One-off grooming refund for resorts that were charged twice before 2.33.2, with a popup; paid once only.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(2000);
  eq(await g.ev(`state.rebated`), 1, 'a new game is marked done straight away');
  eq(await g.ev(`$('crisis').hidden`), true, 'no popup for a new game');
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`(() => { state.passPrice = 0; for (const t of realTrails()) t.groomed = true; })()`);
  for (let d = 0; d < 3; d++) { await g.ev(`openDay()`); await g.ev(SETUPS.finishDay); await g.ev(`nextDay()`); }
  // pretend this save is from before the fix
  const r = await g.ev(`(() => { state.rebated = 0; const h = state.history.filter((x) => x.guests); const avg = h.reduce((a, x) => a + x.exp.grooming, 0) / h.length; const cash0 = state.cash; maybeRebate(); return { avg, cash0, cash: state.cash, days: state.seasonStats.days }; })()`);
  const paid = r.cash - r.cash0;
  assert(paid >= r.avg * 3 && paid < r.avg * 3 + 100, `refund ${paid} for 3 days at ${r.avg} a night`);
  eq(await g.ev(`$('crisis').hidden`), false, 'popup shows');
  { const txt = await g.ev(`$('crBody').textContent`); assert(/We owe you/.test(txt) && /twice/.test(txt), 'popup explains the refund: ' + txt.slice(0, 120)); }
  await g.click('#rebateOk'); await g.wait(100);
  eq(await g.ev(`$('crisis').hidden`), true, 'popup closes');
  const cash1 = await g.ev(`state.cash`);
  await g.ev(`maybeRebate()`);
  eq(await g.ev(`state.cash`), cash1, 'only paid once');
  eq(await g.ev(`saveData().clock.rebated`), 1, 'saved as done');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
