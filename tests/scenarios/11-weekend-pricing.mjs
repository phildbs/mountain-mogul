// Weekend and holiday tickets can be priced separately; guests pay (and are refunded) the day's price.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`(() => { state.passPrice = 0; select({ kind: 'resort', obj: null }); })()`); await g.wait(200);
  eq(await g.ev(`ticketOn(state.day)`), 65, 'one price until set');
  for (let k = 0; k < 4; k++) await g.click('[data-action=pricePeak][data-d="5"]');
  await g.click('[data-action=price][data-d="-5"]');
  eq(await g.ev(`state.ticket + '/' + state.ticketPeak`), '60/85', 'weekday $60, weekend $85');
  await g.ev(`select(null)`);
  // a Saturday at the weekend price, then a Tuesday at the weekday price
  for (const [dow, price] of [[6, 85], [2, 60]]) {
    await g.ev(`(() => { while (dateOf(state.day).getUTCDay() !== ${dow} || holidayOf(dateOf(state.day))) state.day++; refreshSnowState(todayWx()); openDay(); })()`);
    await g.ev(SETUPS.finishDay);
    const r = await g.ev(`({ guests: state.lastReport.guests, tickets: state.lastReport.rev.tickets, refunds: state.lastReport.rev.refunds || 0, refunded: state.lastReport.refunded || 0 })`);
    eq(r.tickets, r.guests * price, `day ${dow}: every guest paid ${price}`);
    eq(r.refunds, r.refunded * price, `day ${dow}: refunds at ${price}`);
    await g.click('#rpNext'); await g.wait(200);
  }
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
