// From Adum888's feedback: season pass sales arrive on opening day, so every season's best day (and the Best day
// leaderboard) was simply opening day. Best and toughest days now leave pass sales out; older seasons are picked again.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
  const r = await g.ev(`(() => { const r = state.lastReport, st = state.seasonStats; return { passes: r.rev.passes, profit: r.profit, best: st.best.profit, worst: st.worst.profit, rec: state.records.bestDayProfit, ob: st.ob }; })()`);
  assert(r.passes > 0, 'passes sold on opening day');
  eq([r.best, r.worst, r.rec, r.ob], [r.profit - r.passes, r.profit - r.passes, r.profit - r.passes, 1], 'best day, toughest day and the record leave pass sales out');

  // An older save: its best day counted the pass sales. Loading picks it again from the season's days.
  const fixed = await g.ev(`(() => { const st = state.seasonStats; st.best = { day: state.day - 1, profit: st.best.profit + state.lastReport.rev.passes }; delete st.ob;
    fixBestDay(st); return [st.best.profit, st.ob]; })()`);
  eq(fixed, [r.profit - r.passes, 1], 'an old season picks its best day again');
  // And the same through a real reload.
  await g.ev(`(() => { const st = state.seasonStats; st.best.profit += 1e6; delete st.ob; saveNow(); })()`);
  await g.page.reload(); await g.reloaded();
  eq(await g.ev(`[state.seasonStats.best.profit, state.seasonStats.ob]`), [r.profit - r.passes, 1], 'repaired on load');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
