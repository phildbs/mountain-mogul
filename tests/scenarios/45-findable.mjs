// Finding things: Parking and Events have their own sections (on a computer, Operations, Prices and Events share
// one Business button with tabs), the
// Buildings list links to Parking, and the game points the way when it matters: a full main lot
// leads to Parking, and a holiday weekend with nothing booked leads to Events.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(2200);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`select(null)`);
  for (const k of ['parking', 'biz']) assert(await g.ev(`!!$('manage').querySelector('[data-m=${k}]')`), `the side bar has ${k}`);
  eq(await g.ev(`['ops', 'prices', 'events', 'evenings'].filter((k) => $('manage').querySelector('[data-m=' + k + ']'))`), [], 'Operations, Prices and Events share one Business button');
  await g.click('#manage [data-m=biz]'); await g.wait(100);
  eq(await g.ev(`[$('bizFly').hidden, [...$('bizFly').querySelectorAll('[data-m]')].map((b) => b.dataset.m)]`), [false, ['ops', 'prices', 'events', 'evenings', 'reputation', 'land']], 'Business opens Operations, Prices, Events, Evenings, Reputation and Land');
  await g.click('#bizFly [data-m=events]'); await g.wait(100);
  eq(await g.ev(`[selected && selected.obj, $('bizFly').hidden, $('manage').querySelector('[data-m=biz]').getAttribute('aria-current')]`), ['events', false, 'true'], 'a button there opens its panel, with the bar and Business still lit');
  assert(/Torchlight|Book one/i.test(await g.ev(`$('sheet').innerText`)), 'Events lists what you can book');
  await g.click('#manage [data-m=biz]'); await g.wait(100);
  eq(await g.ev(`[selected, $('bizFly').hidden]`), [null, true], 'Business again puts it all away');
  await g.click('#manage [data-m=trails]'); await g.wait(100);
  eq(await g.ev(`$('bizFly').hidden`), true, 'another button leaves the bar closed');
  await g.click('#manage [data-m=biz]'); await g.wait(100);
  eq(await g.ev(`[selected && selected.obj, $('bizFly').hidden]`), ['events', false], 'with another panel open, Business switches straight to it');
  await g.click('#manage [data-m=money]'); await g.wait(100);
  eq(await g.ev(`[selected && selected.obj, $('bizFly').hidden]`), ['money', true], 'and away again');
  // learning areas live in the Trail tool now
  await g.ev(`(() => { select(null); setTool('trail'); })()`); await g.wait(100);
  assert(/Learning area/.test(await g.ev(`$('sheet').innerText`)), 'the Trail tool offers learning areas');
  await g.click('[data-action=trailMode][data-v=area]'); await g.wait(100);
  eq(await g.ev(`[state.tool, state.landMode, $('tTrail').getAttribute('aria-pressed'), $('tClear').getAttribute('aria-pressed')]`), ['clear', 'area', 'true', 'false'], 'it paints with Trail lit');
  await g.click('#tClear'); await g.wait(100);
  eq(await g.ev(`[state.landMode, /Learning area/.test($('sheet').querySelector('.seg').innerText)]`), ['trees', false], 'Landscape is clearing and levelling only');
  await g.ev(`setTool('explore')`);
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
  // the help bulb can be turned off in the menu, and stays off
  const shown = () => g.ev(`$('tipsBtn').offsetParent !== null`);
  await g.ev(`select(null)`);
  assert(await shown(), 'the help bulb shows by default');
  await g.ev(`$('mTips').click()`); await g.wait(100);
  eq(await g.ev(`[$('mTipsV').textContent, localStorage.getItem('mm.tips')]`), ['Off', 'off'], 'the menu turns it off');
  eq(await shown(), false, 'and it’s hidden');
  await g.page.reload(); await g.reloaded(); await g.click('#startBtn'); await g.wait(400);
  eq(await shown(), false, 'still hidden after reloading');
  await g.ev(`$('mTips').click()`); await g.wait(100);
  assert(await shown(), 'and back on again');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
