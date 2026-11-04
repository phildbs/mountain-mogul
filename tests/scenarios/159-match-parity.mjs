// King of the Mountain, closer to single player: lift upgrades, mid-stations, off-site parking and building themes
// go to the server as match orders, the profit views work, and the overnight ones pause the live day like parking.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter); await m.ev(SETUPS.midwinter);
  await m.ev(`(() => { openDay(); state.speed = 0; let n = 0; while (state.phase === 'open' && n++ < 200000) simStep(1.5); nextDay(); state.cash = 3e6; })()`);
  const save = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();
  const g = await openGame(browser, url);
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString(), names = ['Summit Ridge', 'Phil’s Peak', 'Rival Run'];
  const match = { lobbies: [{ id: 'K1', name: 'Run Cup', map: 'match', slots: 3, starts_at: ago(87), days: 168, day_minutes: 30, status: 'running', day: 2, prize: null }],
    players: [0, 1, 2].map((s) => ({ lobby_id: 'K1', slot: s, user_id: [null, 'user-B', null][s], resort_name: names[s] })),
    resorts: [0, 1, 2].map((s) => ({ lobby_id: 'K1', slot: s, day: 2, save, summary: { name: names[s], profit: 100 * s, guests: 300 } })), orders: [],
    days: [{ lobby_id: 'K1', day: 2, results: { wx: 'sunny', share: [100, 150, 90], resorts: [{ slot: 0, guests: 99, profit: 1000 }, { slot: 1, guests: 148, profit: 4099 }, { slot: 2, guests: 88, profit: -200 }] } }] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await g.click('#mpCard'); await g.page.waitForSelector('[data-mp=open][data-id=K1]', { timeout: 10000 }); await g.page.click('[data-mp=open][data-id=K1]');
  await g.reloaded(); await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView)'), null, { timeout: 20000 });
  await g.wait(800);
  eq(await g.ev('[state.phase, !!matchView.replay]'), ['closed', false], 'the match is open at night, nothing playing');
  const orders = () => g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.orders.map((o) => ({ kind: o.kind, payload: o.payload })));
  const press = (sel) => g.ev(`(() => { const b = document.querySelector('#sheet ${sel}'); if (b && !b.disabled) b.click(); return !!b && !b.disabled; })()`);
  const last = async () => (await orders()).slice(-1)[0];

  // A lift long enough for a mid-station, that can also be upgraded: built here, as the server would have.
  const lift = await g.ev(`(() => {
    const L0 = world.lifts[0];
    for (let k = 0; k < 200; k++) {
      const a = { x: L0.a.x + 8 + (k % 10) * 3, z: L0.a.z - 4 - Math.floor(k / 10) * 3 }, b = { x: a.x + 2, z: a.z - 60 };
      const i = evalLift(a, b, 'double'); if (!i.problems.length && i.cost < state.cash) { commitLift(i, 'double'); computeNetwork(); return world.lifts[world.lifts.length - 1].id; }
    }
    return null; })()`);
  assert(lift != null, 'a double chair is placed for the test');

  // Lift upgrade: the panel opens the choices, and the upgrade goes as an action on that lift.
  await g.ev(`select({ kind: 'lift', obj: liftById(${lift}) })`); await g.wait(200);
  eq(await press('[data-action=liftUpOpen]'), true, 'the lift panel offers an upgrade in a match');
  const up = await g.ev(`document.querySelector('#sheet [data-action=liftUp]:not([disabled])')?.dataset.v || null`);
  assert(up, 'with at least one choice');
  const cash = await g.ev('state.cash');
  eq(await press(`[data-action=liftUp][data-v=${up}]`), true, 'and it can be pressed');
  const was = await g.ev(`liftById(${lift}).type`);
  eq(await g.ev(`[liftById(${lift}).type !== ${JSON.stringify(up)}, state.cash < ${cash}, /tonight/.test($('sheet').textContent)]`), [true, true, true], 'the upgrade is paid for, the old lift stays until tonight, and the panel says so');
  let o = await last();
  eq([o.kind, o.payload.ds.action, o.payload.ds.v, o.payload.sel.id], ['other', 'liftUp', up, lift], 'the upgrade is sent as an action on that lift');
  // Opening the match again before the night: still the old lift, still paid for.
  const paid = await g.ev('state.cash');
  await g.ev(`(() => { applySave(matchView.resorts.find((r) => r.slot === matchView.slot).save); afterLoad(); })()`);
  await g.ev('matchApplyPending()'); await g.wait(500);
  eq(await g.ev(`[liftById(${lift}).type, Math.round(state.cash) === Math.round(${paid}), !!matchUp(liftById(${lift}))]`), [was, true, true], 'after a reload the old lift still runs, paid for, upgrading tonight');
  // The server re-rigs it overnight (the order is marked done for the next day): now it's the new lift.
  await g.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); for (const x of d.match.orders) if (x.payload.ds && x.payload.ds.action === 'liftUp') x.applied_day = 3; localStorage.setItem('FAKE_DB', JSON.stringify(d)); });
  await g.ev(`(() => { applySave(matchView.resorts.find((r) => r.slot === matchView.slot).save); afterLoad(); })()`);
  await g.ev('matchApplyPending()'); await g.wait(500);
  eq(await g.ev(`liftById(${lift}).type`), up, 'once the server has done it, the new lift shows');

  // Mid-station: the tool opens, and Build sends the spot along the line.
  await g.ev(`select({ kind: 'lift', obj: liftById(${lift}) })`); await g.wait(200);
  const canMid = await g.ev(`canMid(liftById(${lift}).type)`);
  assert(canMid, 'the upgraded lift can take a mid-station');
  {
    eq(await press('[data-action=midOpen]'), true, 'Add a mid-station is offered');
    eq(await g.ev('state.tool'), 'midstn', 'and opens its tool');
    const s = await g.ev('midDraft.s');
    eq(await press('[data-action=midBuild]'), true, 'the mid-station can be built');
    eq(await g.ev(`liftById(${lift}).mid && liftById(${lift}).mid.s`), s, 'it’s there on screen');
    o = await last();
    eq([o.kind, o.payload.ds.action, o.payload.sel.id, o.payload.mid], ['other', 'midBuild', lift, s], 'and sent with its spot on the line');
  }

  // Off-site parking.
  await g.ev(`select({ kind: 'manage', obj: 'parking' })`); await g.wait(200);
  const lots = await g.ev('state.offsite');
  const hasBuy = await press('[data-action=offsiteBuy]');
  assert(hasBuy, 'off-site parking can be set up in a match');
  {
    eq(await g.ev('state.offsite'), lots + 1, 'off-site parking is set up');
    o = await last(); eq([o.kind, o.payload.ds.action], ['other', 'offsiteBuy'], 'and sent as an action');
  }

  // Building themes: picking a theme for new buildings is allowed; restyling one goes as a setting.
  const th = await g.ev(`(() => { const B = world.buildings.find((B) => themed(B.type)); return B ? B.id : null; })()`);
  assert(th != null, 'the starter has a building with themes');
  {
    await g.ev(`select({ kind: 'bld', obj: bldById(${th}) })`); await g.wait(200);
    const v = await g.ev(`[...document.querySelectorAll('#sheet [data-action=bldTheme]')].map((b) => b.dataset.v).find((v) => v !== (bldById(${th}).style || 'classic'))`);
    eq(await press(`[data-action=bldTheme][data-v=${v}]`), true, 'a building’s theme can be changed in a match');
    o = await last();
    eq([o.kind, o.payload.set['B' + th][4]], ['ops', await g.ev(`bldById(${th}).style || null`)], 'and its new theme is sent as a setting');
  }

  // View-only buttons: building sort and the profit map aren't blocked.
  const n1 = (await orders()).length;
  await g.ev(`select({ kind: 'manage', obj: 'blds' })`); await g.wait(200);
  const sort = await g.ev('listView.blds.sort');
  eq(await press('[data-action=bldSort]'), true, 'the building list has its sort button');
  assert((await g.ev('listView.blds.sort')) !== sort, 'buildings can be sorted in a match');
  eq((await orders()).length, n1, 'looking around sends nothing');

  // Coming back: the server's copy doesn't have them yet, so matchApplyPending puts them back with the same code.
  const at = await g.ev(`({ x: liftById(${lift}).a.x, z: liftById(${lift}).a.z })`);
  await g.ev(`(() => { applySave(matchView.resorts.find((r) => r.slot === matchView.slot).save); afterLoad(); })()`);
  await g.ev('matchApplyPending()'); await g.wait(500);
  const again = await g.ev(`(() => { const M = matchFind({ kind: 'lift', id: ${lift}, x: ${at.x}, z: ${at.z} }); return { type: M && M.type, mid: !!(M && M.mid), offsite: state.offsite }; })()`);
  await g.wait(300);
  eq([again.type, again.mid], [up, canMid], 'the upgrade and the mid-station come back on screen from the orders');
  eq(again.offsite, lots + 1, 'and the off-site parking');

  // The live day: lift upgrades wait for tonight without pausing it.
  await g.ev(`matchView.lobby.starts_at = new Date(Date.now() - 65 * 60000).toISOString(); matchView.nothing = null`);
  await g.ev('startReplay(true)');
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  const L1 = await g.ev('world.lifts[0].id');
  await g.ev(`select({ kind: 'lift', obj: liftById(${L1}) })`); await g.wait(200);
  eq(await press('[data-action=liftUpOpen]'), true, 'during the live day the upgrade choices open without pausing it');
  eq(await g.ev('!!matchView.replay'), true, '(still playing)');
  {
    const v = await g.ev(`document.querySelector('#sheet [data-action=liftUp]:not([disabled])')?.dataset.v || null`);
    assert(v, 'with a choice to pick');
    {
      const k = (await orders()).length;
      const t0 = await g.ev(`liftById(${L1}).type`);
      await press(`[data-action=liftUp][data-v=${v}]`); await g.wait(500);
      eq(await g.ev(`[!!matchView.replay, liftById(${L1}).type, /tonight/.test($('sheet').textContent)]`), [true, t0, true], 'during the live day, an upgrade doesn’t pause it: the old lift runs until tonight');
      eq((await orders()).length, k + 1, 'and is sent once');
    }
  }
  // Not part of matches: says so and sends nothing.
  const k2 = (await orders()).length;
  await g.ev(`select({ kind: 'lift', obj: liftById(${L1}) })`); await g.wait(200);
  await g.ev(`(() => { const b = document.createElement('button'); b.dataset.action = 'waitWeek'; document.getElementById('sheet').appendChild(b); b.click(); b.remove(); })()`);
  eq((await orders()).length, k2, 'waiting a week isn’t part of matches: nothing is sent');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
