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
  eq(ui, { visiting: false, play: true, lift: true, clear: true, go: false }, 'your own running match is played, with the build tools and without the ones the server can’t do');

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
    const rm = document.createElement('button'); rm.dataset.action = 'waitWeek'; document.getElementById('sheet').appendChild(rm); rm.click(); rm.remove();
    const t1 = document.getElementById('toast').textContent; openDay(); const t2 = document.getElementById('toast').textContent; undoLast(); saveNow();
    return { removeBtn: !!rm, t1, t2, lifts: world.lifts.length === before, phase: state.phase === phase };
  })()`);
  assert(blocked.removeBtn && /isn’t part of King of the Mountain/.test(blocked.t1), `waiting a week isn't part of matches, and says so (${blocked.t1})`);
  assert(/server plays every day/.test(blocked.t2) && blocked.phase, 'the day can’t be opened by hand');
  eq(blocked.lifts, true, 'nothing moved or undone');
  const keysAfter = await g.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('skiTycoon')).sort().join());
  eq(keysAfter, keysBefore, 'nothing is saved on the device');
  eq(g.errors, [], 'no page errors');

  // Parking: a new lot section is an order too.
  const lot0 = await g.ev('state.lotSections');
  await g.ev(`state.cash = 5e6; growLot(null, 0)`); await g.wait(400);
  eq(await g.ev('state.lotSections'), lot0 + 1, 'the lot grows on your screen');
  o = await orders();
  eq(o.filter((x) => x.what === 'lot').length, 1, 'and goes to the server');
  // The landscape tool: clearing trees with the brush, and the bulldozer on one tree.
  const tr = await g.ev(`(() => {
    setTool('clear'); state.landMode = 'trees'; const before = trees.alive.reduce((a, x) => a + x, 0);
    let spot = null; for (let x = -30; x <= 30 && !spot; x += 3) for (let z = 20; z <= 60 && !spot; z += 3) { let n = 0; treesInBrush({ x, z }, 3, () => n++); if (n > 3 && inProperty(x, z)) spot = { x, z }; }
    stroke.active = true; clearAt(spot); endStroke(); stroke.active = false;
    const after = trees.alive.reduce((a, x) => a + x, 0); setTool('explore');
    return { cleared: before - after, spot };
  })()`);
  assert(tr.cleared > 3, `the brush clears trees on your screen (${tr.cleared})`);
  await g.wait(400);
  o = await g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.orders.filter((x) => x.payload.what === 'trees').map((x) => x.payload.ks.length));
  eq(o, [tr.cleared], 'and the exact trees go to the server');
  const blocked2 = await g.ev(`(() => { const b = document.createElement('button'); b.dataset.action = 'landMode'; b.dataset.v = 'area'; select({ kind: 'manage', obj: 'snow' }); document.getElementById('sheet').appendChild(b); b.click();
    const s = document.createElement('button'); s.dataset.action = 'waitWeek'; document.getElementById('sheet').appendChild(s); s.click(); return [state.landMode, state.tool, document.getElementById('toast').textContent]; })()`);
  assert(blocked2[0] === 'area' && blocked2[1] !== 'shape' && /isn’t part of King of the Mountain/.test(blocked2[2]), `painting areas works in matches; waiting a week isn't, and says so (${blocked2})`);
  o = await orders();
  const sentBefore = o.length;

  // Back to the title and in again: what's still waiting for tonight is back on your screen, and not sent twice.
  // A change that costs more than you'd have left isn't shown as built (the server would refuse it too).
  await g.page.evaluate((sp) => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.match.orders.push({ id: 99, lobby_id: 'M1', slot: 1, user_id: 'user-B', kind: 'build', payload: { what: 'lift', type: 'gondola', note: 'costs more than the cash left', a: { x: sp[0] + 40, z: sp[1] }, b: { x: sp[2] + 40, z: sp[3] } }, applied_day: null, error: null }); localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, spot);
  await g.click('#visitHome'); await g.reloaded();
  eq(await g.ev('!!matchPlay'), false, 'leaving ends the match');
  await g.click('#mpCard'); await g.page.waitForSelector('[data-mp=open][data-id=M1]', { timeout: 10000 }); await g.page.click('[data-mp=open][data-id=M1]');
  await g.reloaded(); await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView) && world.lifts.length === 2'), null, { timeout: 20000 });
  const back = await g.ev(`({ lifts: world.lifts.length, lots: state.lotSections, ticket: state.ticket, bar: document.getElementById('visitText').innerText })`);
  eq([back.lifts, back.lots, back.ticket], [2, lot0 + 1, 49], 'your queued lift, parking and price are still there');
  assert(await g.ev('state.cash >= 0'), `queued changes never take your cash below zero on screen (${await g.ev('state.cash')})`);
  eq(await g.ev(`trees.alive.reduce((a, x) => a + x, 0) < ${await g.ev('trees.n')}`), true, 'and so are the trees you cleared');
  assert(/[34] changes open/.test(back.bar), `the bar still counts them (${back.bar})`);
  await g.wait(800);
  eq((await orders()).length, sentBefore + 1, 'nothing was sent twice (the one extra is the order this test added)');
  await g.click('#visitHome'); await g.reloaded();
  await g.ev(`__fakeSwitch('user-C', 'c@example.com')`); await g.wait(1200);
  await g.click('#mpCard'); await g.page.waitForSelector('[data-mp=open][data-id=M1]', { timeout: 10000 }); await g.page.click('[data-mp=open][data-id=M1]');
  await g.reloaded();
  await g.page.waitForFunction(() => window.__dbg('!!matchView'), null, { timeout: 20000 });
  eq(await g.ev('[!!matchPlay, !!(visiting && visiting.match)]'), [false, true], 'a spectator only watches');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
