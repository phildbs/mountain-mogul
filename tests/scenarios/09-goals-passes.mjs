// Goals tick off and show as stars; season passes sell on opening day and holders ski free.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  eq(await g.ev(`$('mGoals').textContent.trim()`), '☆☆☆☆☆ 5 goals to earn', 'title shows the goals to earn');
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);

  // passes: the panel estimates buyers before opening day
  await g.ev(`select({ kind: 'resort', obj: null })`); await g.wait(200);
  const est = await g.ev(`passBuyers(state.passPrice)`);
  assert(est > 50, `some people would buy passes (${est})`);
  assert(/would buy at this price/.test(await g.ev(`$('sheet').innerText`)), 'panel shows the estimate');
  await g.ev(`select(null)`);

  const cash0 = await g.ev(`state.cash`);
  await g.ev(`openDay()`);
  const sale = await g.ev(`({ sold: state.passSale.sold, price: state.passSale.price, rev: today.rev.passes, share: today.passShare })`);
  eq(sale.price, 399, 'default pass price');
  eq(sale.rev, sale.sold * 399, 'pass money arrives on opening day');
  assert(sale.share > 0 && sale.share <= 0.7, `some guests ski on passes (${sale.share})`);
  assert((await g.ev(`state.cash`)) - cash0 >= sale.rev - 5000, 'cash went up by the sale');
  await g.ev(SETUPS.finishDay);
  const r = await g.ev(`({ guests: state.lastReport.guests, passGuests: state.lastReport.passGuests, tickets: state.lastReport.rev.tickets, goals: state.lastReport.goals })`);
  assert(r.passGuests > 0, 'pass holders came');
  eq(r.tickets, (r.guests - r.passGuests) * 65, 'pass holders paid no ticket');
  assert(r.goals.includes('First chair'), 'first goal completed on the first day');
  assert(/Goal complete: First chair/.test(await g.ev(`$('rpBody').innerText`)), 'report shows the goal');
  assert(/Season passes \(\d+ sold\)/.test(await g.ev(`$('rpBody').innerText`)), 'report shows the pass sale');
  await g.click('#rpNext'); await g.wait(200);

  // no second sale in the same season
  await g.ev(`openDay()`);
  eq(await g.ev(`today.rev.passes`), 0, 'passes sell once a season');
  await g.ev(SETUPS.finishDay); await g.click('#rpNext'); await g.wait(200);

  // turning passes off for next season
  await g.ev(`select({ kind: 'resort', obj: null })`); await g.wait(200);
  for (let k = 0; k < 5; k++) await g.click('[data-action=passPrice][data-d="-50"]');
  eq(await g.ev(`state.passPrice`), 0, 'price stepped down to Off');

  // stars persist and show on the title and in the list
  await g.ev(`saveNow(); $('mTitle').onclick()`); await g.wait(500);
  // the first day can also earn other goals (a happy crowd, say), so count rather than assume one
  const n = await g.ev(`starsOf()`);
  assert(n >= 1, 'at least one star');
  eq(await g.ev(`$('mGoals').textContent.trim()`), `${'★'.repeat(n)}${'☆'.repeat(5 - n)} ${n} of 5 goals`, 'title shows the stars');
  assert(new RegExp(`${n} of 5 goals`).test(await g.ev(`$('titleSlots').innerText`)), 'mountain card shows the stars');
  await g.page.reload(); await g.reloaded();
  eq(await g.ev(`starsOf() + '/' + state.passPrice + '/' + state.passSale.sold`), `${n}/0/${sale.sold}`, 'goals and passes survive a reload');
  await g.click('#mGoals'); await g.wait(200);
  eq(await g.ev(`document.querySelectorAll('#glBody li.done').length`), n, 'goals list marks the done goals');
  assert(/Best so far: \d+ of 400 guests/.test(await g.ev(`$('glBody').innerText`)), 'goals list shows progress');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
