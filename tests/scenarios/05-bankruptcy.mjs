// Rock bottom: the investor offer, the 10% cut, the buyout, and foreclosure.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`(() => { borrow(1000000); state.cash = -800000; waitDay(); })()`); await g.wait(200);
  eq(await g.ev(`$('crisis').hidden ? '' : $('crTitle').textContent`), 'A stranger in a fur coat', 'investor offer');
  await g.click('#crYes'); await g.wait(200);
  eq(await g.ev(`[state.debt, state.investor.share, state.investorUsed].join()`), '0,0.1,true', 'loan paid off for 10%');
  await g.ev(`(() => { state.cash = 500000; openDay(); })()`); await g.ev(SETUPS.finishDay);
  const cut = await g.ev(`state.lastReport.exp.investor`);
  assert(cut > 0, 'investor takes a cut of the day');
  await g.click('#rpNext'); await g.wait(200);
  await g.ev(`(() => { state.cash = 5e6; select({ kind: 'resort', obj: null }); })()`); await g.wait(200);
  await g.click('[data-action=buyout]'); await g.wait(200);
  eq(await g.ev(`state.investor`), null, 'bought out');
  await g.ev(`(() => { state.cash = -3e6; waitDay(); })()`); await g.wait(200);
  eq(await g.ev(`state.bankrupt + '/' + $('crTitle').textContent`), 'true/Foreclosed', 'second collapse forecloses');
  await g.ev(`saveNow()`); await g.page.reload(); await g.reloaded();
  assert(/Foreclosed/.test(await g.ev(`$('titleSlots').innerText`)), 'list shows Foreclosed');
  await g.click('#startBtn'); await g.wait(500);
  eq(await g.ev(`$('crisis').hidden`), false, 'still foreclosed after reload');
  await g.click('#crRestart'); await g.wait(400);
  eq(await g.ev(`[state.bankrupt, state.investorUsed, Math.round(state.cash)].join()`), 'false,false,2500000', 'fresh start');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
