// Player matches: official tournaments are marked and listed first; a player match shows who made it and a lock
// when it has a password, which joining asks for. A signed-in player makes their own match (10, 15 or 30-minute
// turns, a length, a start, a password), sees it under Your matches and can cancel it before it starts. Their
// profile page shows official badges and how many matches they've played and won.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  const at = (min) => new Date(Date.now() + min * 60000).toISOString();
  const lobby = (id, name, status, startMin, extra = {}) => ({ id, name, map: 'match', slots: 3, starts_at: at(startMin), days: 168, day_minutes: 30, status, day: 0, prize: `${name} champion`, ...extra });
  const custom = (by, extra) => ({ kind: 'custom', created_by: by, prize: null, ...extra });
  const match = {
    lobbies: [lobby('P1', 'Pals Cup', 'open', 20, custom('u-m', { locked: true, day_minutes: 10, days: 28 })), lobby('O1', 'Winter Cup', 'open', 300),
      lobby('P2', 'Quiet Cup', 'open', 40, custom('u-hid', { day_minutes: 15, days: 7 })),
      lobby('R1', 'Closed Doors', 'running', -60, custom('u-m2', { day: 2, late: false, computers: false })), lobby('R2', 'Open Doors', 'running', -60, custom('u-m3', { day: 2 })),
      lobby('F1', 'Old Pals', 'finished', -9000, custom('u-x', { day: 7, days: 7 })), lobby('F2', 'Autumn Cup', 'finished', -9000, { day: 168 })],
    players: [{ lobby_id: 'R1', slot: 0, user_id: 'u-m2', resort_name: 'Shut Hill' }, { lobby_id: 'R2', slot: 0, user_id: 'u-m3', resort_name: 'Open Hill' },
      { lobby_id: 'P1', slot: 0, user_id: 'u-m', resort_name: 'Maker Hill' }, { lobby_id: 'P2', slot: 0, user_id: 'u-hid', resort_name: 'Hidden Hill' },
      { lobby_id: 'F1', slot: 0, user_id: 'user-B', resort_name: 'Old Peak', place: 2 }, { lobby_id: 'F1', slot: 1, user_id: 'u-x', resort_name: 'X Hill', place: 1 },
      { lobby_id: 'F2', slot: 0, user_id: 'user-B', resort_name: 'Autumn Peak', place: 1 }, { lobby_id: 'F2', slot: 1, user_id: 'u-y', resort_name: 'Y Hill', place: 2 }],
    resorts: [], keys: { P1: 'Snow1234' },
    badges: [{ user_id: 'user-B', lobby_id: 'F2', place: 1, title: 'Autumn Cup champion', created_at: at(-8000) }],
  };
  await g.page.evaluate((m) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = m;
    d.profiles = { 'user-B': { name: 'Phil', public: true }, 'u-m': { name: 'Maker', public: true }, 'u-hid': { name: 'Secret', public: false } };
    localStorage.setItem('FAKE_DB', JSON.stringify(d)); localStorage.setItem('mm.kotm.intro', '1'); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  const body = () => g.page.evaluate(() => document.getElementById('mpBody').innerText);
  const db = () => g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match);
  await g.click('#mpCard'); await g.page.waitForFunction(() => /Open lobbies/i.test(document.getElementById('mpBody').innerText), null, { timeout: 10000 });
  await g.page.waitForFunction(() => /by Maker/.test(document.getElementById('mpBody').innerText), null, { timeout: 10000 });

  // The list: official first, then player matches with who made them, and a lock on the one with a password.
  let t = await body();
  assert(/Open lobbies[\s\S]*Winter Cup\s*Official[\s\S]*Pals Cup[\s\S]*Player match by Maker · Password[\s\S]*a new day every 10 min[\s\S]*Quiet Cup/i.test(t), `official first, then player matches (${JSON.stringify(t.slice(0, 900))})`);
  assert(/Quiet Cup[\s\S]{0,40}Player match\n/.test(t) && !/Secret/.test(t), 'a maker with a private profile isn’t named');
  assert(!/Pals Cup[\s\S]{0,120}Prize/.test(t), 'player matches have no prize badge');
  // Pictures: Crown Peak at the top of the window, and the map on every lobby card.
  const pics = await g.page.evaluate(() => ({ hero: [...document.querySelectorAll('#mpBody .mp-hero img')].map((i) => i.getAttribute('src')),
    cards: document.querySelectorAll('#mpBody .mp-card').length, onCards: [...document.querySelectorAll('#mpBody .mp-card > img.mp-pic')].map((i) => i.getAttribute('src')) }));
  assert(pics.hero.join() === 'img/crown.jpg' && pics.onCards.length === pics.cards && pics.onCards.every((x) => x === 'img/crown.jpg'), `Crown Peak at the top and on each card (${JSON.stringify(pics)})`);
  await g.page.waitForFunction(() => [...document.querySelectorAll('#mpBody img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 10000 });
  // Switches: computer players and late joining show on each lobby; with late joining off, there's no Join now.
  assert(/Closed Doors[\s\S]*Computer players off · No late joining/.test(t) && /Open Doors[\s\S]*Computer players on · Late joining until day 42/.test(t), 'each lobby says whether computers play and late joining is on');
  assert(!(await g.page.$('[data-mp=pick][data-id=R1]')) && await g.page.$('[data-mp=pick][data-id=R2]'), 'no Join now when late joining is off');

  // Joining a locked match needs its password.
  await g.page.click('[data-mp=pick][data-id=P1]');
  assert(await g.page.isVisible('#mpKey'), 'Join asks for the password');
  await g.page.fill('#mpName', 'Powder Palace'); await g.page.click('.mp-join button[type=submit]');
  await g.page.waitForSelector('.mp-err');
  eq(await g.page.innerText('.mp-err'), 'This match needs its password.', 'not without it');
  await g.page.fill('#mpKey', 'snow1234'); await g.page.click('.mp-join button[type=submit]');
  await g.page.waitForFunction(() => /isn’t right|isn't right/.test((document.querySelector('.mp-err') || {}).innerText || ''), null, { timeout: 10000 });
  await g.page.fill('#mpKey', 'Snow1234'); await g.page.click('.mp-join button[type=submit]');
  await g.page.waitForFunction(() => /Your matches[\s\S]*Pals Cup[\s\S]*Powder Palace/i.test(document.getElementById('mpBody').innerText), null, { timeout: 10000 });
  eq((await db()).players.filter((p) => p.lobby_id === 'P1').map((p) => p.user_id), ['u-m', 'user-B'], 'the right password gets you in');

  // Making a match of your own.
  await g.page.click('[data-mp=make]');
  assert(await g.page.isVisible('#mpMake'), 'Make a match opens the form');
  await g.page.click('[data-mk=turn][data-v="10"]'); await g.page.click('[data-mk=days][data-v="7"]'); await g.page.click('[data-mk=start][data-v="30"]'); await g.page.click('[data-mk=slots][data-v="2"]'); await g.page.click('[data-mk=late][data-v="0"]');
  eq(await g.ev(`MP.mk.computers`), 1, 'computer players are on unless you turn them off');
  await g.page.click('[data-mk=computers][data-v="0"]');
  t = await body();
  assert(/7 days\s*1 h 10 min/.test(t) && /168 days\s*a season · 1.2 days/.test(t), `lengths show how long they take in real time (${JSON.stringify(t.match(/Length[\s\S]{0,200}/i))})`);
  await g.page.fill('#mkName', 'Friday   Fun'); await g.page.fill('#mkResort', 'Phil’s Peak'); await g.page.fill('#mkPw', 'abc');
  await g.page.click('#mpMake button[type=submit]'); await g.page.waitForSelector('#mpMake .mp-err');
  assert(/at least 4 characters/.test(await g.page.innerText('#mpMake .mp-err')), 'a too-short password is refused');
  eq(await g.page.inputValue('#mkName'), 'Friday Fun', 'what you typed stays in the form');
  await g.page.fill('#mkPw', 'Pals2026'); await g.page.click('#mpMake button[type=submit]');
  await g.page.waitForFunction(() => !document.getElementById('mpMake') && /Friday Fun/.test(document.getElementById('mpBody').innerText), null, { timeout: 10000 });
  const made = (await db()).lobbies.find((l) => l.name === 'Friday Fun');
  eq([made.kind, made.created_by, made.day_minutes, made.days, made.slots, made.locked, made.status, made.computers, made.late], ['custom', 'user-B', 10, 7, 2, true, 'open', false, false], 'a 10-minute, 7-day, 2-resort match with a password, no computers and no late joining');
  const mins = (Date.parse(made.starts_at) - Date.now()) / 60000;
  assert(mins > 28 && mins < 32, `it starts in about 30 minutes (${mins.toFixed(1)})`);
  t = await body();
  assert(/Your matches[\s\S]*Friday Fun[\s\S]*Player match, made by you · Password[\s\S]*You’re Phil’s Peak[\s\S]*Cancel this match/i.test(t), `it shows under Your matches (${JSON.stringify(t.slice(0, 900))})`);
  assert(/Your own match, Friday Fun, is on/.test(t) && !(await g.page.$('[data-mp=make]')), 'one of your own at a time');

  // Cancel it before it starts.
  await g.page.click('[data-mp=cancelMatch]'); await g.page.click('[data-mp=cancelYes]');
  await g.page.waitForFunction(() => !/Friday Fun/.test(document.getElementById('mpBody').innerText), null, { timeout: 10000 });
  eq((await db()).lobbies.find((l) => l.name === 'Friday Fun').status, 'closed', 'cancelled for everyone');
  assert(await g.page.$('[data-mp=make]'), 'and you can make another');

  // On a phone, the form fits with no sideways scrolling.
  await g.page.click('[data-mp=make]');
  await g.page.setViewportSize({ width: 390, height: 844 }); await g.wait(400);
  const wide = await g.page.evaluate(() => { const m = document.querySelector('#mpModal .modal'); return { over: m.scrollWidth - m.clientWidth, page: document.documentElement.scrollWidth - window.innerWidth }; });
  assert(wide.over <= 1 && wide.page <= 1, `fits a phone (${JSON.stringify(wide)})`);
  if (process.env.SHOTS) { await g.ev(`$('mpMake').scrollIntoView()`); await g.wait(200); await g.page.screenshot({ path: 'mp-make.png' }); }
  await g.click('#mpClose');

  // Your profile page: the official badge, and played and won (a 2nd place doesn't count as a win).
  await g.ev('openCreator(CLOUD.uid)');
  await g.page.waitForFunction(() => /King of the Mountain/i.test(document.getElementById('cmCreatorTab').innerText), null, { timeout: 10000 });
  const prof = await g.page.evaluate(() => document.getElementById('cmCreatorTab').innerText);
  assert(/King of the Mountain\s*Autumn Cup champion\s*Matches: 2 played · 1 won/i.test(prof), `the profile shows the badge and the record (${prof.slice(0, 300)})`);
  // Shorter turns: the live day fits the turn the same way. Lifts close (4 PM) 18/30 of the way in, the evening ends by 28/30.
  const clock = await g.ev(`[10, 15, 30].map((m) => { const l = { day_minutes: m }; return [replayClock(l, m * 60000 * 0.3, 1320), replayClock(l, m * 60000 * 0.6, 1320), replayClock(l, m * 60000 * 28 / 30, 1320)].map(Math.round); })`);
  eq(clock, [[720, 960, 1320], [720, 960, 1320], [720, 960, 1320]], 'noon, 4 PM and the end of the evening at the same share of a 10, 15 or 30-minute turn');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
