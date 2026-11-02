// One-off refund for night lights and crew charged on days that never ended (before 2.81.1), with a popup; paid once only.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(2000);
  eq(await g.ev(`state.nightRebated`), 1, 'a new game is marked done straight away');
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`(() => { state.passPrice = 0; for (const k of ['weekday', 'weekend', 'quiet']) opsState().plans[k].night = 1200; for (const T of realTrails()) T.lit = true; })()`);
  for (let d = 0; d < 3; d++) { await g.ev(`openDay()`); await g.ev(SETUPS.finishDay); await g.ev(`nextDay()`); }
  const nights = await g.ev(`state.history.filter((r) => r.exp.night > 0).map((r) => r.exp.night)`);
  assert(nights.length === 3, 'three nights of night skiing: ' + JSON.stringify(nights));
  eq(await g.ev(`nightRebate().amount`), 0, 'normal nights: nothing owed');
  // pretend one night ran for days, as in the bug, and this save is from before the fix
  const r = await g.ev(`(() => {
    const h = state.history.filter((x) => x.exp.night > 0), bad = h[1], usual = [...h.map((x) => x.exp.night)].sort((a, b) => a - b)[1];
    bad.exp.night = 2643411; state.nightRebated = 0; const cash0 = state.cash; maybeNightRebate();
    return { cash0, cash: state.cash, usual, sorted: [h[0].exp.night, h[2].exp.night].sort((a, b) => a - b) };
  })()`);
  const paid = r.cash - r.cash0, fair = r.sorted[1]; // median of the two normal nights left
  assert(paid >= 2643411 - fair && paid < 2643411 - fair + 100, `refund ${paid}, expected about ${2643411 - fair}`);
  eq(await g.ev(`$('crisis').hidden`), false, 'popup shows');
  { const txt = await g.ev(`$('crBody').textContent`); assert(/We owe you/.test(txt) && /night crew/.test(txt), 'popup explains the refund: ' + txt.slice(0, 120)); }
  await g.click('#rebateOk'); await g.wait(100);
  eq(await g.ev(`$('crisis').hidden`), true, 'popup closes');
  const cash1 = await g.ev(`state.cash`);
  await g.ev(`maybeNightRebate()`);
  eq(await g.ev(`state.cash`), cash1, 'only paid once');
  eq(await g.ev(`saveData().clock.nightRebated`), 1, 'saved as done');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
