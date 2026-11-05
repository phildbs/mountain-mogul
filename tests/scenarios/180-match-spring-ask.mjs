// King of the Mountain in spring: after an open day that lost money, a message offers weekends only, ending the
// season, or keeping going. At most once a week; weekends only goes back to normal when the next season starts.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const asked = () => g.ev(`!$('crisis').hidden && /lost/i.test($('crBody').innerText)`);
  const setup = (day, profit, guests = 120) => g.ev(`(() => { $('crisis').hidden = true; state.phase = 'closed'; state.summer = false; state.day = ${day};
    state.lastReport = { day: ${day - 1}, when: dateLabel(${day - 1}), season: state.season, guests: ${guests}, profit: ${profit} }; })()`);
  await g.ev(`(() => { try { localStorage.clear(); } catch (e) {} window.sentOrders = []; matchOrder = (kind, payload) => sentOrders.push({ kind, payload });
    matchPlay = { lobby: 'x', slot: 0 }; matchView = { me: true, pending: 0, players: [], resorts: [], lobby: { name: 'Test', status: 'running', day: 140, days: 168 } }; })()`);
  // not before April, and not after a day that made money or stayed closed
  await setup(100, -5000); await g.ev(`springAsk()`); eq(await asked(), false, 'not in winter');
  await setup(140, 2000); await g.ev(`springAsk()`); eq(await asked(), false, 'not after a day that made money');
  await setup(140, -3000, 0); await g.ev(`springAsk()`); eq(await asked(), false, 'not after a day it stayed closed');
  await g.ev(`matchView.me = false`); await setup(140, -5000); await g.ev(`springAsk()`); eq(await asked(), false, 'not when following a rival');
  await g.ev(`matchView.me = true`);
  // a losing spring day asks
  await setup(140, -5000); await g.ev(`springAsk()`);
  eq(await asked(), true, 'a losing spring day asks');
  const txt = await g.ev(`$('crBody').innerText`);
  assert(/\$5,000/.test(txt) && /120 guests/.test(txt), 'it says what the day lost and how many came: ' + txt);
  assert(await g.ev(`!!$('saWk') && !!$('saEnd') && !!$('saNo')`), 'three choices');
  await g.ev(`$('saWk').click()`); await g.wait(100);
  eq(await g.ev(`[$('crisis').hidden, opsState().plans.quiet.hours, opsState().plans.weekend.hours, opsState().springShut]`), [true, 'closed', 'full', 'full'], 'weekends only closes the Quiet season plan');
  eq(await g.ev(`sentOrders.map((o) => [o.kind, o.payload.set && o.payload.set.ops.plans.quiet.hours])`), [['ops', 'closed']], 'and sends it to the server');
  eq(await g.ev(`(() => { const shut = (d) => opsState().plans[planFor(d)].hours === 'closed', days = Array.from({ length: 14 }, (_, i) => 141 + i);
    return [days.filter((d) => shut(d)).every((d) => !peakDay(d)), days.filter((d) => !shut(d)).every((d) => peakDay(d)), days.some((d) => peakDay(d))]; })()`), [true, true, true], 'spring weekdays stay shut, weekends open');
  // once a week
  await setup(142, -4000); await g.ev(`springAsk()`); eq(await asked(), false, 'not again within a week');
  // a week later, already weekends only: just end the season or keep going
  await setup(147, -4000); await g.ev(`springAsk()`);
  eq(await asked(), true, 'asks again a week later');
  assert(await g.ev(`!$('saWk') && !!$('saEnd')`), 'already weekends only: no Weekends only button');
  assert(/already open on weekends/i.test(await g.ev(`$('crBody').innerText`)), 'and it says so');
  await g.ev(`$('saNo').click()`); await g.wait(50);
  eq(await g.ev(`[$('crisis').hidden, sentOrders.length]`), [true, 1], 'Keep going sends nothing');
  await setup(154, -4000); await g.ev(`springAsk()`);
  await g.ev(`$('saEnd').click()`); await g.wait(100);
  eq(await g.ev(`[!!matchView.seasonEnd, sentOrders[1].payload.seasonEnd, state.phase]`), [true, true, 'closed'], 'End the season sends the order; the server ends it');
  await setup(161, -4000); await g.ev(`springAsk()`); eq(await asked(), false, 'not once the season is ending');
  // the server, next season: weekends only was for last spring
  await g.ev(`(() => { state.summer = true; newSeason(); })()`);
  eq(await g.ev(`[opsState().plans.quiet.hours, 'springShut' in opsState()]`), ['full', false], 'the next season opens weekdays again');
  // a hand change in Operations keeps itself
  await g.ev(`(() => { const o = opsState(); o.plans.quiet.hours = 'closed'; o.springShut = 'full'; opsAction('opsHours', { dataset: { plan: 'quiet', v: 'short' } }); })()`);
  eq(await g.ev(`[opsState().plans.quiet.hours, 'springShut' in opsState()]`), ['short', false], 'a hand change forgets weekends only');
  await g.ev(`(() => { matchPlay = null; matchView = null; })()`);
  return 'spring prompt: weekends only, end the season, once a week, reset next season';
}
