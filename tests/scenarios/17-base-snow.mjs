// The base area needs snow: bare, it hurts guests and stops lessons; base snowmaking fixes it.
// Staying closed for a week skips ahead, cheaply before opening day.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  assert((await g.ev(`baseZone().length`)) > 20, 'the base area is around the lift and lodge');

  // a bare base on an open day
  await g.ev(`for (const k of baseZone()) NS[k] = 0`);
  eq(await g.ev(`baseBare()`), true, 'base is bare');
  await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
  const r = await g.ev(`({ bare: state.lastReport.baseBare, mud: state.lastReport.complaints.mud, guests: state.lastReport.guests })`);
  eq(r.bare, true, 'report records the bare base');
  eq(r.mud, r.guests, 'every guest slogged through mud');
  const text = await g.ev(`$('rpBody').innerText`);
  assert(/base area was bare/i.test(text), 'report says so');
  assert(/Base snowmaking/.test(text), 'tip suggests base snowmaking');
  await g.click('#rpNext'); await g.wait(200);

  // install base snowmaking from the weather panel, then a cold night makes snow there
  await g.ev(`select({ kind: 'weather', obj: null })`); await g.wait(200);
  const cost = await g.ev(`baseSmCost()`), cash0 = await g.ev(`state.cash`);
  await g.click('[data-action=baseSmInstall]');
  eq(await g.ev(`state.baseSm.mode`), 'auto', 'base snowmaking installed');
  assert(Math.abs((cash0 - await g.ev(`state.cash`)) - cost) < 1, 'it cost what it said');
  await g.ev(`state.wx.days[1].lo = 5; state.wx.days[1].hi = 20; state.wx.days[1].type = 'sunny'; state.wx.days[1].snow = 0; endOfDaySnow(); nextDay()`);
  const after = await g.ev(`({ ran: state.nightCost.base, d: baseDepth() })`);
  assert(after.ran && after.d > 2, `guns ran and made base snow (${after.d.toFixed(1)}″)`);

  // staying closed for a week, before opening day: overhead at the summer rate
  await g.ev(`state.seasonStats.days = 0; state.baseSm.mode = 'off'; for (const t of world.trails) t.sm = null`);
  const d0 = await g.ev(`state.day`), c0 = await g.ev(`state.cash`);
  await g.ev(`select({ kind: 'weather', obj: null })`); await g.wait(200);
  await g.click('[data-action=waitWeek]'); await g.wait(200);
  const days = (await g.ev(`state.day`)) - d0, spent = c0 - await g.ev(`state.cash`);
  assert(days >= 1 && days <= 7, `skipped ahead (${days} days)`);
  const full = await g.ev(`dailyOverhead()`);
  assert(spent < full * days * 0.6, `pre-opening days cost less than full overhead (${Math.round(spent)} for ${days} days)`);
  eq(await g.ev(`state.phase`), 'closed', 'still closed, ready to open');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
