// Browse shows other players' resorts in shelves: staff picks, recently active, rising stars and the biggest.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const h = 3600e3, now = Date.now();
  const rows = [['Old Giant', 3, 900, 9, 20, 200], ['Fresh Pow', 1, 300, 2, 3, 2], ['New Kid', 1, 120, 1, 1, 30], ['Quiet Hill', 2, 50, 1, 2, 24 * 20]]
    .map(([name, season, g, lifts, trails, ago], i) => ({ id: 'b' + i, owner: 'o' + i, public: true, updated_at: new Date(now - ago * h).toISOString(),
      summary: { name, season, bestGuests: g, lifts, trails, buildings: 2, mt: i % 2 ? 'maple' : 'juniper', guest: i === 1, creator: i === 0 ? 'Ana' : '' } }));
  const g = await openGame(browser, url);
  await g.ev(`(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.rows.push(...${JSON.stringify(rows)}); d.featured = [{ mountain_id: 'b3', picked: true, picked_at: new Date(${now} - 3600e3).toISOString() }, { mountain_id: 'b2', picked: true, picked_at: new Date(${now} - 48 * 3600e3).toISOString() }, { mountain_id: 'b0', picked: false }]; localStorage.setItem('FAKE_DB', JSON.stringify(d)); })()`);
  await g.click('#startBtn'); await g.wait(2200);
  await g.ev(`(async () => { CLOUD.boardAt = 0; await loadBoard(true); })()`); await g.wait(300);
  await g.ev(`openCommunity('browse')`); await g.wait(300);
  eq(await g.ev(`$('cmBrowseTab').hidden`), false, 'opens on Browse');
  const shelves = await g.ev(`[...document.querySelectorAll('#cmBrowseTab .shelf')].map((s) => [s.querySelector('h4').textContent, [...s.querySelectorAll('.bc-top b')].map((b) => b.textContent)])`);
  eq(shelves.map((s) => s[0]), ['Staff picks', 'Recently active', 'Rising stars', 'Biggest resorts'], 'four shelves');
  eq(shelves[0][1], ['Quiet Hill', 'New Kid'], 'staff picks are the picked resorts only, newest pick first (not most recently played)');
  eq(shelves[1][1], ['Fresh Pow', 'New Kid', 'Old Giant'], 'recently active, newest first, the top three');
  eq(shelves[2][1], ['Fresh Pow', 'New Kid'], 'rising stars: first season, played this week, busiest first');
  eq(shelves[3][1][0], 'Old Giant', 'biggest first');
  assert(/2 h ago/.test(await g.ev(`$('cmBrowseTab').innerText`)), 'recent cards say when they were played');
  assert(/Guest/i.test(await g.ev(`document.querySelector('#cmBrowseTab .shelf:nth-child(2)').innerText`)), 'guest resorts are tagged');
  eq(await g.ev(`document.querySelectorAll('#cmBrowseTab [data-action=visit]').length`), 2 + 3 + 2 + 3, 'every card can be visited');
  // See all opens one shelf with every resort, chips switch shelves, and All shelves goes back
  eq(await g.ev(`[...document.querySelectorAll('#cmBrowseTab .seeall')].map((b) => b.textContent)`), ['See all 4 ›', 'See all 4 ›'], 'shelves with more than three offer See all');
  await g.click('#cmBrowseTab .seeall'); await g.wait(150);
  eq(await g.ev(`[document.querySelector('#cmBrowseTab .shelf h4').textContent, document.querySelectorAll('#cmBrowseTab .bcard').length, document.querySelector('#cmBrowseTab .shelf-chips [aria-pressed=true]').textContent]`), ['Recently active', 4, 'Recently active'], 'See all shows the whole shelf');
  await g.click('#cmBrowseTab .shelf-chips [data-v=big]'); await g.wait(150);
  eq(await g.ev(`document.querySelector('#cmBrowseTab .shelf h4').textContent`), 'Biggest resorts', 'a chip switches shelves');
  await g.click('#cmBrowseTab .shelf-chips [data-v=""]'); await g.wait(150);
  eq(await g.ev(`document.querySelectorAll('#cmBrowseTab .shelf').length`), 4, 'All shelves goes back to the overview');
  // a mountain filter: one mountain or all, remembered
  await g.click('#cmBrowseTab [data-action=browseMt][data-v=maple]'); await g.wait(150);
  eq(await g.ev(`[...new Set([...document.querySelectorAll('#cmBrowseTab .bc-top b')].map((b) => b.textContent))].sort()`), ['Fresh Pow', 'Quiet Hill'], 'Maple Notch only');
  await g.click('#cmBrowseTab [data-action=browseMt][data-v=twin]'); await g.wait(150);
  assert(/No resorts on Twin Notch/.test(await g.ev(`$('cmBrowseTab').innerText`)), 'an empty mountain says so');
  eq(await g.ev(`localStorage.getItem('mm.browseMt')`), 'twin', 'the choice is remembered');
  await g.click('#cmBrowseTab [data-action=browseMt][data-v=""]'); await g.wait(150);
  eq(await g.ev(`document.querySelectorAll('#cmBrowseTab .shelf').length`), 4, 'All mountains shows everything again');
  // the in-game panel links here
  await g.ev(`$('community').hidden = true; select({ kind: 'community', obj: null })`); await g.wait(200);
  await g.click('#sheet [data-action=browse]'); await g.wait(200);
  eq(await g.ev(`!$('community').hidden && !$('cmBrowseTab').hidden`), true, 'Browse resorts opens the Browse tab');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
