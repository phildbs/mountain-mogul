// Watching today live: during a day's ski slot, Watch today plays the day on screen in step with the clock (the
// lifts open as the slot begins and close 18 minutes in; 156 covers the evening) with the share of skiers the server gave
// this resort; Stop watching, or the end of the slot, goes back to building with the server's official numbers.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter); await m.ev(SETUPS.midwinter);
  await m.ev(`(() => { openDay(); state.speed = 0; let n = 0; while (state.phase === 'open' && n++ < 200000) simStep(1.5); nextDay(); })()`);
  const save = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();
  const g = await openGame(browser, url, { render: !!process.env.SHOTS });
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString(), names = ['Summit Ridge', 'Phil’s Peak', 'Rival Run'];
  // Day 2 began 5 minutes ago (slots of 30 minutes: day 2 started at the start time plus 60 minutes).
  const match = { lobbies: [{ id: 'R1', name: 'Replay Cup', map: 'match', slots: 3, starts_at: ago(65), days: 168, day_minutes: 30, status: 'running', day: 2, prize: null }],
    players: [0, 1, 2].map((s) => ({ lobby_id: 'R1', slot: s, user_id: [null, 'user-B', null][s], resort_name: names[s] })),
    resorts: [0, 1, 2].map((s) => ({ lobby_id: 'R1', slot: s, day: 2, save, summary: { name: names[s], profit: 100 * s, guests: 300 } })), orders: [],
    days: [{ lobby_id: 'R1', day: 2, results: { wx: 'sunny', share: [100, 150, 90], resorts: [{ slot: 0, guests: 99, profit: 1000 }, { slot: 1, guests: 148, profit: 4099, cash0: save.cash - 5000, debt0: 0 }, { slot: 2, guests: 88, profit: -200 }] } }] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await g.click('#mpCard'); await g.page.waitForSelector('[data-mp=open][data-id=R1]', { timeout: 10000 }); await g.page.click('[data-mp=open][data-id=R1]');
  await g.reloaded(); await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView)'), null, { timeout: 20000 });
  eq(await g.ev(`getComputedStyle(document.querySelector('.tb-speed')).display`), 'none', 'no speed buttons in a match: the clock sets the pace');
  // The day plays by itself.
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  const w = await g.ev(`({ time: state.time, want: replayClock(matchView.lobby), speed: state.speed, bar: document.getElementById('visitText').innerText, btn: document.getElementById('visitWatch').innerText, expected: today.expected })`);
  assert(Math.abs(w.time - w.want) < (process.env.SHOTS ? 15 : 5) && Math.abs(w.want - (480 + 480 * 5 / 18)) < 3, `today plays by itself, at the right time of day (${w.time.toFixed(0)} vs ${w.want.toFixed(0)})`);
  assert(w.speed > 0.25 && w.speed < 0.5, `in step with the clock (${w.speed.toFixed(2)})`);
  eq(w.expected, 150, 'with the share of skiers the server gave this resort');
  assert(/watching day 2 live/.test(w.bar) && w.btn === 'Pause the day', 'the bar says so');
  // The save is the morning after the day the server played: the day on screen is that day, with its weather, not the next.
  const played = save.clock.lastReport;
  eq(await g.ev(`[state.day, today.day, JSON.stringify(todayWx())]`), [played.day, played.day, JSON.stringify(played.wx)], `the day on screen is the day the server played (${played.when}), with its weather`);
  eq(save.clock.day, played.day + 1, 'and the save itself is the next morning');
  await g.wait(3000);
  assert(await g.ev('guests.length > 0'), 'skiers are out on the mountain');
  await g.wait(2000);
  assert(Math.abs(await g.ev('state.cash') - save.cash) < 1, 'your real cash stays put while the day plays (it was already counted by the server)');
  // The figure in the corner starts at this morning's cash ($5,000 less) and moves with the day's own takings.
  const corner = () => g.ev(`(() => { const R = matchView.replay; return { sim: R.sim, shown: cashNow(), want: state.cash - 5000 + R.sim, text: $('cash').textContent === money(cashNow()) }; })()`);
  const c1 = await corner();
  assert(c1.sim > 0 && Math.abs(c1.shown - c1.want) < 1 && c1.text, `the corner shows the morning's money plus what the day has taken so far (${JSON.stringify(c1)})`);
  await g.ev(`replayKeep(() => { for (let k = 0; k < 60 && state.phase === 'open'; k++) simStep(1.5); })`); await g.wait(200); // as the live day does: its takings were counted by the server
  const c2 = await corner();
  assert(c2.sim !== c1.sim && Math.abs(c2.shown - c2.want) < 1 && c2.text && Math.abs(await g.ev('state.cash') - save.cash) < 1, `and moves with the sales as the day plays, real cash unchanged (${Math.round(c1.shown)} → ${Math.round(c2.shown)})`);
  // With the server's money through the day (results from 3.5.1), the corner shows that instead: the same each visit.
  const sm = await g.ev(`(() => { const R = matchView.replay, t = state.time; R.official.money = [[t - 10, 1000], [t + 10, 3000]];
    const a = cashNow(); R.official.money = [[t - 30, 500], [t - 20, 900]]; const b = cashNow(); delete R.official.money;
    return { a: a - (state.cash - 5000), b: b - (state.cash - 5000) }; })()`);
  assert(Math.abs(sm.a - 2000) < 1 && Math.abs(sm.b - 900) < 1, `with the server's money for the day, the corner shows the morning's money plus the server's takings at this moment (${JSON.stringify(sm)})`);
  const rv = await g.ev(`(() => { cam.viewH = 60; cam.viewGoal = null; rivalSkiersTick(0.05); drawPeople(); const own = world.lifts[0].a, G = RIVAL_SKI.ghosts, far = G.map((x) => Math.hypot(x.x - own.x, x.z - own.z));
    const drawn = guests.filter((x) => x.px != null).length;
    return { n: G.length, shown: figMeshes.jacket.count - drawn, on: RIVAL_SKI.on, minFar: Math.min(...far), riding: G.filter((x) => x.mode === 'lift').length, skiing: G.filter((x) => x.mode === 'ski').length,
      chairs: RIVAL_SKI.slices.every((sl) => sl.lifts.every((R) => R.V.chairs && R.V.chairCount > 1)), trees: (matchView.rivalCut || []).filter((k) => trees.alive[k]).length, cut: (matchView.rivalCut || []).length,
      looks: rivalGroup.children.filter((o) => o.userData.rival === true).every((o) => o.material.map === CORD && o.material.opacity === 1) }; })()`);
  eq([rv.on, rv.n], [true, Math.round(100 * 0.25) + Math.round(90 * 0.25)], 'rivals have skiers too, in proportion to their share of the day');
  assert(rv.riding > 0 && rv.skiing > 0, `some riding up, some skiing down (${rv.riding}, ${rv.skiing})`);
  eq([rv.chairs, rv.looks], [true, true], 'rival lifts have chairs, and their trails are drawn like yours');
  // Same pace as your own resort: one real second moves rivals as far as one real second of your guests and lifts.
  const pace = await g.ev(`(() => { const sp = state.speed; state.speed = 0.5; const R = RIVAL_SKI.slices[0].lifts[0], V = R.V, p0 = V.phase, x = RIVAL_SKI.ghosts.find((q) => q.mode === 'ski'), d0 = x.d;
    rivalSkiersTick(0.02); const lift = (V.phase - p0 + V.total) % V.total, ski = x.mode === 'ski' ? (x.d - d0) / x.speed : null; state.speed = sp;
    const gs = 0.02 * GS_PER_REAL * 0.5, own = gs * LIFT_TYPES[R.type].speed / 10 / PACE, lo = Math.min(...SKI_SPEED) * 0.85, hi = Math.max(...SKI_SPEED) * 1.15;
    return { lift: Math.abs(lift - own) < 1e-6, ski: ski == null || Math.abs(ski - gs) < 1e-6, speeds: RIVAL_SKI.ghosts.every((q) => q.speed >= lo && q.speed <= hi) }; })()`);
  eq(pace, { lift: true, ski: true, speeds: true }, 'rival lifts and skiers move at the same speeds as yours, on the same clock');
  // Chairs are made while the view is zoomed out (hidden then): zooming in shows them, like yours.
  eq(await g.ev(`(() => { cam.viewH = 300; updateChairs(); const a = RIVAL_SKI.slices.every((sl) => sl.lifts.every((R) => !R.V.chairs.visible)); cam.viewH = 60; updateChairs(); return [a, RIVAL_SKI.slices.every((sl) => sl.lifts.every((R) => R.V.chairs.visible))]; })()`), [true, true], 'rival chairs hide and show with zoom, like yours');
  // Rivals' slices aren't hazed like land beyond the boundary.
  eq(await g.ev(`(() => { const R = RIVAL_SKI.slices[0].lifts[0], x = (R.a.x + R.b.x) / 2 + HALF, z = (R.a.z + R.b.z) / 2 + HALF; return hazeAt(x, z) < 0.05; })()`), true, 'rival slices aren’t faded');
  assert(rv.cut > 0 && rv.trees === 0, `the trees on rivals’ trails and lift lines are gone (${rv.cut} cut)`);
  if (process.env.SHOTS) { await g.ev("document.getElementById('updCard').hidden = true; cam.viewH = 150; cam.viewGoal = null; updateCamera()"); await g.wait(2500); await g.page.screenshot({ path: 'rival-skiers.png' }); }
  assert(rv.shown === rv.n && rv.minFar > 25, `drawn with your guests’ figures, on their own slices, away from yours (${JSON.stringify(rv)})`);

  // Lifts, trails and buildings are built while the day plays: no pause, closed until tomorrow, and ordered.
  await g.ev(`setTool('lift')`); await g.wait(300);
  eq(await g.ev(`[state.phase, !!matchView.replay, !!matchView.paused, state.tool]`), ['open', true, false, 'lift'], 'picking the lift tool keeps the day playing');
  const cash0 = await g.ev('state.cash'), lifts0 = await g.ev('world.lifts.length');
  const built = await g.ev(`(() => { const L = world.lifts[0], dx = 14;
    for (const s of [1, -1, 2, -2, 3, -3]) { const a = { x: L.a.x + s * dx, z: L.a.z }, b = { x: L.b.x + s * dx, z: L.b.z }, i = evalLift(a, b, 'double', planning());
      if (!i.problems.length && i.cost <= state.cash) { draft.kind = 'lift'; draft.liftType = 'double'; draft.pts = [a, b]; draft.info = i; buildDraft(); return i.cost; } }
    return 0; })()`);
  assert(built > 0, 'a lift fits beside the first one');
  const nl = await g.ev(`(() => { const L = world.lifts[world.lifts.length - 1]; return { n: world.lifts.length, open: L.open, plans: world.plans.length, cash: state.cash, replay: !!matchView.replay, id: L.id }; })()`);
  eq([nl.n, nl.open, nl.plans, nl.replay], [lifts0 + 1, false, 0, true], 'the lift is built right away (not a blueprint), closed today, and the day keeps playing');
  eq(nl.cash, cash0 - built, 'the cash shown drops by what it cost');
  await g.wait(400);
  assert(Math.abs(await g.ev('state.cash') - (cash0 - built)) < 1, 'and stays there while the day plays');
  eq(await g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.orders.filter((o) => o.payload.what === 'lift').length), 1, 'the lift goes to the server for the next overnight');
  await g.ev(`(() => { for (let k = 0; k < 400 && state.phase === 'open'; k++) simStep(1.5); })()`);
  eq(await g.ev(`(() => { const L = liftById(${nl.id}); return [L.open, L.queue.length, guests.some((x) => x.L === L), (L.riders || []).flat().length]; })()`), [false, 0, false, 0], 'nobody rides it today');
  // A trail down from the new lift and a building at its foot: built today, closed today, and the day plays on.
  await g.ev(`setTool('trail')`);
  const tb = await g.ev(`(() => { const L = liftById(${nl.id}), T = world.trails.length, t0 = state.time;
    const top = { x: L.b.x, z: L.b.z }, bot = { x: L.a.x, z: L.a.z }, out = {};
    for (const w of [0, 6, -6, 10, -10]) { const mid = { x: (top.x + bot.x) / 2 + w, z: (top.z + bot.z) / 2 }, pts = [top, mid, bot].map((q) => ({ ...q, y: heightAt(q.x, q.z) })), i = evalTrail(pts, 'medium', planning());
      if (!i.an.problems.length && i.cost <= state.cash) { draft.kind = 'trail'; draft.width = 'medium'; draft.pts = pts; draft.info = i; buildDraft(); out.trail = world.trails.length - T; break; } }
    const t = realTrails().at(-1); out.open = t.open;
    setTool('bld'); const B0 = world.buildings.length;
    for (let k = 0; k < 40 && world.buildings.length === B0; k++) { const x = bot.x + (k % 8 - 4) * 4, z = bot.z + 6 + Math.floor(k / 8) * 4, v = evalBuilding('restroom', x, z, 0);
      if (v && !v.problems.length) { draft.btype = 'restroom'; draft.bpos = { x, z }; draft.rot = 0; buildBuildingDraft(); } }
    const B = world.buildings[world.buildings.length - 1]; out.bld = world.buildings.length - B0; out.bOpen = bldOpenNow(B);
    for (let k = 0; k < 1500 && state.phase === 'open'; k++) simStep(1.5);
    out.ran = state.time > t0; out.used = guests.some((x) => x.T === t) || !!(B.today && B.today.visits); out.replay = !!matchView.replay;
    return out; })()`);
  eq(tb, { trail: 1, open: false, bld: 1, bOpen: false, ran: true, used: false, replay: true }, 'a trail and a building go in too, closed today, and the day plays on');
  eq(await g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.orders.filter((o) => ['trail', 'building'].includes(o.payload.what)).length), 2, 'both ordered for the next overnight');
  // Overnight jobs work while the day plays too: snowmaking, parking, painting areas. Nothing pauses.
  const orders = () => g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.orders);
  const press = async (sel) => { await g.wait(150); const ok = await g.ev(`(() => { const b = document.querySelector('#sheet ${sel}'); if (b && !b.disabled) { b.click(); return true; } return false; })()`); assert(ok, `${sel} is there to press`); await g.wait(300); };
  await g.ev(`setTool('explore')`); await g.wait(200);
  eq(await g.ev('!!matchView.replay'), true, 'back to Explore, still watching');
  await g.ev('state.cash = Math.max(state.cash, 3e6)'); await g.wait(100);
  let c = await g.ev('state.cash'), n0 = (await orders()).length;
  const nt = await g.ev('realTrails().at(-1).id');
  await g.ev(`select({ kind: 'trail', obj: trailById(${nt}) })`); await press('[data-action=smInstall]');
  eq(await g.ev(`[!!matchView.replay, !!(trailById(${nt}).sm && trailById(${nt}).sm.on), state.cash < ${c}]`), [true, true, true], 'snowmaking goes in while the day plays, and is paid for');
  eq((await orders()).length, n0 + 1, 'and it is ordered for tonight');
  await g.wait(500); assert(await g.ev(`state.cash < ${c} - 1000`), 'the cash stays down while the day plays');
  // Parking.
  const lots = await g.ev('state.lotSections');
  await g.ev(`(() => { select({ kind: 'manage', obj: 'parking' }); renderSheet(); })()`); await g.wait(300);
  const btn = await g.ev(`(() => { const b = [...document.querySelectorAll('#sheet [data-action=expandLot]')].find((x) => !x.disabled); if (b) b.click(); return !!b; })()`);
  await g.wait(500);
  eq([btn, await g.ev('state.lotSections'), await g.ev('!!matchView.replay')], [true, lots + 1, true], 'parking is added while the day plays, without a pause');
  eq((await orders()).filter((o) => o.payload.what === 'lot').length, 1, 'and it goes to the server for the next overnight');
  // A learning area painted while the day plays: closed today, ordered for tonight.
  await g.ev(`select(null); state.landMode = 'area'; setTool('clear')`); await g.wait(200);
  eq(await g.ev(`[state.tool, !!matchView.replay]`), ['clear', true], 'the Trail tool’s painters open while the day plays');
  const la = await g.ev(`(() => { const A0 = world.areas.length, L = liftById(${nl.id});
    for (const [ox, oz] of [[0, 8], [8, 8], [-8, 8], [0, 14], [10, 0], [-10, 0], [0, -8]]) {
      const cx = Math.round(L.a.x + ox), cz = Math.round(L.a.z + oz), cells = new Set();
      for (let x = cx - 6; x <= cx + 6; x++) for (let z = cz - 6; z <= cz + 6; z++) if (!cellProblem(x, z, null)) cells.add(cellKey(x, z));
      areaDraft = { cells, erase: false, editId: null, blocks: null }; const i = areaDraftInfo();
      if (i && !i.problems.length && i.cost <= state.cash) { renderSheet(); const b = document.querySelector('#sheet [data-action=areaBuild]'); if (b) b.click(); if (world.areas.length > A0) break; }
    }
    const A = world.areas[world.areas.length - 1]; return { made: world.areas.length - A0, closed: !!(A && A.closed), replay: !!matchView.replay };
  })()`);
  eq(la, { made: 1, closed: true, replay: true }, 'a learning area is painted while the day plays, closed for today');
  eq((await orders()).filter((o) => o.kind === 'land').length, 1, 'and the painted ground is ordered for tonight');
  // Clearing trees, levelling and a guest area while skiers are out: the day plays on without a hitch.
  const live = await g.ev(`(() => { const L = liftById(${nl.id}), c0 = state.cash, cleared = state.cleared, t0 = state.time;
    state.landMode = 'trees'; stroke.active = true; for (let k = 0; k < 6; k++) clearAt({ x: L.a.x + 12 + k * 2, y: 0, z: (L.a.z + L.b.z) / 2 }); endStroke();
    state.landMode = 'level'; stroke.active = true; stroke.target = heightAt(L.a.x - 8, L.a.z - 6); for (let k = 0; k < 4; k++) clearAt({ x: L.a.x - 8 + k, y: 0, z: L.a.z - 6 }); endStroke();
    state.landMode = 'hub'; setTool('clear'); const cells = new Set(), A0 = world.areas.length;
    for (const A of world.areas) if (isHub(A)) { for (const k of A.cells) { const x = keyX(k), z = keyZ(k); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!hubCellProblem(x + dx, z + dz, hubBlocks(A))) cells.add(cellKey(x + dx, z + dz)); } editArea(A); for (const k of cells) areaDraft.cells.add(k); renderSheet(); const b = document.querySelector('#sheet [data-action=areaBuild]'); if (b) b.click(); break; }
    borrow(50000);
    for (let k = 0; k < 1500 && state.phase === 'open'; k++) simStep(1.5);
    setTool('explore');
    return { cleared: state.cleared > cleared, cash: state.cash !== c0, ran: state.time > t0, replay: !!matchView.replay, guests: guests.length > 0 }; })()`);
  eq(live, { cleared: true, cash: true, ran: true, replay: true, guests: true }, 'trees, levelling, a guest area and a loan while the day plays');
  const kinds = (await orders()).map((o) => o.kind + ':' + (o.payload.what || '')).join(' ');
  assert(/build:trees/.test(kinds) && /land:/.test(kinds), `trees and painted ground are ordered for tonight (${kinds})`);
  await g.ev(`setTool('explore')`); await g.wait(200);
  // Removing a lift while the day plays: it stays for today, and goes tonight.
  const L0 = await g.ev('world.lifts[0].id'); n0 = (await orders()).length;
  await g.ev(`select({ kind: 'lift', obj: liftById(${L0}) })`); await press('[data-action=remove]'); await press('[data-action=removeYes]');
  const rm = await g.ev(`({ there: !!liftById(${L0}), open: liftById(${L0}).open, replay: !!matchView.replay, note: document.getElementById('sheet').innerText })`);
  eq([rm.there, rm.open, rm.replay], [true, true, true], 'a lift removed while the day plays keeps running today');
  assert(/Removed tonight/.test(rm.note), 'its card says it goes tonight');
  const o = await orders(); eq([o.length, o[o.length - 1].kind], [n0 + 1, 'remove'], 'the removal is ordered for tonight');
  await g.wait(100); assert(!(await g.ev(`!!document.querySelector('#sheet [data-action=remove]')`)), 'and it can’t be removed twice');
  // Pausing by hand shows tomorrow's resort: the new lift open, the removed one gone.
  await g.ev(`select(null); document.getElementById('visitWatch').click()`); await g.wait(1500);
  eq(await g.ev(`[!!matchView.replay, !!liftById(${L0}), !!liftById(${nl.id}) && liftById(${nl.id}).open]`), [false, false, true], 'paused, tomorrow’s resort has the new lift open and the removed one gone');
  await g.wait(200); eq(await g.ev('(drawPeople(), figMeshes.jacket.count - guests.filter((x) => x.px != null).length)'), 0, 'rivals’ skiers go when the day pauses');
  await g.ev(`document.getElementById('visitWatch').click()`);
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  eq(await g.ev(`liftById(${nl.id}).open`), false, 'back in the live day, the new lift is closed again until tomorrow');
  // Shrinking the parking lot still needs the resort closed: it pauses.
  await g.ev(`(() => { select({ kind: 'manage', obj: 'lotgrow' }); renderSheet(); })()`); await g.wait(300);
  const shrink = await g.ev(`(() => { const b = document.querySelector('#sheet [data-action=shrinkLot]'); if (b && !b.disabled) b.click(); return !!b; })()`);
  assert(shrink, 'the lot panel has Remove the newest section');
  { await g.wait(1500); eq(await g.ev('[!!matchView.replay, matchView.paused]'), [false, true], 'shrinking the lot pauses the day'); }
  // The chat stays open when the day picks up again: closing it under your cursor made your letters game shortcuts.
  await g.ev(`select(null)`); await g.click('#visitChat'); await g.wait(300); await g.page.click('#mcText'); await g.page.keyboard.type('gl');
  await g.ev(`setTool('explore')`);
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  await g.page.keyboard.type(' 3 wasd');
  eq(await g.ev(`[selected && selected.kind, document.activeElement.id, document.getElementById('mcText').value, state.tool, !!matchView.replay]`), ['mchat', 'mcText', 'gl 3 wasd', 'explore', true], 'typing in the chat as the day starts stays in the chat');
  // Reports opens the past days.
  await g.click('#visitReports'); await g.wait(300);
  assert(await g.page.$('#sheet [data-action=pastReport]'), 'Reports lists the past days');

  // When the day is over (5:15 PM with no evening plans, about 21 minutes in), it ends with the server's own report.
  await g.ev(`matchView.lobby.starts_at = new Date(Date.now() - 86 * 60000).toISOString(); matchTick()`); await g.wait(800);
  const end = await g.ev(`({ phase: state.phase, replay: !!matchView.replay, report: !document.getElementById('report').hidden, day: state.lastReport && state.lastReport.day, guests: state.lastReport && state.lastReport.guests })`);
  eq([end.phase, end.replay, end.report], ['closed', false, true], 'at night the watched day ends with the day report');
  eq(end.guests, save.clock.lastReport.guests, 'and it is the server’s report, not the one played on screen');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
