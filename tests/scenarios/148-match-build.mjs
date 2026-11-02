// Building in a match: in your own running match the build tools work on your copy, and each new lift, trail
// or building goes to the match server as an order; prices go when they change. What the server can't do yet
// is refused with a message, the day can't be opened by hand, nothing can be undone, and nothing is saved on
// the device. A spectator, or a finished match, stays read only.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter);
  const save = await m.page.evaluate(() => window.__dbg('saveData')(false));
  // A second lift that fits this slice, to build in the match.
  const spot = await m.ev(`(() => { for (const [ax, az, bx, bz] of [[-8, 58, -6, -4], [-14, 56, -10, 2], [30, 56, 26, -2], [-20, 50, -12, 4]]) { const i = evalLift({ x: ax, z: az }, { x: bx, z: bz }, 'double'); if (!i.problems.length) return [ax, az, bx, bz]; } return null; })()`);
  await m.page.close();
  assert(spot, 'found a spot for a second lift');

  const g = await openGame(browser, url);
  const at = (min) => new Date(Date.now() + min * 60000).toISOString();
  const match = { lobbies: [{ id: 'M1', name: 'Build Cup', map: 'match', slots: 3, starts_at: at(-60), days: 168, day_minutes: 30, status: 'running', day: 2, prize: null }],
    players: [0, 1, 2].map((s) => ({ lobby_id: 'M1', slot: s, user_id: s === 1 ? 'user-B' : null, resort_name: ['Summit Ridge', 'Phil’s Peak', 'Valley View'][s] })),
    resorts: [0, 1, 2].map((s) => ({ lobby_id: 'M1', slot: s, day: 2, save, summary: { name: ['Summit Ridge', 'Phil’s Peak', 'Valley View'][s], profit: 1000 * s, guests: 100 } })), orders: [] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true }, 'user-C': { name: 'Watcher', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  const keysBefore = await g.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('skiTycoon')).sort().join());
  await g.click('#mpCard');
  await g.page.waitForSelector('[data-mp=open][data-id=M1]', { timeout: 10000 });
  await g.page.click('[data-mp=open][data-id=M1]');
  await g.reloaded();
  await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView)'), null, { timeout: 20000 });
  const ui = await g.ev(`({ visiting: !!visiting, play: document.body.classList.contains('matchplay'), lift: getComputedStyle(document.getElementById('tLift')).display !== 'none',
    clear: getComputedStyle(document.getElementById('tClear')).display !== 'none', go: getComputedStyle(document.getElementById('tbGo')).display !== 'none' })`);
  eq(ui, { visiting: false, play: true, lift: true, clear: false, go: false }, 'your own running match is played, with the build tools and without the ones the server can’t do');

  // Build a lift: it's on your screen at once, and the order goes to the server.
  const built = await g.ev(`(() => { setTool('lift'); const i = evalLift({ x: ${spot[0]}, z: ${spot[1]} }, { x: ${spot[2]}, z: ${spot[3]} }, 'double'); commitLift(i, 'double'); computeNetwork(); setTool('explore'); return world.lifts.length; })()`);
  eq(built, 2, 'the new lift shows straight away');
  await g.wait(500);
  const orders = () => g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.orders.map((o) => ({ kind: o.kind, slot: o.slot, what: o.payload.what, ticket: o.payload.ticket, a: o.payload.a })));
  let o = await orders();
  eq(o.map((x) => [x.kind, x.slot, x.what]), [['build', 1, 'lift']], 'the lift goes to the server as an order for your slice');
  eq([o[0].a.x, o[0].a.z], [spot[0], spot[1]], 'where you put it');
  assert(/1 change opens/.test(await g.page.innerText('#visitText')), 'the bar says it opens tomorrow');

  // Prices go when they change.
  await g.ev('state.ticket = 49; matchSendPrices()'); await g.wait(400);
  await g.ev('matchSendPrices()'); await g.wait(300); // no change: nothing more sent
  o = await orders();
  eq(o.filter((x) => x.kind === 'price').map((x) => x.ticket), [49], 'a new ticket price is sent once');

  // What the server can't do, the day, undo, and saving.
  const blocked = await g.ev(`(() => {
    const before = world.lifts.length, phase = state.phase; select({ kind: 'lift', obj: world.lifts[0] }); renderSheet();
    const rm = document.querySelector('#sheet [data-action=remove]'); if (rm) rm.click();
    const t1 = document.getElementById('toast').textContent; openDay(); const t2 = document.getElementById('toast').textContent; undoLast(); saveNow();
    return { removeBtn: !!rm, t1, t2, lifts: world.lifts.length === before, phase: state.phase === phase };
  })()`);
  assert(blocked.removeBtn && /isn’t part of King of the Mountain yet/.test(blocked.t1), `removing isn't sent, and says so (${blocked.t1})`);
  assert(/server plays every day/.test(blocked.t2) && blocked.phase, 'the day can’t be opened by hand');
  eq(blocked.lifts, true, 'nothing removed or undone');
  const keysAfter = await g.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('skiTycoon')).sort().join());
  eq(keysAfter, keysBefore, 'nothing is saved on the device');
  eq(g.errors, [], 'no page errors');

  // Back to the title, and a spectator stays read only.
  await g.click('#visitHome'); await g.reloaded();
  eq(await g.ev('!!matchPlay'), false, 'leaving ends the match');
  await g.ev(`__fakeSwitch('user-C', 'c@example.com')`); await g.wait(1200);
  await g.click('#mpCard'); await g.page.waitForSelector('[data-mp=open][data-id=M1]', { timeout: 10000 }); await g.page.click('[data-mp=open][data-id=M1]');
  await g.reloaded();
  await g.page.waitForFunction(() => window.__dbg('!!matchView'), null, { timeout: 20000 });
  eq(await g.ev('[!!matchPlay, !!(visiting && visiting.match)]'), [false, true], 'a spectator only watches');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
