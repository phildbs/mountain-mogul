// Watching today live: during a day's ski slot, Watch today plays the day on screen in step with the clock (the
// lifts open as the slot begins and close five minutes before the next) with the share of skiers the server gave
// this resort; Stop watching, or the end of the slot, goes back to building with the server's official numbers.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter); await m.ev(SETUPS.midwinter);
  const save = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();
  const g = await openGame(browser, url);
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString(), names = ['Summit Ridge', 'Phil’s Peak', 'Rival Run'];
  // Day 2 began 5 minutes ago (slots of 30 minutes: day 2 started at the start time plus 60 minutes).
  const match = { lobbies: [{ id: 'R1', name: 'Replay Cup', map: 'match', slots: 3, starts_at: ago(65), days: 168, day_minutes: 30, status: 'running', day: 2, prize: null }],
    players: [0, 1, 2].map((s) => ({ lobby_id: 'R1', slot: s, user_id: [null, 'user-B', null][s], resort_name: names[s] })),
    resorts: [0, 1, 2].map((s) => ({ lobby_id: 'R1', slot: s, day: 2, save, summary: { name: names[s], profit: 100 * s, guests: 300 } })),
    days: [{ lobby_id: 'R1', day: 2, results: { wx: 'sunny', share: [100, 150, 90], resorts: [{ slot: 0, guests: 99, profit: 1000 }, { slot: 1, guests: 148, profit: 4099 }, { slot: 2, guests: 88, profit: -200 }] } }] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await g.click('#mpCard'); await g.page.waitForSelector('[data-mp=open][data-id=R1]', { timeout: 10000 }); await g.page.click('[data-mp=open][data-id=R1]');
  await g.reloaded(); await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView)'), null, { timeout: 20000 });
  eq([await g.page.isVisible('#visitWatch'), await g.page.innerText('#visitWatch')], [true, 'Watch today'], 'during the ski slot you can watch today');
  eq(await g.ev(`getComputedStyle(document.querySelector('.tb-speed')).display`), 'none', 'no speed buttons in a match: the clock sets the pace');

  await g.click('#visitWatch');
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  const w = await g.ev(`({ time: state.time, want: replayClock(matchView.lobby), speed: state.speed, bar: document.getElementById('visitText').innerText, btn: document.getElementById('visitWatch').innerText, expected: today.expected })`);
  assert(Math.abs(w.time - w.want) < 5 && Math.abs(w.want - (480 + 555 * 5 / 25)) < 3, `the day is at the right time of day (${w.time.toFixed(0)} vs ${w.want.toFixed(0)})`);
  assert(w.speed > 0.25 && w.speed < 0.5, `and runs in step with the clock (${w.speed.toFixed(2)})`);
  eq(w.expected, 150, 'with the share of skiers the server gave this resort');
  assert(/watching day 2 live/.test(w.bar) && w.btn === 'Stop watching', 'the bar says so');
  await g.wait(3000);
  assert(await g.ev('guests.length > 0'), 'skiers are out on the mountain');

  // Stop watching: back to building, nothing changed.
  await g.click('#visitWatch'); await g.wait(500);
  eq(await g.ev(`[state.phase, !!matchView.replay, world.lifts.length]`), ['closed', false, 1], 'Stop watching goes back to building');

  // Watch again, then let the slot run out: it ends with the server's numbers.
  await g.click('#visitWatch');
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  await g.ev(`matchView.lobby.starts_at = new Date(Date.now() - 86 * 60000).toISOString(); matchTick()`); await g.wait(800);
  const end = await g.ev(`({ phase: state.phase, replay: !!matchView.replay, toast: document.getElementById('toast').textContent, report: document.getElementById('report').hidden })`);
  eq([end.phase, end.replay, end.report], ['closed', false, true], 'at night the watched day ends, with no local day report');
  assert(/Day 2 is over\. Official: 148 guests, \$4,099/.test(end.toast), `and the official numbers (${end.toast})`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
