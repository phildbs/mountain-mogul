// King of the Mountain: terrain park features and blueprints. Building, moving and removing a feature goes as an
// order with its trail and spot; a blueprint goes with what it is and an id of its own, so pausing, reordering,
// cancelling and building it now find the same one on the server, which builds the rest overnight in order.
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
  const L = await g.ev('world.lifts[0].id'), t = await g.ev('realTrails()[0].id'), t2 = await g.ev('realTrails()[1].id');
  const feats = () => g.ev(`realTrails().flatMap((t) => (t.feats || []).map((f) => [t.id, f.type, f.at, f.off].join(':'))).sort().join()`);

  // A terrain park feature: the Trail tool's Terrain park tab, pick Rollers, tap a trail, build.
  eq(await g.ev(`(() => { setTool('trail'); renderSheet(); const b = document.querySelector('#sheet [data-action=trailMode][data-v=tpark]'); if (b) b.click(); return state.tool; })()`), 'tpark', 'the terrain park tool opens in a match');
  eq(await press('[data-action=parkPick][data-v=roller]'), true, 'features can be picked');
  const spot = await g.ev(`(() => { for (const t of realTrails()) for (let i = 4; i < t.samples.length - 4; i += 3) { parkTap(t.samples[i]); const k = parkSiteInfo(); if (k && !k.problems.length) return { t: t.id, at: parkDraft.site.at }; } return null; })()`);
  assert(spot, 'a spot for rollers');
  const cash = await g.ev('state.cash');
  eq(await press('[data-action=parkBuild]'), true, 'and they can be built');
  let o = await last();
  eq([o.kind, o.payload.park.op, o.payload.park.sel.id, o.payload.park.type, o.payload.park.at], ['other', 'build', spot.t, 'roller', Math.round(spot.at * 1000) / 1000], 'the feature is sent with its trail and spot');
  assert((await g.ev('state.cash')) < cash, 'and paid for');
  const fid = await g.ev(`trailById(${spot.t}).feats.slice(-1)[0].id`);

  // Moving it a little way down the trail.
  const mv = await g.ev(`(() => { const t = trailById(${spot.t}), f = t.feats.find((f) => f.id === ${fid}); parkDraft = { type: null, site: null, sel: { t, f }, moving: null }; renderSheet();
    const b = document.querySelector('#sheet [data-action=parkMove]'); if (!b) return 'no move button'; b.click();
    for (let i = t.samples.length - 5; i > 3; i -= 3) { parkTap(t.samples[i]); const k = parkSiteInfo(); if (k && !k.problems.length && Math.abs(parkDraft.site.at - f.at) > 0.05) { renderSheet(); return true; } } return 'no spot'; })()`);
  eq(mv, true, 'Move offers a new spot');
  eq(await press('[data-action=parkBuild]'), true, 'and the move can be paid for');
  o = await last();
  eq([o.payload.park.op, o.payload.park.fid, o.payload.park.from.id], ['move', fid, spot.t], 'the move is sent');
  await g.ev(`setTool('explore')`);
  const featsNow = await feats();

  // Blueprints: a lift saved for later, and a second one.
  const plan = (dx) => g.ev(`(() => { setTool('lift'); draft.liftType = 'double'; const L0 = world.lifts[0];
    for (let k = 0; k < 200; k++) { const a = { x: L0.a.x + ${dx} + (k % 10) * 3, z: L0.a.z - 4 - Math.floor(k / 10) * 3 }; draft.pts = [a, { x: a.x + 2, z: a.z - 40 }]; draft.dirty = true; recomputeDraft(); renderSheet();
      const b = document.querySelector('#sheet [data-action=saveBlueprint]'); if (draft.info && !draft.info.problems.length && b) { const n = world.plans.length; b.click(); setTool('explore'); return world.plans.length - n; } }
    setTool('explore'); return 0; })()`);
  eq(await plan(8), 1, 'a lift can be saved as a blueprint in a match');
  o = await last();
  eq([o.kind, o.payload.plan.kind, typeof o.payload.plan.uid], ['other', 'lift', 'string'], 'and sent, with an id of its own');
  const u1 = o.payload.plan.uid;
  eq(await plan(-30), 1, 'and a second one');
  const u2 = (await last()).payload.plan.uid;
  assert(u1 !== u2, 'each blueprint has its own id');
  eq(await g.ev(`world.lifts.length`), await g.ev(`${JSON.stringify(save.world.lifts.length)}`), 'nothing is built yet');

  // The blueprint list: move the second one up, pause it.
  await g.ev(`select({ kind: 'manage', obj: 'plans' })`); await g.wait(200);
  const id2 = await g.ev(`world.plans.find((p) => p.uid === '${u2}').id`);
  eq(await press(`[data-action=planMove][data-id="${id2}"][data-d="-1"]`), true, 'blueprints can be reordered');
  o = await last(); eq([o.payload.planOp.op, o.payload.planOp.uid, o.payload.planOp.at], ['planMove', u2, 0], 'the new order is sent');
  eq(await press(`[data-action=planPause][data-id="${id2}"]`), true, 'and paused');
  o = await last(); eq([o.payload.planOp.op, o.payload.planOp.paused], ['planPause', true], 'paused, not a toggle');
  const order = await g.ev(`world.plans.map((p) => p.uid + (p.paused ? '-' : '')).join()`);
  eq(order, `${u2}-,${u1}`, '(on screen)');

  // Coming back: features and blueprints are put back from the orders, in the same order and state.
  await g.ev(`(() => { applySave(matchView.resorts.find((r) => r.slot === matchView.slot).save); afterLoad(); })()`);
  eq(await g.ev('world.plans.length'), 0, '(the server’s copy, before the orders)');
  await g.ev('matchApplyPending()'); await g.wait(500);
  eq([await feats(), await g.ev(`world.plans.map((p) => p.uid + (p.paused ? '-' : '')).join()`)], [featsNow, order], 'they all come back the same');

  // Overnight the server builds the blueprints in order: the paused one waits.
  const lifts = await g.ev('world.lifts.length');
  await g.ev('executePlans()');
  eq(await g.ev('world.lifts.length'), lifts, 'a player’s own page never builds them (the server does)');
  await g.ev('(() => { const mp = matchPlay; matchPlay = null; try { executePlans(); } finally { matchPlay = mp; } })()'); // as the server does
  eq([await g.ev('world.lifts.length') - lifts, await g.ev(`world.plans.map((p) => p.uid).join()`)], [1, u2], 'the blueprint is built overnight; the paused one waits');
  // Cancelling, as the server does it.
  eq(await g.ev(`matchDo('other', { planOp: { op: 'cancelPlan', uid: '${u2}' } })`), '', 'a blueprint can be cancelled');
  eq(await g.ev(`[world.plans.length, matchDo('other', { planOp: { op: 'planDrop', uid: '${u2}' } })]`), [0, 'it isn’t there any more'], 'once');

  // Removing the feature.
  const f2 = await g.ev(`trailById(${spot.t}).feats.find((f) => f.type === 'roller').id`);
  await g.ev(`(() => { setTool('tpark'); const t = trailById(${spot.t}); parkDraft = { type: null, site: null, sel: { t, f: t.feats.find((f) => f.id === ${f2}) }, moving: null }; renderSheet(); })()`);
  eq(await press('[data-action=parkRemove]'), true, 'a feature can be removed');
  o = await last(); eq([o.payload.park.op, o.payload.park.fid], ['remove', f2], 'and the removal is sent');
  await g.ev(`setTool('explore')`);
  // Staying closed on some days: a choice under Hours in a match's operations plans, sent like any setting.
  await g.ev(`(() => { resortTab = 'ops'; opsEdit = 'weekday'; select({ kind: 'manage', obj: 'ops' }); })()`); await g.wait(200);
  eq(await press('[data-action=opsHours][data-v=closed]'), true, 'Hours has Stay closed in a match');
  o = await last();
  eq([o.kind, o.payload.set.ops.plans.weekday.hours], ['ops', 'closed'], 'and it’s sent with the plan');
  assert(/stays closed on these days/.test(await g.ev(`document.getElementById('sheet').innerText`)), 'the panel says what it means');
  eq(await g.ev(`(() => { const mp = matchPlay; matchPlay = null; opsEdit = 'weekend'; renderSheet(); const n = !!document.querySelector('#sheet [data-action=opsHours][data-v=closed]'); matchPlay = mp; opsEdit = 'weekday'; renderSheet(); return n; })()`), false, 'single player doesn’t offer it');
  eq(await g.ev(`(() => { const o = state.ops.override; state.ops.override = { day: state.day, plan: 'weekday' }; const s = planShut(); state.ops.override = o; return s; })()`), true, 'on a weekday the plan keeps the resort shut');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
