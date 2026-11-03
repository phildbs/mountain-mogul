// One clock for the whole match: the live day runs until the last resort closes, so with no evening plans of your own
// you still watch your rivals' night skiing and après; and on a day your resort stays closed you watch theirs.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter); await m.ev(SETUPS.midwinter);
  await m.ev(`(() => { state.cash = 3e6; openDay(); state.speed = 0; let n = 0; while (state.phase === 'open' && n++ < 200000) simStep(1.5); nextDay(); })()`);
  const plain = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.ev(`(() => { for (const t of realTrails()) t.lit = true; rebuildLights(); for (const [k] of OPS_KINDS) Object.assign(opsState().plans[k], { night: 1260, apres: 'on', lastCall: 1260 }); })()`);
  const eve = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();
  const names = ['Summit Ridge', 'Phil’s Peak', 'Rival Run'];
  const open = async (id, minsIn, share) => {
    const g = await openGame(browser, url, {});
    const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
    const match = { lobbies: [{ id, name: 'Night Cup', map: 'match', slots: 3, starts_at: ago(60 + minsIn), days: 168, day_minutes: 30, status: 'running', day: 2, prize: null }],
      players: [0, 1, 2].map((s) => ({ lobby_id: id, slot: s, user_id: [null, 'user-B', null][s], resort_name: names[s] })),
      resorts: [0, 1, 2].map((s) => ({ lobby_id: id, slot: s, day: 2, save: s === 1 ? plain : eve, summary: { name: names[s], profit: 100 * s, guests: 300 } })), orders: [],
      days: [{ lobby_id: id, day: 2, results: { wx: 'sunny', share, resorts: [0, 1, 2].map((s) => ({ slot: s, guests: share[s], profit: 1000 })) } }] };
    await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
    await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
    await g.click('#mpCard'); await g.page.waitForSelector(`[data-mp=open][data-id=${id}]`, { timeout: 10000 }); await g.page.click(`[data-mp=open][data-id=${id}]`);
    await g.reloaded(); await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView)'), null, { timeout: 20000 });
    return g;
  };
  // 23 minutes in: your own day (no evening plans) would be over by 21, but your rivals night ski until 9 PM.
  const g = await open('N1', 23, [200, 250, 200]);
  const c = await g.ev(`({ own: plannedEnd(), end: replayEnd(), can: canWatch() })`);
  eq([c.own, c.end, c.can], [1035, 1260 + 45 + 10, true], 'the match clock runs to the last rival’s close, so the day can still be watched');
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  await g.wait(1500);
  const w = await g.ev(`(refreshTimebar(true), { time: state.time, want: replayClock(matchView.lobby), own: dayHardEnd(), sub: $('tbSub').innerText, rivals: RIVAL_SKI.slices.map((sl) => [rivalNight(sl), rivalApres(sl)]), ghosts: RIVAL_SKI.ghosts.length })`);
  assert(w.time > w.own && Math.abs(w.time - w.want) < 10, `the day plays on past your own close, in step with the clock (${w.time.toFixed(0)} vs ${w.want.toFixed(0)}, own end ${w.own})`);
  assert(/your rivals’ evening is on/.test(w.sub), `the bar says so (${w.sub})`);
  eq(w.rivals, [[true, true], [true, true]], 'your rivals are night skiing and their bars are open');
  assert(w.ghosts > 0, 'with their skiers out');
  await g.ev(`(() => { let n = 0; while (state.phase === 'open' && matchView.replay && state.time < matchView.replay.end - 2 && n++ < 100000) replayKeep(() => simStep(1.5)); })()`);
  eq(await g.ev(`[state.phase, !!matchView.replay]`), ['open', true], 'still on just before the last close');
  await g.ev(`(() => { let n = 0; while (state.phase === 'open' && matchView.replay && n++ < 100000) replayKeep(() => simStep(1.5)); })()`);
  eq(await g.ev(`!!matchView.replay`), false, 'and over once the last resort closes');
  await g.page.close();
  // Closed today (no skiers for you): watch your rivals' day instead of nothing.
  const s = await open('N2', 5, [200, 0, 200]);
  await s.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  await s.wait(1500);
  const z = await s.ev(`(refreshTimebar(true), { shut: matchView.replay.shut, guests: guests.length, sched: schedule.length, sub: $('tbSub').innerText, ghosts: RIVAL_SKI.ghosts.length, cash: state.cash })`);
  eq([z.shut, z.guests, z.sched], [true, 0, 0], 'your resort is closed and nobody comes');
  assert(z.ghosts > 0 && /Closed today · watching your rivals/.test(z.sub), `your rivals’ skiers are out and the bar says so (${JSON.stringify(z)})`);
  eq(Math.round(z.cash), Math.round(plain.cash), 'your real cash is untouched');
}
