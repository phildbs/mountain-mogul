// What guests will pay grows with the resort: a starter hill stays at $65, a giant resort can charge about $120.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
import { bigBuild } from '../big-resort.mjs';
import { splitSkiers } from '../../match/market.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  // Demand on a quiet Tuesday, with the daily luck fixed, at a given weekday price.
  const demandAt = `((p) => { const r = Math.random; Math.random = () => 0.5; const t = state.ticket, pk = state.ticketPeak;
    state.ticketPeak = null; state.ticket = p; while (dateOf(state.day).getUTCDay() !== 2 || holidayOf(dateOf(state.day))) state.day++;
    const d = demandForDay(); state.ticket = t; state.ticketPeak = pk; Math.random = r; return d; })`;
  eq(await g.ev(`fairTicket()`), 65, 'a starter hill expects $65');
  const small = await g.ev(`[${demandAt}(65), ${demandAt}(120)]`);
  assert(small[1] < small[0] * 0.3, `a starter hill at $120 loses most guests (${small})`);
  await g.ev(`(() => { state.passPrice = 0; select({ kind: 'resort', obj: null }); })()`); await g.wait(200);
  assert(/charge about \$65\./.test(await g.ev(`document.body.innerText`)), 'prices panel shows $65 for a starter hill');
  await g.ev(`select(null)`);
  await g.ev(bigBuild);
  const fair = await g.ev(`fairTicket()`);
  assert(fair >= 115 && fair <= 125, `a giant resort expects about $120 (got ${fair})`);
  const big = await g.ev(`[${demandAt}(65), ${demandAt}(120)]`);
  if (process.env.SHOW) console.log(`fair ${fair}, starter demand $65/$120: ${small}, giant: ${big}`);
  assert(big[1] > big[0] * 0.7 && big[1] * 120 > big[0] * 65, `a giant resort keeps most guests at $120 and earns more (${big})`);
  // In a match each resort is judged against its own usual price: a giant at $120 still wins most of the
  // town's skiers from a starter hill at $65, and the starter hill keeps a fair share of its own.
  const [hill, giant] = splitSkiers([small[0], big[1]]);
  assert(giant > hill && hill > small[0] * 0.2, `match market: starter $65 gets ${hill}, giant $120 gets ${giant}`);
  await g.ev(`(() => { state.reputation = 0.5; })()`);
  assert(await g.ev(`fairTicket()`) < fair, 'a poor reputation lowers what guests will pay');
  // The parking tip says where to close sections, not just that they should be closed.
  const tip = await g.ev(`opsTips({ ops: { kind: 'quiet', dayKind: 'weekday', lifts: [], blds: [], letdown: 0, lots: { open: 4, total: 4, peak: 30, away: 0 } }, exp: {} }).map((t) => t[1]).join(' ')`);
  assert(/Manage › Operations/.test(tip) && /stay built/.test(tip), `parking tip points to Operations: ${tip}`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
