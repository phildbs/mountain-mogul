// Matches of 2 or 3 seasons (3.4): Make a match offers 1, 2 or 3 seasons and sends their length; an older database
// that only takes one season says so; and during the summer turn the match screen shows summer, counts down to the
// next season, offers no live day, and never starts the season on the player's own screen.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  eq(await (async () => { const p = await openGame(browser, url, {}); const v = await p.ev(`[mpDays(1), mpDays(2), mpDays(3), mpDayText({ seasons: 2, days: 363, day: 200 }, false), mpDayText({ seasons: 2, days: 363, day: 169 }, false), mpDayText({ seasons: 3, days: 558, day: 365 }, false), mpDayText({ days: 168, day: 40 }, false)]`); await p.page.close(); return v; })(),
    [168, 363, 558, 'Season 2 of 2 · day 200 of 363', 'Summer before season 2', 'Season 3 of 3 starts', 'Day 40 of 168'], 'the same calendar as the match server');
  // A summer save: a starter resort at the end of season 1, shut for the summer as the server does on the summer turn.
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter); await m.ev(SETUPS.midwinter);
  await m.ev(`(() => { state.day = 176; endSeason(); enterSummer(); })()`);
  const save = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();
  eq([save.clock.summer, save.clock.season], [true, 1], 'the save is in summer');

  const g = await openGame(browser, url, {});
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString(), names = ['Summit Ridge', 'Phil’s Peak'];
  // Day 169 (the summer turn) began 10 minutes ago; day 170, the summer night, is next.
  const match = { lobbies: [{ id: 'S1', name: 'Two Winters', map: 'match', slots: 2, seasons: 2, starts_at: ago(169 * 30 + 10), days: 363, day_minutes: 30, status: 'running', day: 169, prize: null, kind: 'custom' }],
    players: [0, 1].map((s) => ({ lobby_id: 'S1', slot: s, user_id: [null, 'user-B'][s], resort_name: names[s] })),
    resorts: [0, 1].map((s) => ({ lobby_id: 'S1', slot: s, day: 169, save, summary: { name: names[s], profit: 50000 * (s + 1), seasons: [50000 * (s + 1)], guests: 300, summer: true } })), orders: [],
    days: [{ lobby_id: 'S1', day: 169, results: { wx: 'summer', summer: true, season: 2, share: [0, 0], alone: [{ day: 0, passes: 0 }, { day: 0, passes: 0 }], resorts: [0, 1].map((s) => ({ slot: s, guests: 0, profit: 0, summer: true })) } }] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true } }; d.oneSeason = true; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await g.click('#mpCard'); await g.page.waitForSelector('[data-mp=open][data-id=S1]', { timeout: 10000 });
  const body = () => g.page.innerText('#mpBody');
  assert(/Two Winters[\s\S]*2 seasons,[\s\S]*Summer before season 2 · next day in/.test(await body()), `the lobby says how many seasons and that it's summer (${(await body()).slice(0, 500)})`);

  // Make a match: two seasons, but this database only takes one yet.
  await g.page.click('[data-mp=make]');
  await g.page.click('[data-mk=seasons][data-v="2"]'); await g.page.click('[data-mk=turn][data-v="10"]');
  let t = await body();
  assert(/2 seasons with a summer between each, 363 game days: 2.5 days with a new day every 10 minutes/.test(t) && /the most in total wins/.test(t), `the length and how it's won (${JSON.stringify(t.match(/Length[\s\S]{0,260}/i))})`);
  assert(/until day 90/.test(t), 'late joining for a quarter of the longer match');
  await g.page.fill('#mkName', 'Long Cup'); await g.page.fill('#mkResort', 'Phil’s Peak');
  await g.page.click('#mpMake button[type=submit]'); await g.page.waitForSelector('#mpMake .mp-err');
  assert(/more than one season aren’t switched on yet/.test(await g.page.innerText('#mpMake .mp-err')), 'an older database: longer matches aren\'t switched on yet');
  // Once the SQL is run, it's made with its length and seasons.
  await g.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); delete d.oneSeason; localStorage.setItem('FAKE_DB', JSON.stringify(d)); });
  await g.page.click('[data-mk=seasons][data-v="3"]');
  assert(/3 seasons with a summer between each, 558 game days/.test(await body()), 'three seasons');
  await g.page.click('#mpMake button[type=submit]');
  await g.page.waitForFunction(() => !document.getElementById('mpMake') && /Long Cup/.test(document.getElementById('mpBody').innerText), null, { timeout: 10000 });
  const made = await g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.lobbies.find((l) => l.name === 'Long Cup'));
  eq([made.days, made.seasons, made.day_minutes], [558, 3, 10], 'a three-season match is made');

  // The summer turn on the match screen.
  await g.page.click('[data-mp=open][data-id=S1]');
  await g.reloaded(); await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView)'), null, { timeout: 20000 });
  await g.wait(2500);
  const s = await g.ev(`(refreshTimebar(true), { date: $('tbDate').textContent, sub: $('tbSub').innerText, watch: canWatch(), replay: !!matchView.replay, season: state.season, summer: state.summer, bar: $('visitText').innerText })`);
  eq([s.date, s.watch, s.replay, s.season, s.summer], ['Summer', false, false, 1, true], `summer, with no live day to watch, and the season isn't started on this screen (${JSON.stringify(s)})`);
  assert(/Season 2 starts in/.test(s.sub), `the bar counts down to season 2 (${s.sub})`);
  assert(/summer before season 2/.test(s.bar), `the match bar says it's summer (${s.bar})`);
  await g.ev(`startReplay(true)`); await g.wait(500);
  eq(await g.ev('[!!matchView.replay, state.season, state.summer]'), [false, 1, true], 'asking to watch does nothing in summer');
  await g.click('#visitLeague'); await g.wait(300);
  const sheet = await g.page.evaluate(() => document.getElementById('sheet').innerText);
  assert(/2 seasons: the most profit from them all/.test(sheet) && /Season 1: \$100,000/.test(sheet) && /Season\s*Summer before 2 of 2/i.test(sheet), `the standings show each season (${JSON.stringify(sheet.slice(0, 700))})`);
  // The summer night is due: the server is getting the season ready.
  await g.ev(`matchView.lobby.starts_at = new Date(Date.now() - 170 * 30 * 60000 - 5000).toISOString()`);
  assert(/Season 2 is starting: the match server is getting it ready/.test(await g.ev(`(refreshTimebar(true), $('tbSub').innerText)`)), 'when it\'s due');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
