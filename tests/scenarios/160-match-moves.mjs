// King of the Mountain: moving lifts and buildings, turning a building, editing a trail's route and widening it.
// Each goes to the server with where it goes, is redone overnight by the same code after the same checks, and
// comes back on screen until the server has it. During the live day they pause it, like the other overnight jobs.
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
  const B = await g.ev(`world.buildings.find((B) => B.type === 'lodge').id`);

  let o;
  // Editing a trail's route: its middle point moves.
  await g.ev(`select({ kind: 'trail', obj: trailById(${t}) })`); await g.wait(200);
  eq(await press('[data-action=moveTrail]'), true, 'Edit route is on the trail panel');
  const tr = await g.ev(`(() => { const t0 = draft.pts.map((p) => ({ ...p })), k = Math.floor(t0.length / 2) || 1;
    for (let d = 1; d <= 6; d++) for (const s of [1, -1]) { draft.pts = t0.map((p) => ({ ...p })); draft.pts[k] = { x: t0[k].x + s * d, z: t0[k].z }; draft.dirty = true; recomputeDraft(); const i = draft.info; if (i.moved && !i.an.problems.length && i.cost <= state.cash) return draft.pts.map((p) => ({ x: p.x, z: p.z })); }
    draft.pts = t0; draft.dirty = true; recomputeDraft(); return { fail: draft.info.an.problems, n: t0.length, moved: draft.info.moved }; })()`);
  assert(tr && !tr.fail, `a new route the trail accepts (${JSON.stringify(tr)})`);
  eq(await press('[data-action=build]'), true, 'and it can be paid for');
  o = await last();
  eq([o.kind, o.payload.move.kind, o.payload.move.sel.id, o.payload.move.pts.length], ['other', 'trail', t, tr.length], 'the new route is sent');
  const route = await g.ev(`trailById(${t}).pts.map((p) => [p.x, p.z]).join()`);

  // Widening another trail.
  await g.ev(`select({ kind: 'trail', obj: trailById(${t2}) })`); await g.wait(200);
  eq(await press('[data-action=shapeTrail]'), true, 'Widen or narrow is on the trail panel');
  const ws = await g.ev(`(() => { draft.ws = draft.ws.map((v, i) => i === 1 ? Math.min(HW_MAX, v + 1) : v); draft.dirty = true; recomputeDraft(); return draft.info.problems.length ? null : draft.ws.map((v) => Math.round(v * 100) / 100); })()`);
  assert(ws, 'a wider trail the game accepts');
  eq(await press('[data-action=shapeApply]'), true, 'and it can be paid for');
  o = await last();
  eq([o.kind, o.payload.move.kind, o.payload.move.sel.id, o.payload.move.ws], ['other', 'shape', t2, ws], 'the new widths are sent');

  // Moving a lift's top station.
  await g.ev(`select({ kind: 'lift', obj: liftById(${L}) })`); await g.wait(200);
  eq(await press('[data-action=moveLift]'), true, 'Move a station is on the lift panel in a match');
  const lb = await g.ev(`(() => { const L = liftById(${L});
    for (let d = 4; d <= 30; d++) for (const sx of [0, 2, -2, 4, -4]) { draft.pts[1] = { x: L.b.x + sx, z: L.b.z - d }; draft.dirty = true; recomputeDraft(); const i = draft.info; if (i.moved && !i.problems.length) return { x: draft.pts[1].x, z: draft.pts[1].z }; }
    return null; })()`);
  assert(lb, 'a new spot for the top station');
  eq(await press('[data-action=build]'), true, 'and the move can be paid for');
  eq(await g.ev(`[state.tool, liftById(${L}).b.x, liftById(${L}).b.z]`), ['explore', lb.x, lb.z], 'the lift moves on screen');
  o = await last();
  eq([o.kind, o.payload.move.kind, o.payload.move.sel.id, o.payload.move.b], ['other', 'lift', L, lb], 'and the move is sent with where the stations go');

  // Moving the lodge.
  await g.ev(`select({ kind: 'bld', obj: bldById(${B}) })`); await g.wait(200);
  eq(await press('[data-action=moveBld]'), true, 'Move it is on the building panel');
  const bp = await g.ev(`(() => { const B = bldById(${B});
    for (let d = 2; d <= 30; d++) for (const [dx, dz] of [[d, 0], [-d, 0], [0, d], [0, -d]]) { draft.bpos = { x: B.x + dx, z: B.z + dz }; recomputeBldDraft(); const i = draft.info; if (i && !i.problems.length && i.cost <= state.cash) { renderSheet(); return { ...draft.bpos }; } }
    return null; })()`);
  assert(bp, 'a new spot for the lodge');
  eq(await press('[data-action=build]'), true, 'and the move can be paid for');
  o = await last();
  eq([o.kind, o.payload.move.kind, o.payload.move.sel.id, o.payload.move.x, o.payload.move.z], ['other', 'bld', B, bp.x, bp.z], 'the move is sent with where it goes');
  eq(await g.ev(`[bldById(${B}).x, bldById(${B}).z]`), [bp.x, bp.z], 'and it’s there on screen');

  // Turning the lodge: a building turned in a match used to turn on screen only, and was back as it was the next day.
  const tb = await g.ev(`(() => { const out = []; for (const B of world.buildings) { if (B.id !== ${B} || !canTurn(B.type)) continue; select({ kind: 'bld', obj: B }); renderSheet();
    const b = document.querySelector('#sheet [data-action=turnBld]'); if (!b) continue; b.click();
    for (const d of [1, 2, 3]) { setDraftDegrees(B.rot * 90 + d * 90); recomputeBldDraft(); if (draft.info && !draft.info.problems.length && draft.rot !== B.rot) { renderSheet(); return { id: B.id, rot: draft.rot }; } }
    out.push([B.type, draft.info && draft.info.problems, draft.rot, B.rot]); setTool('explore'); } return out.length ? { why: out } : null; })()`);
  assert(tb && !tb.why, `the lodge can be turned (${JSON.stringify(tb)})`);
  {
    eq(await press('[data-action=build]'), true, 'a building can be turned');
    o = await last();
    eq([o.payload.move.kind, o.payload.move.sel.id, o.payload.move.rot, o.payload.move.turn], ['bld', tb.id, tb.rot, true], 'and the turn is sent');
  }

  // Coming back: the server's copy doesn't have them yet, so they're redone from the orders.
  const want = await g.ev(`({ b: liftById(${L}).b, route: trailById(${t}).pts.map((p) => [p.x, p.z]).join(), ws: trailById(${t2}).ws || null, width: trailById(${t2}).width, bx: bldById(${B}).x, bz: bldById(${B}).z, rot: world.buildings.map((B) => B.rot).join(), cash: Math.round(state.cash) })`);
  await g.ev(`(() => { applySave(matchView.resorts.find((r) => r.slot === matchView.slot).save); afterLoad(); })()`);
  eq(await g.ev(`bldById(${B}).x === ${bp.x}`), false, '(the server’s copy, before the moves)');
  await g.ev('matchApplyPending()'); await g.wait(500);
  const got = await g.ev(`({ b: liftById(${L}).b, route: trailById(${t}).pts.map((p) => [p.x, p.z]).join(), ws: trailById(${t2}).ws || null, width: trailById(${t2}).width, bx: bldById(${B}).x, bz: bldById(${B}).z, rot: world.buildings.map((B) => B.rot).join(), cash: Math.round(state.cash) })`);
  eq(got, want, 'every move comes back the same, at the same cost');
  eq(route, want.route, '(the route is the one sent)');

  // The live day: moving pauses it, then the tool opens on the same lift.
  await g.ev(`matchView.lobby.starts_at = new Date(Date.now() - 65 * 60000).toISOString(); matchView.nothing = null`);
  await g.ev('startReplay(true)');
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  // Built during the live day: a blueprint until tonight, with a note on its panel.
  const bl = await g.ev(`(() => {
    setTool('bld'); state.cash = Math.max(state.cash, 5e6); const L0 = world.lifts[0];
    for (let k = 0; k < 80; k++) { const x = Math.round(L0.a.x) - 20 + (k % 10) * 4, z = Math.round(L0.a.z) + 4 + Math.floor(k / 10) * 4, i = evalBuilding('cafe', x, z, 0, false, null, null, 0);
      if (i && !i.problems.length) { const b = commitBuilding(i, 'cafe', x, z, 0); setTool('explore'); select({ kind: 'bld', obj: b }); renderSheet();
        const mats = new Set(); b.group.traverse((o) => { if (o.isMesh) mats.add(o.material); });
        return { id: b.id, blue: [...mats].every((m) => m.transparent && m.color.getHex() === 0x4f8ff0), note: /Blueprint: built tonight/.test(document.getElementById('sheet').innerText) }; } }
    setTool('explore'); return null; })()`);
  assert(bl, 'a café is placed during the live day');
  eq([bl.blue, bl.note, await g.ev('!!matchView.replay')], [true, true, true], 'it shows as a blueprint, says it opens tomorrow, and the day keeps playing');
  eq(await g.ev(`(() => { select({ kind: 'lift', obj: liftById(${L}) }); renderSheet(); return /Blueprint/.test(document.getElementById('sheet').innerText); })()`), false, 'things already built don’t say so');
  await g.ev(`select({ kind: 'lift', obj: liftById(${L}) })`); await g.wait(200);
  eq(await press('[data-action=moveLift]'), true, 'during the live day Move a station is offered');
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'closed' && !matchView.replay && state.tool === 'lift'"), null, { timeout: 30000 });
  eq(await g.ev(`!!draft.movingLift && draft.movingLift.id === ${L}`), true, 'it pauses the day and opens the move on the same lift');
  eq(await g.ev(`(() => { const b = bldById(${bl.id}); let real = true; b.group.traverse((o) => { if (o.isMesh && o.material.color && o.material.color.getHex() === 0x4f8ff0 && o.material.transparent) real = false; }); return real; })()`), true, 'once the day is paused, the café shows as it really is again');
  await g.ev(`cancelLiftMove()`);
  // A move that no longer fits overnight comes back with the reason.
  eq(await g.ev(`matchDo('other', { move: { kind: 'bld', sel: { kind: 'bld', id: 9999, x: 0, z: 0 }, x: 0, z: 0, rot: 0 } })`), 'it isn’t there any more', 'a move of something gone says so');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
