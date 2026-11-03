// The orange flag on the title screen names an open King of the Mountain lobby and how many spots it has left,
// for everyone (even after they've opened the mode), and goes once it's full. Without one, it's the New tag.
import { openGame, eq } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { keepStorage: false });
  const at = (min) => new Date(Date.now() + min * 60000).toISOString();
  const match = { lobbies: [
      { id: 'L1', name: 'First Beta Cup', map: 'match', slots: 3, starts_at: at(-600), days: 168, day_minutes: 30, status: 'running', day: 20 },
      { id: 'L2', name: 'Second Beta Cup', map: 'match', slots: 3, starts_at: at(120), days: 168, day_minutes: 30, status: 'open', day: 0 }],
    players: [0, 1, 2].map((s) => ({ lobby_id: 'L1', slot: s, user_id: 'u' + s, resort_name: 'R' + s })), resorts: [], orders: [] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; localStorage.setItem('FAKE_DB', JSON.stringify(d)); localStorage.setItem('mm.seen.kotm', '1'); }, match);
  const flag = async () => { await g.ev('LOBBY_FLAG.at = 0; loadLobbyFlag()'); await g.wait(600); return g.ev(`(() => { const f = document.getElementById('newMtn'); return f.hidden ? null : f.innerText.replace(/\\s+/g, ' ').trim(); })()`); };
  eq(await flag(), 'JOIN Second Beta Cup · 3 spots left ›', 'an open lobby with room shows on the title screen, even after you’ve opened the mode');
  const add = (n) => g.page.evaluate((k) => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); for (let s = 0; s < k; s++) d.match.players.push({ lobby_id: 'L2', slot: d.match.players.filter((p) => p.lobby_id === 'L2').length, user_id: 'x' + Math.random(), resort_name: 'J' }); localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, n);
  await add(2);
  eq(await flag(), 'JOIN Second Beta Cup · 1 spot left ›', 'it counts down as players join');
  await add(1);
  eq(await flag(), null, 'a full lobby isn’t flagged (and the New tag stays gone once you’ve opened the mode)');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
