// Joining a running match late on an empty slice: the server only makes your resort when it plays the next day.
// Until then you open the match on that empty slice, with the starting cash and the catch-up investment, and
// what you build goes to the server as orders. Once it has made your resort, that's shown, with nothing twice.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  const spot = await m.ev(`(() => { for (const [ax, az, bx, bz] of [[-8, 58, -6, -4], [-14, 56, -10, 2], [30, 56, 26, -2], [-20, 50, -12, 4]]) { const i = evalLift({ x: ax, z: az }, { x: bx, z: bz }, 'double'); if (!i.problems.length) return [ax, az, bx, bz]; } return null; })()`);
  assert(spot, 'found a spot for a lift');
  const cash0 = await m.ev('START_CASH');
  // What the server makes overnight: the empty slice with that lift on it.
  const made = await m.ev(`(() => { const i = evalLift({ x: ${spot[0]}, z: ${spot[1]} }, { x: ${spot[2]}, z: ${spot[3]} }, 'double'); commitLift(i, 'double'); computeNetwork(); return saveData(false); })()`);
  await m.ev(`applySave(null)`); await m.ev(SETUPS.juniperStarter);
  const rival = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();

  const g = await openGame(browser, url);
  const at = (min) => new Date(Date.now() + min * 60000).toISOString();
  const match = { lobbies: [{ id: 'M1', name: 'New Cup', map: 'match', slots: 3, starts_at: at(-50), days: 168, day_minutes: 15, status: 'running', day: 3 }],
    players: [{ lobby_id: 'M1', slot: 1, user_id: 'u-x', resort_name: 'Lone Peak' }, { lobby_id: 'M1', slot: 0, user_id: 'user-B', resort_name: 'Phil Peak', joined_day: 3 }],
    resorts: [{ lobby_id: 'M1', slot: 1, day: 3, save: rival, summary: { name: 'Lone Peak', profit: 5000, guests: 400 } }], orders: [] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await g.click('#mpCard');
  await g.page.waitForSelector('[data-mp=open][data-id=M1]', { timeout: 10000, state: 'attached' });
  await g.page.evaluate(() => document.querySelector('[data-mp=open][data-id=M1]').click());
  await g.reloaded();
  await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView)'), null, { timeout: 20000 });
  const a = await g.ev(`({ waiting: matchView.waiting, slot: matchPlay.slot, lifts: world.lifts.length, cash: state.cash, day: state.day, name: state.resortName, rivals: RIVAL_SKI.slices.map((s) => s.slot), toast: document.getElementById('toast').textContent })`);
  eq([a.waiting, a.slot, a.lifts, a.cash, a.name, a.rivals], [true, 0, 0, cash0 + 45000, 'Phil Peak', [1]], 'you open your empty slice at once, with the catch-up investment, beside your rival');
  eq(a.day, rival.clock.day, 'on the match’s day');
  assert(/Your resort opens when day 4 starts/.test(a.toast), `it says when your resort opens (${a.toast})`);
  // No What next? in King of the Mountain: no button, no welcome card on an empty slice, and it won't open.
  await g.wait(2200);
  eq(await g.ev(`[getComputedStyle($('tipsBtn')).display, selected && selected.kind, (select({ kind: 'advice', obj: null }), selected && selected.kind)]`), ['none', null, null], 'no What next? button, welcome card or panel in a match');

  // Build a lift: it goes to the server as an order.
  await g.ev(`(() => { setTool('lift'); const i = evalLift({ x: ${spot[0]}, z: ${spot[1]} }, { x: ${spot[2]}, z: ${spot[3]} }, 'double'); commitLift(i, 'double'); computeNetwork(); setTool('explore'); })()`);
  await g.wait(500);
  const o = await g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.orders.map((x) => [x.kind, x.slot, x.payload.what]));
  eq(o, [['build', 0, 'lift']], 'the lift goes to the server as an order for your slice');

  // The server plays day 4: it makes your resort with the lift, and marks the order done.
  await g.page.evaluate((sv) => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); const l = d.match.lobbies[0]; l.day = 4; l.starts_at = new Date(Date.now() - 70 * 60000).toISOString();
    d.match.resorts.push({ lobby_id: 'M1', slot: 0, day: 4, save: { ...sv, clock: { ...sv.clock, day: sv.clock.day + 1 } }, summary: { name: 'Phil Peak', profit: 0, guests: 0 } });
    d.match.orders.forEach((x) => { x.applied_day = 4; }); localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, made);
  await g.ev(`(() => { matchView.lobby.starts_at = new Date(Date.now() - 70 * 60000).toISOString(); return matchTick(); })()`); await g.wait(800);
  eq(await g.ev(`[matchView.waiting, world.lifts.length, matchView.lobby.day]`), [false, 1, 4], 'then your real resort is shown, with the lift once');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
