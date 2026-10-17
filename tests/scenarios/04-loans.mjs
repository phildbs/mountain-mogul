// Borrowing, interest, repaying, running out of cash, and the loan surviving a reload.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  eq(await g.ev(`creditLimit()`), 1000000, 'limit at average reputation');
  await g.ev(`borrow(500000)`);
  eq(await g.ev(`[state.debt, canBorrow()].join()`), '500000,500000', 'borrowed');
  const c0 = await g.ev(`state.cash`);
  await g.ev(`waitDay()`);
  const night = c0 - await g.ev(`state.cash`);
  assert(night > dailyInterestOf(500000) && night < 10000, `night cost includes interest and overhead (${night})`);
  await g.ev(`repay(250000)`);
  eq(await g.ev(`state.debt`), 250000, 'repaid');
  await g.ev(`(() => { state.cash = -100000; waitDay(); })()`);
  const od = await g.ev(`({ cash: state.cash, debt: Math.round(state.debt), rep: state.reputation })`);
  eq(od.cash, 0, 'bank covered the overdraft'); assert(od.debt > 350000, 'shortfall plus fee added'); assert(od.rep < 1, 'reputation dipped');
  await g.ev(`saveNow()`); await g.page.reload(); await g.reloaded(); await g.click('#startBtn'); await g.wait(400);
  eq(await g.ev(`Math.round(state.debt)`), od.debt, 'loan survives a reload');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
const dailyInterestOf = (d) => Math.round(d * 0.10 / 365);
