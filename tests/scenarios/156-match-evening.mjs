// Night skiing and après in a match: the live day runs on into the evening. The day to 4 PM takes the first 18
// minutes of the half-hour slot, then the evening (to the end of night skiing and last call) plays faster, done by
// 28 minutes. Rivals' slices have evenings too: their skiers keep to lit trails while they night ski and otherwise
// head home, and their lit trails and open bars light up.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter); await m.ev(SETUPS.midwinter);
  await m.ev(`(() => { state.cash = 3e6; for (const t of realTrails()) t.lit = true; rebuildLights();
    for (const [k] of OPS_KINDS) Object.assign(opsState().plans[k], { night: 1260, apres: 'on', lastCall: 1260 });
    openDay(); state.speed = 0; let n = 0; while (state.phase === 'open' && n++ < 200000) simStep(1.5); nextDay(); })()`);
  const save = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();
  assert(save.clock.lastReport.rev.night > 0 && save.clock.lastReport.rev.apres > 0, 'the resort sold night tickets and après the day before (as the match server plays it)');
  const g = await openGame(browser, url, { render: !!process.env.SHOTS });
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString(), names = ['Summit Ridge', 'Phil’s Peak', 'Rival Run'];
  // Day 2 began 23 minutes ago: well into the evening.
  const match = { lobbies: [{ id: 'E1', name: 'Evening Cup', map: 'match', slots: 3, starts_at: ago(83), days: 168, day_minutes: 30, status: 'running', day: 2, prize: null }],
    players: [0, 1, 2].map((s) => ({ lobby_id: 'E1', slot: s, user_id: [null, 'user-B', null][s], resort_name: names[s] })),
    resorts: [0, 1, 2].map((s) => ({ lobby_id: 'E1', slot: s, day: 2, save, summary: { name: names[s], profit: 100 * s, guests: 300 } })), orders: [],
    days: [{ lobby_id: 'E1', day: 2, results: { wx: 'sunny', share: [200, 250, 200], resorts: [{ slot: 0, guests: 199, profit: 1000 }, { slot: 1, guests: 248, profit: 4099 }, { slot: 2, guests: 188, profit: -200 }] } }] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await g.click('#mpCard'); await g.page.waitForSelector('[data-mp=open][data-id=E1]', { timeout: 10000 }); await g.page.click('[data-mp=open][data-id=E1]');
  await g.reloaded(); await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView)'), null, { timeout: 20000 });
  // The clock: 4 PM at 18 minutes, the end of the evening at 28.
  const c = await g.ev(`(() => { const l = matchView.lobby, M = 60000, end = plannedEnd(); return { end, at18: replayClock(l, 18 * M, end), at28: replayClock(l, 28 * M, end), at29: replayClock(l, 29 * M, end),
    plain: replayClock(l, 21 * M, DAY_HARD_END), can: canWatch() }; })()`);
  eq(c.end, Math.max(1260 + 30, 1260 + 45 + 10), 'tonight runs to the end of night skiing and last call, as the game’s own day does');
  eq([Math.round(c.at18), Math.round(c.at28), Math.round(c.at29)], [960, c.end, c.end], 'lifts close at 18 minutes, the evening is over by 28');
  assert(Math.abs(c.plain - 1035) < 3, `with no evening plans the day is over a little after 21 minutes (${c.plain.toFixed(0)})`);
  eq(c.can, true, 'so the day can still be watched 23 minutes in');
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  await g.wait(1500);
  const w = await g.ev(`({ time: state.time, want: replayClock(matchView.lobby), speed: state.speed, night: nightNow(), apres: apresOn(), end: matchView.replay.end, dusk: duskK })`);
  assert(Math.abs(w.time - w.want) < (process.env.SHOTS ? 20 : 10) && w.want > 1100 && w.want < 1200, `the live day is in the evening, in step with the clock (${w.time.toFixed(0)} vs ${w.want.toFixed(0)})`);
  eq([w.night, w.apres, w.end], [true, true, c.end], 'under the lights, with après on');
  assert(w.speed > 0.5 && w.speed < 1.2, `the evening plays faster than the day (${w.speed.toFixed(2)})`);
  assert(await g.ev('guests.some((x) => x.night && !x.gone)'), 'night skiers are out');
  // Rivals: lit trails and lifts, and only night skiers left skiing.
  const r = await g.ev(`(() => { for (let k = 0; k < 400; k++) rivalSkiersTick(0.1); const S = RIVAL_SKI.slices, G = RIVAL_SKI.ghosts;
    const onLit = G.filter((x) => x.mode === 'ski').every((x) => x.sl.trails[x.i].lit) && G.filter((x) => x.mode === 'lift').every((x) => x.sl.lifts[x.i].lit);
    return { n: S.length, eve: S.map((sl) => sl.eve), lamps: S.every((sl) => sl.lamps.length > 2), litLifts: S.every((sl) => sl.lifts.some((R) => R.lit)), night: S.every(rivalNight), apres: S.every(rivalApres),
      out: G.filter((x) => x.mode !== 'gone').length, gone: G.filter((x) => x.mode === 'gone').length, onLit, sig: rivalEveSig(), bars: S.every((sl) => sl.blds.some((b) => b.apres && rivalBldLit(sl, b))) }; })()`);
  eq([r.n, r.eve[0], r.lamps, r.litLifts, r.night, r.apres], [2, { night: 1260, apres: 1305 }, true, true, true, true], 'rivals night ski on their lit trails and run après, from their own plans');
  assert(r.gone > 0 && r.out > 0 && r.onLit, `some of their skiers went home; the rest are on lit trails and lifts (${r.out} out, ${r.gone} gone)`);
  assert(r.bars && /1/.test(r.sig), 'their après venues are lit');
  if (process.env.SHOTS) { await g.ev("document.getElementById('updCard').hidden = true; cam.viewH = 170; cam.viewGoal = null; updateCamera()"); await g.wait(3000); await g.page.screenshot({ path: 'match-evening.png' }); }
  // After night skiing, rivals' last skiers go home and their lights go off; après stays on until last call.
  const late = await g.ev(`(() => { const t = state.time; state.time = 1262; for (let k = 0; k < 4000; k++) rivalSkiersTick(0.1); const S = RIVAL_SKI.slices;
    const o = { out: RIVAL_SKI.ghosts.filter((x) => x.mode !== 'gone').length, night: S.some(rivalNight), apres: S.every(rivalApres) }; state.time = t; return o; })()`);
  eq(late, { out: 0, night: false, apres: true }, 'after night skiing every rival skier has gone home, and après carries on');
  // The end of the evening ends the day with the server's report.
  await g.ev(`matchView.lobby.starts_at = new Date(Date.now() - (60 + 28.5) * 60000).toISOString(); matchTick()`); await g.wait(800);
  eq(await g.ev(`[state.phase, !!matchView.replay, !document.getElementById('report').hidden]`), ['closed', false, true], 'at 28 minutes the evening is over and the day report shows');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
