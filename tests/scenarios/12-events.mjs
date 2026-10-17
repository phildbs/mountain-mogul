// Events: availability rules, booking, the crowd on the day, and clearing afterwards.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  // Tue Dec 15: the next Saturday (Dec 19) is in the holiday window
  await g.ev(`(() => { state.day = 14; state.passPrice = 0; refreshSnowState(todayWx()); select({ kind: 'resort', obj: null }); })()`); await g.wait(200);
  const why = await g.ev(`eventSlot('race').why`);
  assert(/black diamond/.test(why), `race needs a black diamond: ${why}`);
  assert(/spring/.test(await g.ev(`eventSlot('pond').why`)), 'pond skim waits for spring');
  eq(await g.ev(`eventSlot('torch').days`), [18], 'torchlight parade on Saturday Dec 19');
  const cash0 = await g.ev(`state.cash`);
  await g.click('[data-action=bookEvent][data-v=torch]'); await g.wait(200);
  eq(await g.ev(`state.cash`), cash0 - 20000, 'booking costs $20k');
  eq(await g.ev(`state.event.type`), 'torch', 'booked');
  assert(/is booked for/.test(await g.ev(`$('sheet').innerText`)), 'panel shows the booking');
  await g.ev(`bookEvent('pond')`);
  eq(await g.ev(`state.event.type`), 'torch', 'one event at a time');
  await g.ev(`select(null)`);
  // wait to the Saturday, open, and check the crowd came
  await g.ev(`(() => { while (state.day < 18) waitDay(); for (let k = 0; k < NV*NV; k++) NS[k] = 50; refreshSnowState(todayWx()); })()`);
  eq(await g.ev(`eventToday() && eventToday().type`), 'torch', 'event day');
  await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
  eq(await g.ev(`state.lastReport.event`), 'torch', 'report knows the event');
  assert(/Torchlight parade/.test(await g.ev(`$('rpBody').innerText`)), 'report mentions the event');
  await g.click('#rpNext'); await g.wait(200);
  eq(await g.ev(`state.event`), null, 'booking clears after the day');
  eq(await g.ev(`eventSlot('torch').why`), 'Already held this season.', 'once a season');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
