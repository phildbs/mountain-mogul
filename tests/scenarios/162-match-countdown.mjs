// Between match days the top bar counts down to the next day by the second; once it's due it says the server is
// playing it; and while today is still playing but paused, it offers Back to the live day.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter); await m.ev(SETUPS.midwinter);
  await m.ev(`(() => { openDay(); state.speed = 0; let n = 0; while (state.phase === 'open' && n++ < 200000) simStep(1.5); nextDay(); })()`);
  const save = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();
  const g = await openGame(browser, url, {});
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString(), names = ['Summit Ridge', 'Phil’s Peak', 'Rival Run'];
  // Day 2's slot began 5 minutes ago: it's playing now.
  const match = { lobbies: [{ id: 'C1', name: 'Clock Cup', map: 'match', slots: 3, starts_at: ago(65), days: 168, day_minutes: 30, status: 'running', day: 2, prize: null }],
    players: [0, 1, 2].map((s) => ({ lobby_id: 'C1', slot: s, user_id: [null, 'user-B', null][s], resort_name: names[s] })),
    resorts: [0, 1, 2].map((s) => ({ lobby_id: 'C1', slot: s, day: 2, save, summary: { name: names[s], profit: 100 * s, guests: 300 } })), orders: [],
    days: [{ lobby_id: 'C1', day: 2, results: { wx: 'sunny', share: [100, 150, 90], resorts: [{ slot: 0, guests: 99, profit: 1000 }, { slot: 1, guests: 148, profit: 4099, cash0: save.cash - 5000, debt0: 0 }, { slot: 2, guests: 88, profit: -200 }] } }] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await g.click('#mpCard'); await g.page.waitForSelector('[data-mp=open][data-id=C1]', { timeout: 10000 }); await g.page.click('[data-mp=open][data-id=C1]');
  await g.reloaded(); await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView)'), null, { timeout: 20000 });
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  const bar = () => g.ev(`(refreshTimebar(true), { clock: $('tbClock').textContent, sub: $('tbSub').innerText, btn: !!$('tbSub').querySelector('[data-watch]') })`);
  eq(await g.ev('matchCountdown()'), null, 'no countdown while the day plays');
  // Paused: today is still on, so the bar offers to go back to it.
  await g.click('#visitWatch'); await g.wait(300);
  const p = await bar();
  assert(p.clock === 'Live' && /Day 2 is playing now/.test(p.sub) && p.btn, `paused, the bar says today is on (${JSON.stringify(p)})`);
  await g.page.click('#tbSub [data-watch]');
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 10000 });
  eq(await g.ev('matchView.paused'), false, 'Back to the live day plays it again');
  // Today is over (the slot began 25 minutes ago): count down to day 3, by the second.
  await g.ev(`(() => { stopReplay(true); matchView.lobby.starts_at = new Date(Date.now() - (60 + 25) * 60000 - 30000).toISOString(); })()`);
  const c1 = await bar();
  assert(/^4:\d\d$/.test(c1.clock) && /Day 3 opens in 4 min \d\d s/.test(c1.sub) && !c1.btn, `the next day counts down (${JSON.stringify(c1)})`);
  await g.wait(2100);
  const c2 = await bar();
  assert(c2.clock !== c1.clock, `by the second (${c1.clock} → ${c2.clock})`);
  // Due: the server is playing it.
  await g.ev(`matchView.lobby.starts_at = new Date(Date.now() - 90 * 60000 - 5000).toISOString()`);
  const c3 = await bar();
  assert(c3.clock === '…' && /Day 3 is starting/.test(c3.sub), `once due, it says the server is playing it (${JSON.stringify(c3)})`);
  // A day you paused doesn't keep the next one from playing live.
  await g.ev(`(() => { matchView.paused = true; const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.match.lobbies[0].day = 3; matchView.lobby.starts_at = d.match.lobbies[0].starts_at = new Date(Date.now() - 90 * 60000 - 20000).toISOString();
    for (const r of d.match.resorts) r.day = 3; d.match.days.push({ lobby_id: 'C1', day: 3, results: d.match.days[0].results }); localStorage.setItem('FAKE_DB', JSON.stringify(d)); })()`);
  await g.ev('matchTick()');
  eq(await g.ev('[matchView.lobby.day, matchView.paused]'), [3, false], 'when day 3 arrives it plays live, even though day 2 was paused');
}
