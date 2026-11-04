// The orange flag on the title screen names an open King of the Mountain lobby Phil flagged (stats.html) and how many
// spots it has left, for everyone (even after they've opened the mode), and goes once it's full. Lobbies he didn't flag
// never show. Without one, it's the New tag.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { keepStorage: false });
  const at = (min) => new Date(Date.now() + min * 60000).toISOString();
  const match = { lobbies: [
      { id: 'L1', name: 'First Beta Cup', map: 'match', slots: 3, starts_at: at(-600), days: 168, day_minutes: 30, status: 'running', day: 20 },
      { id: 'L0', name: 'Quiet Cup', map: 'match', slots: 3, starts_at: at(60), days: 168, day_minutes: 30, status: 'open', day: 0 }, // not flagged
      { id: 'L2', name: 'Second Beta Cup', map: 'match', slots: 3, starts_at: at(120), days: 168, day_minutes: 30, status: 'open', day: 0, flag: true }],
    players: [0, 1, 2].map((s) => ({ lobby_id: 'L1', slot: s, user_id: 'u' + s, resort_name: 'R' + s })), resorts: [], orders: [] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; localStorage.setItem('FAKE_DB', JSON.stringify(d)); localStorage.setItem('mm.seen.kotm', '1'); }, match);
  const flag = async () => { await g.ev('LOBBY_FLAG.at = 0; loadLobbyFlag()'); await g.wait(600); return g.ev(`(() => { const f = document.getElementById('mpFlag'); return f.hidden ? null : f.innerText.replace(/\\s+/g, ' ').trim(); })()`); };
  eq(await flag(), 'Join Second Beta Cup · 3 spots left', 'a flagged open lobby with room shows on the title screen (not the sooner, unflagged one), even after you’ve opened the mode');
  const add = (n) => g.page.evaluate((k) => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); for (let s = 0; s < k; s++) d.match.players.push({ lobby_id: 'L2', slot: d.match.players.filter((p) => p.lobby_id === 'L2').length, user_id: 'x' + Math.random(), resort_name: 'J' }); localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, n);
  await add(2);
  eq(await flag(), 'Join Second Beta Cup · 1 spot left', 'it counts down as players join');
  await add(1);
  eq(await flag(), null, 'a full lobby isn’t flagged');
  await g.page.evaluate(() => localStorage.removeItem('mm.seen.kotm'));
  eq(await flag(), null, 'with no lobby to flag, nothing extra on the card');
  const card = await g.page.evaluate(() => { const c = document.getElementById('mpCard'), s = document.getElementById('titleSlots'); return { above: !!(c.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING), text: c.innerText.replace(/\s+/g, ' '), pic: c.querySelector('img').getAttribute('src'), visible: c.getBoundingClientRect().height > 100 }; });
  assert(card.above && /New · Beta/i.test(card.text) && /King of the Mountain/i.test(card.text) && card.pic === 'img/crown.jpg' && card.visible, `the big King of the Mountain card sits above your mountains, with Crown Peak (${JSON.stringify(card)})`);
  await g.click('#mpCard'); await g.page.waitForFunction(() => !document.getElementById('mpModal').hidden, null, { timeout: 5000 });
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
