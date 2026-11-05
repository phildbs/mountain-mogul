// When a match you played in has finished, its results come up on the title screen once: where you came, the
// podium and standings, your resort's figures and any badge, with a button to look at the mountain. A second
// finished match follows when the first is closed; long-finished matches and matches you only watched never show.
import { openGame, SETUPS, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter);
  const save = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();
  const g = await openGame(browser, url);
  const at = (min) => new Date(Date.now() + min * 60000).toISOString();
  const lob = (id, name, startMin, extra = {}) => ({ id, name, map: 'match', slots: 3, starts_at: at(startMin), days: 7, day_minutes: 30, status: 'finished', day: 7, ...extra });
  const sum = (name, profit, more = {}) => ({ name, profit, guests: 4200, passes: 31, cash: 812000, debt: 0, rep: 1.2, ticket: 62, lifts: 3, trails: 7, buildings: 5, ...more });
  const match = {
    lobbies: [lob('W1', 'Winter Cup', -300, { prize: 'Winter Cup champion' }), lob('S2', 'Slow Cup', -600, { kind: 'custom', map: 'ridge', slots: 4 }),
      lob('O3', 'Ancient Cup', -60 * 24 * 40), lob('R4', 'Live Cup', -100, { status: 'running', day: 3 }), lob('X5', 'Watched Cup', -300)],
    players: [{ lobby_id: 'W1', slot: 0, user_id: 'user-B', resort_name: 'Phil’s Peak', place: 1 }, { lobby_id: 'W1', slot: 1, user_id: 'u-x', resort_name: 'Other Hill', place: 2 },
      { lobby_id: 'W1', slot: 2, user_id: null, resort_name: 'Robo Bowl' }, 
      { lobby_id: 'S2', slot: 0, user_id: 'u-x', resort_name: 'Top Notch', place: 1 }, { lobby_id: 'S2', slot: 1, user_id: 'user-B', resort_name: 'Second Slope', place: 2 }, { lobby_id: 'S2', slot: 2, user_id: 'u-y', resort_name: 'Fourth Fell' }, { lobby_id: 'S2', slot: 3, user_id: null, resort_name: 'Third Thing' },
      { lobby_id: 'O3', slot: 0, user_id: 'user-B', resort_name: 'Old Peak', place: 1 }, { lobby_id: 'R4', slot: 0, user_id: 'user-B', resort_name: 'Busy Peak' },
      { lobby_id: 'X5', slot: 0, user_id: 'u-x', resort_name: 'Seen Hill', place: 1 }],
    resorts: [{ lobby_id: 'W1', slot: 0, day: 7, save, summary: sum('Phil’s Peak', 90000) }, { lobby_id: 'W1', slot: 1, day: 7, save, summary: sum('Other Hill', 50000) },
      { lobby_id: 'W1', slot: 2, day: 7, save, summary: sum('Robo Bowl', 20000, { computer: true }) },
      { lobby_id: 'S2', slot: 0, day: 7, save, summary: sum('Top Notch', 70000) }, { lobby_id: 'S2', slot: 1, day: 7, save, summary: sum('Second Slope', 30000, { debt: 120000 }) }, { lobby_id: 'S2', slot: 2, day: 7, summary: sum('Fourth Fell', -4000) }, { lobby_id: 'S2', slot: 3, day: 7, summary: sum('Third Thing', 100, { computer: true }) },
      { lobby_id: 'O3', slot: 0, day: 7, save, summary: sum('Old Peak', 1) }, { lobby_id: 'R4', slot: 0, day: 3, save, summary: sum('Busy Peak', 1) }, { lobby_id: 'X5', slot: 0, day: 7, save, summary: sum('Seen Hill', 1) }],
    badges: [{ user_id: 'user-B', lobby_id: 'W1', place: 1, title: 'Winter Cup champion' }],
  };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true }, 'u-x': { name: 'Lou', public: true }, 'u-y': { name: 'Fay', public: false } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); localStorage.setItem('mm.kotm.intro', '1'); }, match);
  const shown = () => g.ev(`$('mpDone').hidden ? null : $('mpdBody').innerText`);

  // A guest gets nothing.
  await g.ev('MP_DONE.at = 0; loadMatchDone()'); await g.wait(800);
  eq(await shown(), null, 'nothing for a guest');

  // Signed in: the newest finished match first.
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await g.ev('MP_DONE.at = 0; loadMatchDone()');
  await g.page.waitForFunction(() => !document.getElementById('mpDone').hidden, null, { timeout: 10000 });
  let t = await shown();
  eq(await g.ev(`$('mpdTitle').textContent`), 'Winter Cup', 'the newest finished match comes up');
  assert(/You won!/.test(t) && /Phil’s Peak on Crown Peak · finished after 7 days/.test(t), `you won, and where (${t.slice(0, 200)})`);
  assert(/You earned the “Winter Cup champion” badge/.test(t), 'with the badge you earned');
  eq(await g.ev(`[...document.querySelectorAll('#mpdBody .podium .nm')].map((e) => e.textContent)`), ['Phil’s Peak', 'Other Hill', 'Robo Bowl'], 'the top three on the podium');
  eq(await g.ev(`[...document.querySelectorAll('#mpdBody .podium .sub')].map((e) => e.textContent)`), ['Phil', 'Lou', 'Computer'], 'with who ran them');
  assert(/Season profit\s*\$90,000/i.test(t) && /Guests\s*4,200/i.test(t) && /Season passes sold\s*31/i.test(t) && /Reputation\s*Great/i.test(t) && /Lifts · trails\s*3 · 7/i.test(t), `your resort’s figures (${JSON.stringify(t)})`);
  assert(!/Debt/i.test(t), 'no debt line without debt');
  assert(!/Ancient Cup|Live Cup|Watched Cup/.test(t), 'only this match');

  // Closing it brings the next one; then nothing more, and not again later.
  await g.click('#mpdClose');
  await g.page.waitForFunction(() => document.getElementById('mpdTitle').textContent === 'Slow Cup' && !document.getElementById('mpDone').hidden, null, { timeout: 10000 });
  t = await shown();
  assert(/You came 2nd of 4/.test(t) && /on Ridgeline/.test(t) && !/badge/.test(t) && /Debt\s*\$120,000/i.test(t), `the second: 2nd of 4, no badge, its debt (${t.slice(0, 300)})`);
  assert(/4th · Fourth Fell\s*A player/.test(t), `fourth place below the podium, a private profile as “A player” (${t})`);
  await g.click('#mpdClose'); await g.wait(600);
  eq(await shown(), null, 'no more: the long-finished, running and watched matches never show');
  await g.ev('MP_DONE.at = 0; loadMatchDone()'); await g.wait(1200);
  eq(await shown(), null, 'and not again once seen');
  eq((await g.ev(`JSON.parse(localStorage.getItem('mm.kotm.done'))`)).sort(), ['O3', 'S2', 'W1'], 'remembered on this device');

  // On a phone it fits, and Look at the mountain opens the finished match.
  await g.ev(`localStorage.setItem('mm.kotm.done', '[]'); MP_DONE.at = 0; loadMatchDone()`);
  await g.page.waitForFunction(() => !document.getElementById('mpDone').hidden, null, { timeout: 10000 });
  await g.page.setViewportSize({ width: 390, height: 844 }); await g.wait(400);
  const wide = await g.page.evaluate(() => { const el = document.querySelector('#mpDone .modal'); return { over: el.scrollWidth - el.clientWidth, page: document.documentElement.scrollWidth - window.innerWidth }; });
  assert(wide.over <= 1 && wide.page <= 1, `fits a phone (${JSON.stringify(wide)})`);
  if (process.env.SHOTS) await g.page.screenshot({ path: 'match-results.png' });
  await g.page.setViewportSize({ width: 1280, height: 900 });
  await g.page.click('#mpdBody [data-mpd=look]');
  await g.reloaded(); await g.page.waitForFunction(() => window.__dbg('!!matchView && matchView.lobby && matchView.lobby.id'), null, { timeout: 20000 });
  eq(await g.ev('[matchView.lobby.id, matchView.me, !!matchPlay]'), ['W1', true, false], 'Look at the mountain opens the finished match to look around');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
