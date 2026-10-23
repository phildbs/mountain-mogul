// Finding things: Parking and Events have their own sections (and buttons on the side bar), the
// Buildings list links to Parking, and the game points the way when it matters: a full main lot
// leads to Parking, and a holiday weekend with nothing booked leads to Events.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(2200);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`select(null)`);
  for (const k of ['parking', 'events']) assert(await g.ev(`!!$('manage').querySelector('[data-m=${k}]')`), `the side bar has ${k}`);
  await g.click('#manage [data-m=events]'); await g.wait(100);
  assert(/Torchlight|Book one/i.test(await g.ev(`$('sheet').innerText`)), 'Events lists what you can book');
  await g.ev(`openManage('prices')`); await g.wait(100);
  assert(!/Torchlight/.test(await g.ev(`$('sheet').innerText`)), 'and they’re no longer buried in Prices');
  // the main lot fills with no off-site parking: a nudge that opens Parking
  await g.ev(`(() => { select(null); state.cash = 5e6; openDay(); state.speed = 0; for (const s of stalls) s.car = -1; spawnCar(2); })()`); await g.wait(100);
  assert(/main lot is full/.test(await g.ev(`$('toast').textContent`)), 'a full lot says so');
  await g.click('#toast button'); await g.wait(200);
  eq(await g.ev(`selected && selected.obj`), 'parking', 'and its button opens Parking');
  await g.ev(`(() => { select(null); for (const s of stalls) s.car = null; spawnCar(1); let k = 0; while (state.phase === 'open' && k < 90000) { simStep(1.5); k++; } if (state.phase === 'report') nextDay(); })()`);
  eq(await g.ev(`state.nudges.lot`), true, 'it only says it once');
  // a holiday weekend coming up with nothing booked
  const d = await g.ev(`(() => { for (let d = 30; d < 120; d++) { state.day = d; state.nudges = null; const sat = nextSaturday(); if (sat != null && sat - d <= 6 && [sat - 1, sat, sat + 1, sat + 2].some((x) => holidayOf(dateOf(x))) && Object.keys(EVENTS).some((k) => eventSlot(k).days)) return d; } return null; })()`);
  assert(d != null, 'found a day before a holiday weekend');
  await g.ev(`(() => { state.day = ${d}; state.event = null; state.nudges = null; eventNudge(); })()`); await g.wait(3600);
  assert(/holiday weekend/.test(await g.ev(`$('toast').textContent`)), 'a holiday weekend suggests an event');
  await g.click('#toast button'); await g.wait(200);
  eq(await g.ev(`selected && selected.obj`), 'events', 'and opens Events');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
