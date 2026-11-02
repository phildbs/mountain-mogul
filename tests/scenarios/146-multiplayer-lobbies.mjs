// The Multiplayer window on the title screen: guests see the lobbies but are asked to sign in; a signed-in player
// sees their matches with the league table, joins an open lobby under a resort name (rude names refused) and can
// leave before it starts; full lobbies can't be joined. It fits a phone with no sideways scrolling.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  const at = (min) => new Date(Date.now() + min * 60000).toISOString();
  const lobby = (id, name, status, startMin, extra = {}) => ({ id, name, map: 'match', slots: 3, starts_at: at(startMin), days: 168, day_minutes: 30, status, day: 0, prize: `${name} champion`, ...extra });
  const match = {
    lobbies: [lobby('L1', 'Winter Cup', 'open', 200), lobby('L2', 'Test Cup', 'running', -400, { day: 13 }), lobby('L3', 'Old Cup', 'finished', -9000, { day: 168 }),
      lobby('L4', 'Full Cup', 'open', 90), lobby('L5', 'Spring Cup', 'running', -100, { day: 3 }), lobby('L6', 'Gone Cup', 'closed', -50)],
    players: [{ lobby_id: 'L1', slot: 0, user_id: 'u-x', resort_name: 'Other Hill' },
      { lobby_id: 'L2', slot: 0, user_id: null, resort_name: 'Summit Ridge' }, { lobby_id: 'L2', slot: 1, user_id: 'user-B', resort_name: 'Phil’s Peak' }, { lobby_id: 'L2', slot: 2, user_id: null, resort_name: 'Valley View' },
      { lobby_id: 'L3', slot: 2, user_id: 'user-B', resort_name: 'Old Peak' }, { lobby_id: 'L3', slot: 0, user_id: 'u-y', resort_name: 'Winner Hill' },
      ...[0, 1, 2].map((s) => ({ lobby_id: 'L4', slot: s, user_id: `u-f${s}`, resort_name: `Full ${s}` })),
      { lobby_id: 'L5', slot: 0, user_id: 'u-z', resort_name: 'Busy Bowl' }],
    resorts: [{ lobby_id: 'L2', slot: 0, day: 13, summary: { name: 'Summit Ridge', profit: 45315 } }, { lobby_id: 'L2', slot: 1, day: 13, summary: { name: 'Phil’s Peak', profit: 44000 } },
      { lobby_id: 'L2', slot: 2, day: 13, summary: { name: 'Valley View', profit: 37327 } }, { lobby_id: 'L3', slot: 0, day: 168, summary: { name: 'Winner Hill', profit: 900000 } },
      { lobby_id: 'L3', slot: 2, day: 168, summary: { name: 'Old Peak', profit: 500000 }, save: { big: true } }, { lobby_id: 'L5', slot: 0, day: 3, summary: { name: 'Busy Bowl', profit: 1200 } }],
  };
  await g.page.evaluate((m) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = m; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  const body = () => g.page.evaluate(() => document.getElementById('mpBody').innerText);
  const open = async () => { await g.click('#mpCard'); await g.page.waitForFunction(() => !/Loading/.test(document.getElementById('mpBody').innerText), null, { timeout: 10000 }); };

  // A guest: sees what's on, is asked to sign in, and can't join.
  assert(await g.page.isVisible('#mpCard'), 'the Multiplayer card is on the title screen');
  await open();
  let t = await body();
  assert(/Sign in to play/.test(t) && !/Your matches/i.test(t), 'a guest is asked to sign in');
  assert(/Winter Cup/.test(t) && /Sign in to join/.test(t) && !/Gone Cup/.test(t), 'a guest still sees the open lobbies, and closed ones are gone');
  assert(/Being played now/i.test(t) && /Test Cup/.test(t), 'and the matches being played now');
  await g.click('[data-mp=signin]');
  eq(await g.page.isVisible('#mpModal'), false, 'Sign in closes the window, back to the sign-in card');

  // Signed in: your matches first.
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await open();
  t = await body();
  assert(!/Sign in to play/.test(t), 'no sign-in note once signed in');
  assert(/Your matches[\s\S]*Test Cup[\s\S]*now 2nd of 3[\s\S]*Day 13 of 168[\s\S]*next day in/i.test(t), `a running match shows your place and the day (${t.slice(0, 300)})`);
  assert(/Old Cup[\s\S]*you came 2nd of 2/.test(t), 'a finished match shows where you came');
  assert(/1st · Summit Ridge\s*\$45,315/.test(t), 'with its league table');
  assert(/Full Cup[\s\S]*Full/.test(t), 'a full lobby says so');
  const gotSave = await g.ev(`MP.resorts.some((r) => r.save)`);
  eq(gotSave, false, 'the window never downloads whole resort saves');

  // Join Winter Cup: a rude name is refused, a friendly one gets in.
  await g.page.click('[data-mp=pick][data-id=L1]');
  assert(await g.page.isVisible('#mpName'), 'Join asks for a resort name');
  await g.page.fill('#mpName', 'Shit Peak'); await g.page.click('.mp-join button[type=submit]');
  await g.page.waitForSelector('.mp-err');
  assert(/friendlier resort name/.test(await g.page.innerText('.mp-err')), 'a rude name is refused with the reason');
  await g.page.fill('#mpName', 'Powder Palace'); await g.page.click('.mp-join button[type=submit]');
  await g.page.waitForFunction(() => /Your matches[\s\S]*Winter Cup[\s\S]*Powder Palace/i.test(document.getElementById('mpBody').innerText), null, { timeout: 10000 });
  const joined = await g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.players.filter((p) => p.lobby_id === 'L1').map((p) => [p.user_id, p.resort_name]));
  eq(joined, [['u-x', 'Other Hill'], ['user-B', 'Powder Palace']], 'you join under your name');
  t = await body();
  assert(/Starts in[\s\S]*2 of 3 joined/.test(t), 'the lobby counts you in');

  // Leave again before it starts.
  await g.page.click('[data-mp=leave][data-id=L1]');
  await g.page.waitForFunction(() => !/Powder Palace/.test(document.getElementById('mpBody').innerText), null, { timeout: 10000 });
  const left = await g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.players.filter((p) => p.lobby_id === 'L1').length);
  eq(left, 1, 'you can leave before the start');

  // On a phone: no sideways scrolling.
  await g.page.setViewportSize({ width: 390, height: 844 }); await g.wait(400);
  const wide = await g.page.evaluate(() => { const m = document.querySelector('#mpModal .modal'); return { over: m.scrollWidth - m.clientWidth, page: document.documentElement.scrollWidth - window.innerWidth }; });
  assert(wide.over <= 1 && wide.page <= 1, `fits a phone (${JSON.stringify(wide)})`);
  if (process.env.SHOTS) await g.page.screenshot({ path: 'mp-lobbies.png' });
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
