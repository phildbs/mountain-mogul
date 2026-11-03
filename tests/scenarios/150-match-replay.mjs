// Watching today live: during a day's ski slot, Watch today plays the day on screen in step with the clock (the
// lifts open as the slot begins and close five minutes before the next) with the share of skiers the server gave
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
    days: [{ lobby_id: 'R1', day: 2, results: { wx: 'sunny', share: [100, 150, 90], resorts: [{ slot: 0, guests: 99, profit: 1000 }, { slot: 1, guests: 148, profit: 4099 }, { slot: 2, guests: 88, profit: -200 }] } }] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await g.click('#mpCard'); await g.page.waitForSelector('[data-mp=open][data-id=R1]', { timeout: 10000 }); await g.page.click('[data-mp=open][data-id=R1]');
  await g.reloaded(); await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView)'), null, { timeout: 20000 });
  eq(await g.ev(`getComputedStyle(document.querySelector('.tb-speed')).display`), 'none', 'no speed buttons in a match: the clock sets the pace');
  // The day plays by itself.
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  const w = await g.ev(`({ time: state.time, want: replayClock(matchView.lobby), speed: state.speed, bar: document.getElementById('visitText').innerText, btn: document.getElementById('visitWatch').innerText, expected: today.expected })`);
  assert(Math.abs(w.time - w.want) < (process.env.SHOTS ? 15 : 5) && Math.abs(w.want - (480 + 555 * 5 / 25)) < 3, `today plays by itself, at the right time of day (${w.time.toFixed(0)} vs ${w.want.toFixed(0)})`);
  assert(w.speed > 0.25 && w.speed < 0.5, `in step with the clock (${w.speed.toFixed(2)})`);
  eq(w.expected, 150, 'with the share of skiers the server gave this resort');
  assert(/watching day 2 live/.test(w.bar) && w.btn === 'Pause the day', 'the bar says so');
  await g.wait(3000);
  assert(await g.ev('guests.length > 0'), 'skiers are out on the mountain');
  await g.wait(2000);
  assert(Math.abs(await g.ev('state.cash') - save.cash) < 1, 'the cash shown stays your real cash while the day plays (it was already counted by the server)');
  const rv = await g.ev(`(() => { cam.viewH = 60; cam.viewGoal = null; rivalSkiersTick(0.05); drawPeople(); const own = world.lifts[0].a, G = RIVAL_SKI.ghosts, far = G.map((x) => Math.hypot(x.x - own.x, x.z - own.z));
    const drawn = guests.filter((x) => x.px != null).length;
    return { n: G.length, shown: figMeshes.jacket.count - drawn, on: RIVAL_SKI.on, minFar: Math.min(...far), riding: G.filter((x) => x.mode === 'lift').length, skiing: G.filter((x) => x.mode === 'ski').length,
      chairs: RIVAL_SKI.slices.every((sl) => sl.lifts.every((R) => R.V.chairs && R.V.chairCount > 1)), trees: (matchView.rivalCut || []).filter((k) => trees.alive[k]).length, cut: (matchView.rivalCut || []).length,
      looks: rivalGroup.children.filter((o) => o.userData.rival).every((o) => o.material.map === CORD && o.material.opacity === 1) }; })()`);
  eq([rv.on, rv.n], [true, Math.round(100 * 0.25) + Math.round(90 * 0.25)], 'rivals have skiers too, in proportion to their share of the day');
  assert(rv.riding > 0 && rv.skiing > 0, `some riding up, some skiing down (${rv.riding}, ${rv.skiing})`);
  eq([rv.chairs, rv.looks], [true, true], 'rival lifts have chairs, and their trails are drawn like yours');
  // Chairs are made while the view is zoomed out (hidden then): zooming in shows them, like yours.
  eq(await g.ev(`(() => { cam.viewH = 300; updateChairs(); const a = RIVAL_SKI.slices.every((sl) => sl.lifts.every((R) => !R.V.chairs.visible)); cam.viewH = 60; updateChairs(); return [a, RIVAL_SKI.slices.every((sl) => sl.lifts.every((R) => R.V.chairs.visible))]; })()`), [true, true], 'rival chairs hide and show with zoom, like yours');
  // Rivals' slices aren't hazed like land beyond the boundary.
  eq(await g.ev(`(() => { const R = RIVAL_SKI.slices[0].lifts[0], x = (R.a.x + R.b.x) / 2 + HALF, z = (R.a.z + R.b.z) / 2 + HALF; return hazeAt(x, z) < 0.05; })()`), true, 'rival slices aren’t faded');
  assert(rv.cut > 0 && rv.trees === 0, `the trees on rivals’ trails and lift lines are gone (${rv.cut} cut)`);
  if (process.env.SHOTS) { await g.ev("document.getElementById('updCard').hidden = true; cam.viewH = 150; cam.viewGoal = null; updateCamera()"); await g.wait(2500); await g.page.screenshot({ path: 'rival-skiers.png' }); }
  assert(rv.shown === rv.n && rv.minFar > 25, `drawn with your guests’ figures, on their own slices, away from yours (${JSON.stringify(rv)})`);

  // A build tool pauses it; Explore picks it up again.
  await g.ev(`setTool('lift')`); await g.wait(300);
  eq(await g.ev(`[state.phase, !!matchView.replay, matchView.paused, state.tool]`), ['closed', false, true, 'lift'], 'picking a build tool pauses the day so you can build');
  await g.wait(200); eq(await g.ev('(drawPeople(), figMeshes.jacket.count - guests.filter((x) => x.px != null).length)'), 0, 'rivals’ skiers go when the day pauses');
  await g.ev(`setTool('explore')`);
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  // Parking any time: the button works while the day plays; the day pauses and the section is ordered.
  const lots = await g.ev('state.lotSections');
  await g.ev(`(() => { state.cash = Math.max(state.cash, 2e6); select({ kind: 'manage', obj: 'parking' }); renderSheet(); })()`); await g.wait(300);
  const btn = await g.ev(`(() => { const b = [...document.querySelectorAll('#sheet [data-action=expandLot]')].find((x) => !x.disabled); if (b) b.click(); return !!b; })()`);
  await g.wait(500);
  eq([btn, await g.ev('state.lotSections'), await g.ev('!!matchView.replay'), await g.ev('matchView.paused')], [true, lots + 1, false, true], 'parking can be added while the day plays: it pauses and the section is added');
  const lotOrders = await g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.orders.filter((o) => o.payload.what === 'lot').length);
  eq(lotOrders, 1, 'and it goes to the server for the next overnight');
  // The chat stays open when the day picks up again: closing it under your cursor made your letters game shortcuts.
  await g.ev(`select(null)`); await g.click('#visitChat'); await g.wait(300); await g.page.click('#mcText'); await g.page.keyboard.type('gl');
  await g.ev(`setTool('explore')`);
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  await g.page.keyboard.type(' 3 wasd');
  eq(await g.ev(`[selected && selected.kind, document.activeElement.id, document.getElementById('mcText').value, state.tool, !!matchView.replay]`), ['mchat', 'mcText', 'gl 3 wasd', 'explore', true], 'typing in the chat as the day starts stays in the chat');
  // Reports opens the past days.
  await g.click('#visitReports'); await g.wait(300);
  assert(await g.page.$('#sheet [data-action=pastReport]'), 'Reports lists the past days');

  // When the slot's ski part ends, the day ends with the server's own report.
  await g.ev(`matchView.lobby.starts_at = new Date(Date.now() - 86 * 60000).toISOString(); matchTick()`); await g.wait(800);
  const end = await g.ev(`({ phase: state.phase, replay: !!matchView.replay, report: !document.getElementById('report').hidden, day: state.lastReport && state.lastReport.day, guests: state.lastReport && state.lastReport.guests })`);
  eq([end.phase, end.replay, end.report], ['closed', false, true], 'at night the watched day ends with the day report');
  eq(end.guests, save.clock.lastReport.guests, 'and it is the server’s report, not the one played on screen');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
