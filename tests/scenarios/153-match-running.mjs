// King of the Mountain: running the resort, removing things and money. Settings (open or closed, grooming,
// operations plans) go to the server as their new values; one-off actions (snowmaking, a loan, removing a
// building) go as the action. Coming back to the match puts them all back on screen until the server has them,
// and during the live day they don't pause it: removing something sends it for tonight and leaves it for today.
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

  // Land: a stroke of the levelling brush goes as its path, to be levelled the same way overnight.
  const lv = await g.ev(`(() => {
    const L = world.lifts[0]; let at = null;
    for (let k = 0; k < 60 && !at; k++) { const x = L.a.x + 6 + (k % 10) * 3, z = L.a.z - 8 - Math.floor(k / 10) * 5; if (inProperty(x, z) && inProperty(x + 4, z) && levelBrush({ x: x + 4, z }, 3, trueY(x, z), 0.4, true).cost > 500) at = { x, z }; }
    if (!at) return null;
    setTool('clear'); state.landMode = 'level'; state.brushR = 3; const cash = state.cash, h0 = trueY(at.x + 4, at.z);
    stroke.active = true; stroke.target = trueY(at.x, at.z); stroke.last = null; stroke.cost = 0;
    strokeTo(new THREE.Vector3(at.x, heightAt(at.x, at.z), at.z)); strokeTo(new THREE.Vector3(at.x + 4, heightAt(at.x + 4, at.z), at.z));
    endStroke(); setTool('explore');
    return { at, spent: cash - state.cash, h0, h: trueY(at.x + 4, at.z) };
  })()`);
  assert(lv && lv.spent > 0 && Math.abs(lv.h - lv.h0) > 0.05, `the ground is levelled on screen (${JSON.stringify(lv)})`);
  o = await orders();
  eq([o.length, o[6].kind, o[6].payload.brush.mode, o[6].payload.brush.pts.length > 2], [7, 'land', 'level', true], 'and the stroke is sent as land, with its path');

  // Land: a painted learning area goes with its ground, and Build paints it.
  const ar = await g.ev(`(() => {
    setTool('clear'); state.landMode = 'area';
    const L = world.lifts[0];
    for (let k = 0; k < 40; k++) {
      const x0 = Math.round(L.a.x) - 20 + (k % 8) * 5, z0 = Math.round(L.a.z) - 4 - Math.floor(k / 8) * 6, cells = new Set();
      for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if (!cellProblem(x0 + i, z0 + j, areaBlocks(null))) cells.add(cellKey(x0 + i, z0 + j));
      areaDraft = { cells, erase: false, editId: null }; const info = areaDraftInfo();
      if (info && !info.problems.length) { renderSheet(); const b = document.querySelector('#sheet [data-action=areaBuild]'); const n = world.areas.length; if (b && !b.disabled) b.click(); setTool('explore'); return { built: world.areas.length - n, cells: cells.size }; }
    }
    setTool('explore'); return null;
  })()`);
  assert(ar && ar.built === 1, `a learning area is painted (${JSON.stringify(ar)})`);
  o = await orders();
  eq([o.length, o[7].kind, o[7].payload.area.mode, o[7].payload.area.cells.length, o[7].payload.ds.action], [8, 'land', 'area', ar.cells, 'areaBuild'], 'and sent as land, with its ground');

  // Land for sale: leasing a parcel, as the server does it overnight.
  const lease = await g.ev(`(() => { state.seasonStats = { ...(state.seasonStats || {}), days: 99 }; const p = PARCELS.find((q) => !landHeld(q.id) && landReachable(q)); if (!p) return null;
    const n = (state.land || []).length, why = matchDo('other', { ds: { action: 'landLease', v: p.id }, sel: null, on: 'manage' }); return { why, more: (state.land || []).length - n, again: matchDo('other', { ds: { action: 'landLease', v: p.id } }) }; })()`);
  eq(lease && [lease.why, lease.more, !!lease.again], ['', 1, true], 'land can be leased overnight, once');

  // Coming back: the server's copy doesn't have them yet, so they go back on screen.
  await g.ev(`(() => { applySave(matchView.resorts.find((r) => r.slot === matchView.slot).save); afterLoad(); })()`);
  eq(await g.ev(`[!!bldById(${lodge}), trailById(${t}).open]`), [true, true], '(the server’s copy, before the changes)');
  await g.ev('matchApplyPending()'); await g.wait(500);
  const back = await g.ev(`({ sm: !!trailById(${t}).sm, debt: state.debt, lodge: !!bldById(${lodge}), open: trailById(${t}).open, groomed: trailById(${t}).groomed, staff: state.ops.plans.weekday.staff, pending: matchView.pending, areas: world.areas.length, h: trueY(${lv.at.x + 4}, ${lv.at.z}) })`);
  assert(Math.abs(back.h - lv.h) < 0.01, `the levelled ground comes back the same (${back.h} vs ${lv.h}, was ${lv.h0})`); delete back.h;
  eq(back, { sm: true, debt: now.debt, lodge: false, open: false, groomed: false, staff: 'lean', pending: 5, areas: 1 }, 'coming back puts every waiting change back on screen');
  eq((await orders()).length, 8, 'without sending them again');
  // As the next day starts the server marks them done, and saves the resorts a few seconds later. Reloading in
  // between must still show them (they used to vanish, and the cash shown was wrong).
  await g.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); for (const o of d.match.orders) o.applied_day = 3; localStorage.setItem('FAKE_DB', JSON.stringify(d)); });
  await g.ev(`(() => { applySave(matchView.resorts.find((r) => r.slot === matchView.slot).save); afterLoad(); })()`);
  await g.ev('matchApplyPending()'); await g.wait(500);
  eq(await g.ev(`({ debt: state.debt, lodge: !!bldById(${lodge}), open: trailById(${t}).open, areas: world.areas.length })`), { debt: now.debt, lodge: false, open: false, areas: 1 }, 'changes the server has just marked done stay on screen until its new copy arrives');
  await g.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); for (const o of d.match.orders) o.applied_day = null; localStorage.setItem('FAKE_DB', JSON.stringify(d)); });

  // The live day: removing doesn't pause it. The lift stays for today and goes tonight.
  await g.ev(`matchView.lobby.starts_at = new Date(Date.now() - 65 * 60000).toISOString(); matchView.nothing = null`);
  await g.ev('startReplay(true)');
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  const lift = await g.ev('world.lifts[0].id');
  await g.ev(`select({ kind: 'lift', obj: liftById(${lift}) })`); await g.wait(200);
  await press('[data-action=remove]');
  eq(await g.ev(`[state.phase, !!matchView.replay, !!document.querySelector('#sheet [data-action=removeYes]')]`), ['open', true, true], 'Remove asks without pausing the live day');
  await press('[data-action=removeYes]');
  eq(await g.ev(`[!!liftById(${lift}), !!matchView.replay, /Removed tonight/.test(document.getElementById('sheet').innerText)]`), [true, true, true], 'the lift stays for today, marked to go tonight');
  o = await orders();
  eq([o.length, o[8].kind, o[8].payload.sel.id], [9, 'remove', lift], 'and the removal is sent');
  // Closing a trail while the day plays doesn't pause it either.
  const t2 = await g.ev('realTrails()[1].id');
  await g.ev(`select({ kind: 'trail', obj: trailById(${t2}) })`); await g.wait(200);
  await press('[data-action=toggleOpen]');
  eq(await g.ev(`[!!matchView.replay, trailById(${t2}).open]`), [true, false], 'closing a trail doesn’t pause the day');
  o = await orders();
  eq([o.length, o[9].kind, o[9].payload.set['T' + t2][0]], [10, 'ops', false], 'and the trail’s settings are sent');

  // The Trail tool's tabs open the painters for learning areas, glades and guest areas, and the terrain park tool.
  const tabs = await g.ev(`(() => { const out = {}; for (const v of ['area', 'glade', 'hub', 'tpark']) { setTool('trail'); renderSheet(); const b = document.querySelector('#sheet [data-action=trailMode][data-v=' + v + ']'); if (b) b.click(); out[v] = !!b && state.tool + ':' + state.landMode; } setTool('explore'); return out; })()`);
  eq([tabs.area, tabs.glade, tabs.hub], ['clear:area', 'clear:glade', 'clear:hub'], 'the Trail tool’s tabs open the area painters in a match');
  assert(/^tpark/.test(String(tabs.tpark)), `the terrain park tab opens too (${tabs.tpark})`);
  // During the live day: the Trail tool's tabs work without pausing it.
  await g.ev(`setTool('explore')`);
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  await g.ev(`(() => { setTool('trail'); renderSheet(); const b = document.querySelector('#sheet [data-action=trailMode][data-v=glade]'); if (b) b.click(); })()`);
  eq(await g.ev('[state.phase, !!matchView.replay, state.tool, state.landMode]'), ['open', true, 'clear', 'glade'], 'during the live day the glade tab opens and the day keeps playing');
  await g.ev(`setTool('explore')`);
  // Things not in matches yet still say so.
  await g.ev(`(() => { const b = document.createElement('button'); b.dataset.action = 'waitWeek'; document.getElementById('sheet').appendChild(b); b.click(); b.remove(); })()`);
  eq((await orders()).length, 10, 'waiting a week isn’t part of matches: nothing is sent');
  // A building goes with its size and theme (a duplex is a condo's second size; it used to arrive as a chalet).
  const bo = await g.ev(`(() => {
    setTool('bld'); state.cash = Math.max(state.cash, 5e6); const L = world.lifts[0] || { a: { x: 0, z: 60 } };
    for (let k = 0; k < 80; k++) { const x = Math.round(L.a.x) - 20 + (k % 10) * 4, z = Math.round(L.a.z) + 4 + Math.floor(k / 10) * 4, i = evalBuilding('lodge', x, z, 0, false, null, null, 1);
      if (i && !i.problems.length) { commitBuilding(i, 'lodge', x, z, 0, 'modern'); setTool('explore'); return true; } }
    setTool('explore'); return false; })()`);
  assert(bo, 'a bigger modern lodge can be placed');
  o = await orders();
  eq([o[o.length - 1].payload.what, o[o.length - 1].payload.tier, o[o.length - 1].payload.style], ['building', 1, 'modern'], 'its order carries the size and the theme');
  // No invite pop-up in a match: it used to come back after every reload.
  eq(await g.ev(`(() => { refState.available = true; state.referralPromptSeason = null; state.phase = 'closed'; maybeReferralPrompt(); return [document.getElementById('referralBox').hidden, getComputedStyle(document.getElementById('mInvite')).display]; })()`), [true, 'none'], 'no invite pop-up, and no Invite friends in the menu, in a match');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
