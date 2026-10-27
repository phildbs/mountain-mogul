// The leaderboard's look: the top three on a stepped podium (first highest, then second, then third),
// the rest in rows with a bar, ranking chips, and your own row pinned when you're past the list.
// On wide screens the Community card heads the right-hand column; on phones it sits in line.
import { openGame, eq, assert } from '../harness.mjs';
const seed = `(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}');
  for (let i = 0; i < 30; i++) d.rows.push({ id: 'r' + i, owner: 'u' + i, public: true, updated_at: new Date().toISOString(), summary: { v: 1, mt: ['maple', 'juniper', 'raven'][i % 3], name: 'Resort ' + i, creator: i % 4 ? 'P' + i : '', guest: !(i % 4), stars: i % 5, when: 'Season 1', trails: 5, lifts: 2, buildings: 3, bestGuests: 9000 - i * 200, bestDayProfit: 1000, bestSeasonProfit: 10000, totalVisitors: 50000 - i * 100, rep: 1 } });
  localStorage.setItem('FAKE_DB', JSON.stringify(d)); })()`;
export default async function ({ browser, url }) {
  for (const [w, h, wide] of [[1280, 800, true], [390, 844, false]]) {
    const g = await openGame(browser, url, { width: w, height: h });
    await g.page.evaluate(seed); await g.page.reload(); await g.wait(1500);
    await g.click('#startBtn'); await g.wait(300); await g.ev(`showTitle()`); await g.wait(300);
    eq(await g.ev(`[!$('titleComm').hidden, !!$('titleComm').querySelector('.ccard'), !!$('titleSlots').querySelector('.ccard')]`), [wide, wide, !wide], wide ? 'wide: community card heads the right column' : 'phone: community card in line');
    eq(await g.ev(`document.querySelectorAll('.ccard .cc-top li').length`), 3, 'with the top three');
    if (wide) { await g.ev(`$('titleComm').querySelector('[data-slot=board]').click()`); await g.wait(200); eq(await g.ev(`$('community').hidden`), false, 'its Leaderboard button opens the board'); }
    else await g.ev(`openCommunity('board')`);
    await g.wait(300);
    const tops = await g.ev(`[1, 2, 3].map((k) => document.querySelector('#cmBoard .podium .p' + k).getBoundingClientRect().top)`);
    assert(tops[0] < tops[1] && tops[1] < tops[2], `first highest, then second, then third: ${tops}`);
    eq(await g.ev(`document.querySelector('#cmBoard .podium .p1 .nm').textContent`), 'Resort 0', 'first is the busiest');
    eq(await g.ev(`document.querySelectorAll('#cmBoard .board li .bar').length`), 23, 'the rest in rows with bars: 22 more of the top 25, and yours');
    // you, at the bottom, pinned past the list
    eq(await g.ev(`(() => { const li = [...document.querySelectorAll('#cmBoard .board li')]; return [li.some((x) => x.classList.contains('gap')), li[li.length - 1].classList.contains('me'), li[li.length - 1].querySelector('.rk').textContent]; })()`), [true, true, '31'], 'your row pinned after the list');
    await g.ev(`document.querySelector('#cmBoard .metrics [data-v=visitors]').click()`); await g.wait(100);
    eq(await g.ev(`[CLOUD.board, document.querySelector('#cmBoard .metrics [aria-pressed=true]').dataset.v]`), ['visitors', 'visitors'], 'chips switch the ranking');
    eq(g.errors, [], 'no page errors');
    await g.page.close();
  }
}
