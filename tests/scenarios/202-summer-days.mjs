// Summer days (hidden until 4.0 behind ?summer=1): after the snow melts the summer is played as 24 days (or 12) at six
// stops from June to the fall colours. Guests buy a scenic ride, get off at the top, ride down and may eat at the base.
// The summer upkeep is spread over the days. Without the switch, summer is the quiet build phase it always was.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
const toSummer = `(() => { state.day = 150; state.phase = 'season'; nextDay(); })()`;
const playDay = `(() => { openDay(); let n = 0; while (state.phase === 'open' && n++ < 60000) simStep(1.5); return state.phase; })()`;
export default async function ({ browser, url }) {
  // --- switch off: nothing changes ---
  let g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(toSummer);
  eq(await g.ev(`[state.summer, state.sum, summerLeft(), $('tbGo').textContent, $('tbWait').hidden, planFor(state.day) === 'summer']`), [true, null, false, 'Start season 2', true, false], 'without the switch, summer is the build phase');
  const lump = await g.ev(`(() => { const c = state.cash, bill = Math.round(dailyOverhead() * OFFSEASON_DAYS * OFFSEASON_RATE); openDay(); return [Math.round(c - state.cash) === bill, state.season, state.summer]; })()`);
  eq(lump, [true, 2, false], 'and the next season starts with the whole summer bill');
  eq(g.errors, [], 'no page errors without the switch');
  await g.page.close();

  // --- switch on ---
  g = await openGame(browser, url, { query: '?summer=1' });
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(toSummer);
  const s0 = await g.ev(`({ n: state.sum.days.length, dows: state.sum.days.map((d) => dateOf(d).getUTCDay()).slice(0, 4), first: dateOf(state.day).getUTCMonth(), last: dateOf(state.sum.days[23]).getUTCMonth(), plan: planFor(state.day), go: $('tbGo').textContent, wait: $('tbWait').textContent, sub: $('tbSub').innerText })`);
  eq([s0.n, s0.dows, s0.first, s0.last, s0.plan, s0.go, s0.wait], [24, [4, 5, 6, 0], 5, 9, 'summer', 'Open for the day', 'Stay closed'], 'a long summer: Thursday to Sunday at six stops, June to October');
  assert(/Early summer · summer day 1 of 24/.test(s0.sub) && /Summer plan/.test(s0.sub), `the time bar says where the summer is (${s0.sub})`);
  // the Summer plan starts with the one base chair running and the ski-only buildings shut
  await g.ev(`(() => { const L = world.buildings[0]; for (const [dx, dz] of [[5, 0], [-5, 0], [0, 4], [0, -4], [8, 0], [-8, 0]]) { const i = evalBuilding('rental', L.x + dx, L.z + dz, 0); if (!i.problems.length) { commitBuilding(i, 'rental', L.x + dx, L.z + dz, 0); break; } } })()`);
  const plan = await g.ev(`(() => { const P = opsState().plans.summer; return { lift: liftModeIn(P, world.lifts[0]), blds: world.buildings.map((B) => [B.type, bldModeIn(P, B)]) }; })()`);
  eq(plan.lift, 'full', 'the base chair runs in the Summer plan');
  assert(plan.blds.some(([t]) => t === 'rental') && plan.blds.every(([t, m]) => (t === 'rental') === (m === 'closed')), `only ski buildings are shut for the summer (${JSON.stringify(plan.blds)})`);

  // a summer day: half way through, guests are up the mountain; a save and reload in the middle carries on
  await g.ev(`(() => { state.sum.wx = { type: 'sumsun', hi: 78, lo: 55, snow: 0, wind: 5 }; openDay(); let n = 0; while (state.phase === 'open' && state.time < 800 && n++ < 60000) simStep(1.5); })()`);
  const mid = await g.ev(`({ phase: state.phase, n: guests.length, sight: guests.every((x) => x.sight), skis: guests.some((x) => x.onSkis), sts: [...new Set(guests.map((x) => x.st))], top: guests.filter((x) => x.sawView).length })`);
  assert(mid.phase === 'open' && mid.n > 10 && mid.sight && !mid.skis && mid.top > 0, `summer guests are sightseers on foot (${JSON.stringify(mid)})`);
  await g.ev(`(() => { let n = 0; while (!world.lifts[0].topQ.length && state.phase === 'open' && n++ < 20000) simStep(1.5); })()`);
  const q = await g.ev(`(() => { const before = world.lifts[0].topQ.length; applySave(JSON.parse(JSON.stringify(saveData(true)))); return [before > 0, world.lifts[0].topQ.length === before, state.phase, summerNow()]; })()`);
  eq(q, [true, true, 'open', true], 'a save in the middle of a summer day keeps the line for the ride down');
  await g.ev(`(() => { let n = 0; while (state.phase === 'open' && n++ < 60000) simStep(1.5); })()`);
  const r = await g.ev(`(() => { const r = state.lastReport, bill = Math.round(dailyOverhead() * OFFSEASON_DAYS * OFFSEASON_RATE); return { phase: state.phase, summer: r.summer, guests: r.guests, sight: r.sightseers, refunded: r.refunded || 0, tickets: r.rev.tickets, price: svcPrice('scenic'), oh: r.exp.overhead, share: Math.round(bill / 24), groom: r.exp.grooming, days: state.sum.stats.days, winterDays: state.seasonStats.days, left: guests.length, txt: $('rpBody').innerText }; })()`);
  eq([r.phase, r.summer, r.left, r.groom, r.days], ['report', 'Early summer', 0, 0, 1], 'the day ends in a summer day report, everyone home');
  assert(r.guests > 20 && r.sight + r.refunded === r.guests, `every guest rode up and back (${r.guests} guests, ${r.sight} rode, ${r.refunded} refunded)`);
  eq(r.tickets, (r.guests - r.refunded) * r.price, 'each paid for a scenic ride');
  eq(r.oh, r.share, 'the day pays one share of the summer upkeep');
  assert(/Summer day report/i.test(r.txt) && /Scenic rides/.test(r.txt) && /Summer upkeep/.test(r.txt) && !/Trail grooming|Needs snow|skied/i.test(r.txt), 'the report is worded for summer');
  eq(g.errors, [], 'no page errors on a summer day');

  // on to the next day; a day spent closed still pays its share
  await g.ev(`nextDay()`);
  const d2 = await g.ev(`(() => { const c = state.cash, k = state.sum.k; waitDay(); return [k, state.sum.k, Math.round(c - state.cash) === Math.round(Math.round(dailyOverhead() * OFFSEASON_DAYS * OFFSEASON_RATE) / 24), state.phase]; })()`);
  eq(d2, [1, 2, true, 'closed'], 'staying closed moves on a day and pays that day’s upkeep');
  // a shorter summer, switched in the Summer panel
  await g.ev(`openManage('snow')`); await g.wait(150);
  assert(/Summer day\s+3 of 24/i.test(await g.ev(`$('sheet').innerText`)), 'the Summer panel counts the days');
  await g.ev(`$('sheet').querySelector('[data-action=sumLen][data-v=short]').click()`); await g.wait(100);
  const sh = await g.ev(`[state.sumLen, state.sum.days.length, state.sum.k, state.sum.days.slice(state.sum.k + 1).every((d) => [5, 6].includes(dateOf(d).getUTCDay()))]`);
  eq(sh, ['short', 13, 2, true], 'short: the days still to come are Fridays and Saturdays');
  // fall colours at the last stop
  eq(await g.ev(`(() => { const a = TREE_U.uFall.value; while (!summerStop().fall) waitDay(); return [a, TREE_U.uFall.value, fallColours()]; })()`), [0, 1, true], 'the trees turn for the last stop');
  // skip to winter: the days not played pay their upkeep, so the summer costs exactly the old bill less what it earned
  await g.ev(`openManage('snow')`); await g.wait(150);
  await g.ev(`$('sheet').querySelector('[data-action=sumSkip]').click()`); await g.wait(100);
  const end = await g.ev(`(() => { const c = state.cash, paid = state.sum.paid, bill = Math.round(dailyOverhead() * OFFSEASON_DAYS * OFFSEASON_RATE); $('sheet').querySelector('[data-action=sumYes]').click(); return [Math.round(c - state.cash) === bill - Math.round(paid), state.season, state.summer, state.sum, state.day, TREE_U.uFall.value]; })()`);
  eq(end, [true, 2, false, null, -16, 0], 'skipping to winter pays the rest of the upkeep and starts season 2');
  // a summer saved before summer days existed starts at its first day
  await g.ev(toSummer);
  eq(await g.ev(`(() => { const sv = JSON.parse(JSON.stringify(saveData(false))); delete sv.clock.sum; delete sv.clock.sumLen; sv.clock.day = 150; applySave(sv); return [state.summer, !!state.sum, state.sum && state.sum.k, summerLeft()]; })()`), [true, true, 0, true], 'an older summer save starts the summer days');
  eq(g.errors, [], 'no page errors');
  await g.page.close();

  // --- ?summerDemo=1: a starter resort already in summer, with jump buttons; nothing saved ---
  g = await openGame(browser, url, { query: '?summerDemo=1', mountain: 'fresh' });
  eq(await g.ev(`[MOUNTAIN.id, state.summer, summerLeft(), world.lifts.length > 0, !!$('sumDemo'), $('title').hidden]`), ['juniper', true, true, true, true, true], 'the summer preview opens a starter resort in summer');
  await g.click('#sumDemo [data-d=stop][data-v="5"]'); await g.click('#sumDemo [data-d=wx][data-v=sumrain]');
  eq(await g.ev(`[summerStop().name, dateOf(state.day).getUTCDay(), todayWx().type, TREE_U.uFall.value]`), ['Fall colours', 6, 'sumrain', 1], 'it jumps to the fall colours and changes the weather');
  await g.click('#sumDemo [data-d=wx][data-v=sumsun]'); await g.click('#sumDemo [data-d=play]');
  eq(await g.ev(`(() => { const p = state.phase; let n = 0; while (state.phase === 'open' && n++ < 60000) simStep(1.5); saveNow(); return [p, state.phase, state.lastReport.guests > 0, Object.keys(localStorage).some((k) => /juniperRidge/.test(k) && !/boot/.test(k))]; })()`), ['open', 'report', true, false], 'it plays a day and saves nothing');
  eq(g.errors, [], 'no page errors in the summer preview');
  return 'summer days: calendar, Summer plan, a scenic-ride day with a mid-day save, upkeep by the day, short summer, fall colours, skip to winter';
}
