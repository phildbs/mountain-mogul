// The Roadmap card counts ideas that are new or changed status since you last opened the roadmap.
// The roadmap tags those ideas New or Updated, and opening it clears the count.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  const check = async () => { await g.ev(`(async () => { roadmapAt = 0; await checkRoadmap(); })()`); await g.wait(100); return g.ev(`[$('roadmapNew').hidden, $('roadmapNew').textContent, $('mRoadmap').classList.contains('isnew')]`); };
  // a first visit: today's roadmap becomes the starting point, no badge
  eq((await check())[0], true, 'a first visit shows no badge');
  const seen = await g.ev(`JSON.parse(localStorage.getItem('mm.roadmapSeen'))`);
  assert(Object.keys(seen).length > 15 && seen['lift-upgrades'] === 'done' && seen.hotels === 'plan', `remembers each idea's status: ${Object.keys(seen).length}`);
  // the roadmap moves on: one idea is new, one changes status
  await g.ev(`(() => { const s = JSON.parse(localStorage.getItem('mm.roadmapSeen')); delete s.multiplayer; s.hotels = 'idea'; localStorage.setItem('mm.roadmapSeen', JSON.stringify(s)); })()`);
  eq(await check(), [false, '2 new', true], 'the card and the menu item show 2 new');
  // the roadmap tags them, and remembers today's
  const frame = async () => { await g.page.evaluate((u) => new Promise((ok) => { document.querySelector('#rmFrame')?.remove(); const f = document.createElement('iframe'); f.id = 'rmFrame'; f.src = u; f.onload = () => setTimeout(ok, 300); document.body.appendChild(f); }), url + 'roadmap.html'); return g.page.frames().find((f) => f.url().endsWith('roadmap.html')); };
  let f = await frame();
  eq(await f.evaluate(() => [...document.querySelectorAll('.card.fresh')].map((c) => [c.dataset.idea, c.querySelector('.freshtag').textContent])), [['hotels', 'Updated'], ['multiplayer', 'New']], 'tagged New and Updated');
  f = await frame();
  eq(await f.evaluate(() => document.querySelectorAll('.card.fresh').length), 0, 'and not again next time');
  await g.page.evaluate(() => document.querySelector('#rmFrame').remove());
  eq((await check())[0], true, 'back in the game the badge is gone');
  // someone who played before there was a record sees a plain nudge
  await g.click('#startBtn'); await g.wait(300); await g.ev(`saveNow(); showTitle()`);
  await g.ev(`localStorage.removeItem('mm.roadmapSeen')`);
  eq(await check(), [false, 'New ideas', true], 'an earlier player is told there are new ideas');
  await g.ev(`(() => { window.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true }); $('roadmapCard').click(); })()`); // stay on the page
  eq(await g.ev(`$('roadmapNew').hidden`), true, 'opening the roadmap clears it');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
