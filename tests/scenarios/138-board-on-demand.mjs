// The full leaderboard (~250 KB) loads only when someone opens it. The title screen's Community card shows
// your rank and the top 3 from board_peek (~300 bytes), and opening the leaderboard or Browse is counted.
import { openGame, eq, assert } from '../harness.mjs';
const seed = `(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}');
  for (let i = 0; i < 12; i++) d.rows.push({ id: 'r' + i, owner: 'u' + i, public: true, updated_at: new Date().toISOString(), summary: { v: 1, mt: i % 2 ? 'maple' : 'juniper', name: 'Resort ' + i, bestGuests: 3000 - i * 100, trails: 3, lifts: 1 } });
  d.rows.push({ id: 'sb', owner: 'u99', public: true, updated_at: new Date().toISOString(), summary: { v: 1, mt: 'juniper', name: 'Sandbox', sandbox: true, bestGuests: 9999 } });
  localStorage.setItem('FAKE_DB', JSON.stringify(d)); })()`;
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { width: 390, height: 844 });
  await g.page.evaluate(seed); await g.page.reload(); await g.wait(1500);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(`(() => { saveNow(); CLOUD.lastUp = 0; return cloudSave(false); })()`); await g.wait(600);
  await g.ev(`showTitle()`); await g.wait(600);
  eq(await g.ev(`!!CLOUD.boardLoaded`), false, 'the full board is not downloaded just for playing');
  assert(await g.ev(`JSON.parse(localStorage.getItem('FAKE_DB')).peeks`) >= 1, 'the title card asks for the small peek instead');
  // 6 other resorts on this mountain (the sandbox doesn't count), all busier than a new resort
  eq(await g.ev(`$('titleSlots').querySelector('.ccard .cc-rank b').textContent`), '#7', 'your rank on this mountain');
  const me = await g.ev(`state.resortName`);
  eq(await g.ev(`[...document.querySelectorAll('.ccard .cc-top li:not(.gap) b')].map((b) => b.firstChild.textContent)`), (await g.ev(`MOUNTAIN.id`)) === 'maple' ? ['Resort 1', 'Resort 3', 'Resort 5', me] : ['Resort 0', 'Resort 2', 'Resort 4', me], 'the top 3, then you');
  eq(await g.ev(`$('commBtnLabel').textContent`), '#7 of 7', 'the Leaderboard button shows your place');
  // opening the leaderboard downloads it and is counted once
  await g.ev(`openCommunity('board')`); await g.wait(600);
  eq(await g.ev(`!!CLOUD.boardLoaded`), true, 'opening the leaderboard loads it');
  eq(await g.ev(`document.querySelectorAll('#cmBoard .podium li').length`), 3, 'and shows the podium');
  await g.ev(`cmTab('browse'); cmTab('board'); cmTab('browse')`); await g.wait(400);
  eq(await g.ev(`JSON.parse(localStorage.getItem('FAKE_DB')).boardOpens.map((o) => o.what).sort()`), ['board', 'browse'], 'opens counted once each');
  eq(await g.ev(`boardStanding().i`), 6, 'the full board agrees on your rank');
  eq(g.errors, [], 'no page errors');
}
