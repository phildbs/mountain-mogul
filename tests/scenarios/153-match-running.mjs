// King of the Mountain: running the resort, removing things and money. Settings (open or closed, grooming,
// operations plans) go to the server as their new values; one-off actions (snowmaking, a loan, removing a
// building) go as the action. Coming back to the match puts them all back on screen until the server has them,
// and actions that need the resort closed pause the live day first.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter); await m.ev(SETUPS.midwinter);
  await m.ev(`(() => { openDay(); state.speed = 0; let n = 0; while (state.phase === 'open' && n++ < 200000) simStep(1.5); nextDay(); state.cash = 3e6; })()`);
  const save = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();
  const g = await openGame(browser, url);
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString(), names = ['Summit Ridge', 'Phil’s Peak', 'Rival Run'];
  // Day 2 began 27 minutes ago: its skiing is over, so nothing plays until we ask.
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
  const t = await g.ev('realTrails()[0].id'), lodge = await g.ev(`world.buildings.find((B) => B.type === 'lodge').id`);

  // Settings: close a trail and stop grooming it; a leaner weekday plan.
  await g.ev(`select({ kind: 'trail', obj: trailById(${t}) })`); await g.wait(200);
  eq(await press('[data-action=toggleOpen]'), true, 'the trail panel has its Close button');
  await press('[data-action=groom]');
  await g.ev(`(() => { resortTab = 'ops'; opsEdit = 'weekday'; select({ kind: 'manage', obj: 'ops' }); })()`); await g.wait(200);
  eq(await press('[data-action=opsStaff][data-v=lean]'), true, 'the operations plan has staffing buttons');
  let o = await orders();
  const ops = o.filter((x) => x.kind === 'ops');
  eq(ops.length, 3, 'each settings change is sent');
  eq(ops[0].payload.set['T' + t], [false, true, null, null, false], 'closing the trail sends the trail’s new settings, not a toggle');
  eq(ops[1].payload.set['T' + t][1], false, 'and so does grooming');
  eq(ops[2].payload.set.ops.plans.weekday.staff, 'lean', 'the plan goes as it now stands');
  assert(!/tomorrow/.test(await g.ev(`document.getElementById('visitText').innerText`)), 'settings aren’t counted as changes waiting to open');

  // One-off actions: snowmaking on the trail, a loan, and removing the lodge.
  const debt = await g.ev('state.debt');
  await g.ev(`select({ kind: 'trail', obj: trailById(${t}) })`); await g.wait(200);
  eq(await press('[data-action=smInstall]'), true, 'snowmaking can be added');
  await g.ev(`select({ kind: 'manage', obj: 'money' })`); await g.wait(200);
  eq(await press('[data-action=borrow]'), true, 'the bank lends');
  await g.ev(`select({ kind: 'bld', obj: bldById(${lodge}) })`); await g.wait(200);
  await press('[data-action=remove]'); await g.wait(100);
  eq(await press('[data-action=removeYes]'), true, 'the lodge can be removed');
  o = await orders();
  eq(o.slice(3).map((x) => [x.kind, x.payload.ds.action]), [['other', 'smInstall'], ['other', 'borrow'], ['remove', 'removeYes']], 'one-off actions are sent as actions');
  eq(o[5].payload.sel, { kind: 'bld', id: lodge, x: await g.ev(`${JSON.stringify(save.world.buildings.find((B) => B.type === 'lodge').x)}`), z: save.world.buildings.find((B) => B.type === 'lodge').z }, 'with where the lodge stood');
  const now = await g.ev(`({ sm: !!trailById(${t}).sm, debt: state.debt, lodge: !!bldById(${lodge}), open: trailById(${t}).open })`);
  eq([now.sm, now.debt > debt, now.lodge, now.open], [true, true, false, false], 'and done on screen straight away');
  assert(/3 changes open/.test(await g.ev(`document.getElementById('visitText').innerText`)), 'the bar counts the three waiting for tonight');

  // Coming back: the server's copy doesn't have them yet, so they go back on screen.
  await g.ev(`(() => { applySave(matchView.resorts.find((r) => r.slot === matchView.slot).save); afterLoad(); })()`);
  eq(await g.ev(`[!!bldById(${lodge}), trailById(${t}).open]`), [true, true], '(the server’s copy, before the changes)');
  await g.ev('matchApplyPending()'); await g.wait(500);
  const back = await g.ev(`({ sm: !!trailById(${t}).sm, debt: state.debt, lodge: !!bldById(${lodge}), open: trailById(${t}).open, groomed: trailById(${t}).groomed, staff: state.ops.plans.weekday.staff, pending: matchView.pending })`);
  eq(back, { sm: true, debt: now.debt, lodge: false, open: false, groomed: false, staff: 'lean', pending: 3 }, 'coming back puts every waiting change back on screen');
  eq((await orders()).length, 6, 'without sending them again');

  // The live day: removing pauses it first, then carries on with the same panel.
  await g.ev(`matchView.lobby.starts_at = new Date(Date.now() - 65 * 60000).toISOString(); matchView.nothing = null`);
  await g.ev('startReplay(true)');
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  const lift = await g.ev('world.lifts[0].id');
  await g.ev(`select({ kind: 'lift', obj: liftById(${lift}) })`); await g.wait(200);
  await press('[data-action=remove]');
  await g.page.waitForFunction(() => window.__dbg('!matchView.replay && !!document.querySelector("#sheet [data-action=removeYes]")'), null, { timeout: 10000 });
  eq(await g.ev(`[state.phase, matchView.paused, selected && selected.kind, selected && selected.obj && selected.obj.id]`), ['closed', true, 'lift', lift], 'Remove pauses the live day and asks on the same lift');
  await press('[data-action=removeYes]');
  eq(await g.ev(`!!liftById(${lift})`), false, 'the lift is removed');
  o = await orders();
  eq([o.length, o[6].kind, o[6].payload.sel.id], [7, 'remove', lift], 'and the removal is sent');
  // Closing a trail while the day plays doesn't pause it.
  await g.ev(`setTool('explore')`);
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  const t2 = await g.ev('realTrails()[1].id');
  await g.ev(`select({ kind: 'trail', obj: trailById(${t2}) })`); await g.wait(200);
  await press('[data-action=toggleOpen]');
  eq(await g.ev(`[!!matchView.replay, trailById(${t2}).open]`), [true, false], 'closing a trail doesn’t pause the day');
  o = await orders();
  eq([o.length, o[7].kind, o[7].payload.set['T' + t2][0]], [8, 'ops', false], 'and the trail’s settings are sent');

  // Things not in matches yet still say so.
  await g.ev(`select({ kind: 'trail', obj: trailById(${t2}) })`); await g.wait(200);
  await press('[data-action=moveTrail]');
  eq((await orders()).length, 8, 'moving a trail isn’t part of matches yet: nothing is sent');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
