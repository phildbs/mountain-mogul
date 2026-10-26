// Operations plans: the calendar picks a plan, the plan changes what runs and what it costs,
// guests notice cutbacks, the report explains it, and plans survive a reload.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);

  // the calendar: Dec 11 is quiet, Thu Jan 7 a weekday, Sun Jan 10 a weekend
  eq(await g.ev(`[dayKind(10), dayKind(37), dayKind(40), dayKind(100)]`), ['quiet', 'weekday', 'weekend', 'quiet'], 'day kinds');

  // an all-open weekday as the baseline
  await g.ev(`state.day = 37; state.lotSections = 2; buildLot()`);
  await g.ev(`openDay()`);
  eq(await g.ev(`[today.ops.kind, Math.floor(state.time), closeTime(), today.letdown]`), ['weekday', 480, 960, 0], 'all-open weekday runs the full day');
  await g.ev(SETUPS.finishDay);
  const full = await g.ev(`({ staff: state.lastReport.exp.staff, upkeep: state.lastReport.exp.upkeep, parking: state.lastReport.exp.parking, saved: state.lastReport.ops.saved })`);
  eq(full.parking, 700, 'two open parking sections cost $350 each');
  eq(full.saved, 0, 'nothing saved with everything open');
  await g.click('#rpNext'); await g.wait(200);

  // the plan editor, from the time bar
  await g.ev(`state.day = 37`);
  await g.click('.tb-plan'); await g.wait(200);
  assert(/Weekday plan/.test(await g.ev(`$('sheet').innerText`)), 'Operations tab shows the weekday plan');
  const lodge = await g.ev(`world.buildings[0].id`);
  await g.click('[data-action=opsFold][data-v=blds]'); await g.click('[data-action=opsFold][data-v=lifts]'); await g.wait(100); // lists start folded
  await g.click(`[data-action=opsBld][data-id="${lodge}"][data-v=lunch]`);
  await g.click('[data-action=opsStaff][data-v=lean]');
  await g.click('[data-action=opsHours][data-v=short]');
  await g.click('[data-action=opsLots][data-d="-1"]');
  const P = await g.ev(`state.ops.plans.weekday`);
  eq([P.bld[lodge], P.staff, P.hours, P.lots], ['lunch', 'lean', 'short', 1], 'plan edits are stored');
  assert(/Guests will notice|A few guests/.test(await g.ev(`$('sheet').innerText`)), 'editor warns that guests notice');

  // the only base lift can't be switched off: the day won't open, and the lift is left running
  await g.click(`[data-action=opsLift][data-v=off]`);
  await g.ev(`openDay()`);
  eq(await g.ev(`[state.phase, world.lifts[0].open, !!world.lifts[0].planOff]`), ['closed', true, false], 'a plan with no base lift does not open');
  await g.click(`[data-action=opsLift][data-v=slow]`);

  // a cut-back weekday
  await g.ev(`select(null)`);
  await g.ev(`openDay()`);
  const t = await g.ev(`({ kind: today.ops.kind, time: Math.floor(state.time), close: closeTime(), letdown: today.letdown, mode: liftMode(world.lifts[0]) })`);
  eq([t.kind, t.time, t.close, t.mode], ['weekday', 540, 930, 'slow'], 'short hours and a slow lift');
  assert(t.letdown > 0, `guests notice the cutbacks (${t.letdown})`);
  assert((await g.ev(`bldOpenNow(world.buildings[0])`)) === false, 'lunch-only lodge is shut at 9 AM');
  await g.ev(`(() => { let n = 0; while (state.time < 700 && n < 90000) { simStep(1.5); n++; } })()`);
  assert(await g.ev(`bldOpenNow(world.buildings[0])`), 'lunch-only lodge is open at noon');
  // a mid-day save and reload keeps the plan in force
  await g.ev(`saveNow()`); await g.page.reload(); await g.reloaded();
  await g.ev(`$('startBtn').click()`); await g.wait(400);
  eq(await g.ev(`[state.phase, runOps && runOps.kind, liftMode(world.lifts[0])]`), ['open', 'weekday', 'slow'], 'plan survives a reload mid-day');
  await g.ev(SETUPS.finishDay);
  const cut = await g.ev(`({ staff: state.lastReport.exp.staff, upkeep: state.lastReport.exp.upkeep, parking: state.lastReport.exp.parking, saved: state.lastReport.ops.saved })`);
  eq(cut.parking, 350, 'one open parking section');
  assert(cut.upkeep < full.upkeep, `lunch-only lodge costs less (${cut.upkeep} < ${full.upkeep})`);
  assert(cut.saved > 1000, `report shows a saving (${cut.saved})`);
  const text = await g.ev(`$('rpBody').innerText`);
  assert(/Operations · Weekday plan/.test(text) && /Lunch only/.test(text) && /Slow/.test(text), 'report has an operations section');
  assert(/Guests noticed the cutbacks|saved about/.test(text), 'report explains the plan');

  // Adjust the plan for tomorrow: moves to the night and opens the editor
  await g.click('#rpPlan'); await g.wait(200);
  eq(await g.ev(`[state.phase, resortTab, $('report').hidden]`), ['closed', 'ops', true], 'report link opens the plan editor overnight');

  // a one-day override, which the calendar forgets the next day
  await g.click('[data-action=opsDay][data-v=weekend]');
  eq(await g.ev(`planFor(state.day)`), 'weekend', 'override for one day');
  eq(await g.ev(`planFor(state.day + 1) === dayKind(state.day + 1)`), true, 'override is for that day only');

  // plans persist
  await g.ev(`saveNow()`); await g.page.reload(); await g.reloaded();
  eq(await g.ev(`[state.ops.plans.weekday.staff, state.ops.plans.weekday.hours]`), ['lean', 'short'], 'plans survive a reload');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
