// A player's profile opened from the King of the Mountain window: closing it, its Back link, or a tap outside it
// comes back to the window, where you were, instead of all the way out to the title screen. Your own Profile
// link does the same. Opened any other way, the community window closes as before.
import { openGame, eq } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  const at = (min) => new Date(Date.now() + min * 60000).toISOString();
  const match = { lobbies: [{ id: 'M1', name: 'Back Cup', map: 'match', slots: 3, starts_at: at(-50), days: 168, day_minutes: 15, status: 'running', day: 3 }],
    players: [{ lobby_id: 'M1', slot: 0, user_id: 'u-x', resort_name: 'Lone Peak' }, { lobby_id: 'M1', slot: 1, user_id: 'u-y', resort_name: 'Far Ridge' }],
    resorts: [{ lobby_id: 'M1', slot: 0, day: 3, summary: { name: 'Lone Peak', profit: 5000, guests: 400 } }, { lobby_id: 'M1', slot: 1, day: 3, summary: { name: 'Far Ridge', profit: 3000, guests: 300 } }], orders: [] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'u-x': { name: 'Lou', public: true }, 'u-y': { name: 'Fay', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); localStorage.setItem('mm.kotm.intro', '1'); }, match); // past the how-it-works card
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await g.click('#mpCard'); await g.page.waitForSelector('#mpBody [data-mp=who][data-uid="u-x"]', { timeout: 10000 });
  const open = () => g.ev(`({ mp: !$('mpModal').hidden, cm: !$('community').hidden, title: !$('title').hidden })`);
  const who = async (uid) => { await g.ev(`document.querySelector('#mpBody [data-mp=who][data-uid="${uid}"]').click()`); await g.wait(400); };

  await g.ev(`document.querySelector('#mpModal .modal').scrollTop = 80`);
  const scrolled = await g.ev(`document.querySelector('#mpModal .modal').scrollTop`);
  await who('u-x');
  eq(await open(), { mp: false, cm: true, title: true }, 'a name opens that player’s profile');
  await g.click('#cmClose'); await g.wait(400);
  eq(await open(), { mp: true, cm: false, title: true }, 'closing the profile comes back to King of the Mountain');
  eq(await g.ev(`document.querySelector('#mpModal .modal').scrollTop`), scrolled, 'scrolled to where you were');

  await g.page.waitForSelector('#mpBody [data-mp=who][data-uid="u-y"]', { timeout: 10000 });
  await who('u-y');
  await g.ev(`document.querySelector('#community [data-action=cmBack]').click()`); await g.wait(400);
  eq(await open(), { mp: true, cm: false, title: true }, 'the profile’s Back link comes back to it too');

  await g.page.waitForSelector('#mpBody [data-mp=who][data-uid="u-x"]', { timeout: 10000 });
  await who('u-x');
  await g.ev(`$('community').dispatchEvent(new MouseEvent('click', { bubbles: true }))`); await g.wait(400);
  eq(await open(), { mp: true, cm: false, title: true }, 'and so does a tap outside it');

  await g.ev(`document.querySelector('#mpBody [data-mp=profile]').click()`); await g.wait(400);
  eq((await open()).cm, true, 'your own Profile link opens the community window');
  await g.click('#cmClose'); await g.wait(400);
  eq((await open()).mp, true, 'closing it comes back as well');

  await g.ev(`closeMp()`);
  await g.ev(`openCommunity('board')`); await g.wait(300);
  await g.click('#cmClose'); await g.wait(300);
  eq(await open(), { mp: false, cm: false, title: true }, 'the leaderboard opened from the title still closes to the title');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
