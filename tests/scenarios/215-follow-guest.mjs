// Follow on a guest's card: the camera keeps them in the open part of the view (beside the desktop's card) until the
// map is dragged, the card closes or they go home. A player's idea (Nov 10).
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`(() => { nextDay(); openDay(); state.speed = 1; let n = 0; while (state.time < 660 && n++ < 90000) simStep(1.5); })()`);
  const id = await g.ev(`(() => { const p = guests.find((q) => q.st === 'ride') || guests.find((q) => q.st === 'ski'); select({ kind: 'guest', obj: p }); return p.id; })()`);
  eq(await g.ev(`document.querySelector('#sheet [data-action=followGuest]').textContent`), 'Follow with the camera', 'the card offers to follow');
  await g.click('#sheet [data-action=followGuest]');
  eq(await g.ev(`[follow && follow.id, document.querySelector('#sheet [data-action=followGuest]').textContent]`), [id, 'Stop following'], 'following, and the button says how to stop');
  // after a moment the guest sits in the middle of the open view, zoomed in close enough to see them
  const off = `(() => { followRoomNow(); const q = guestPos(follow), s = project(q.x, q.y, q.z); return [Math.round(s.x - followRoom.right / 2), Math.round(s.y - (followRoom.top + followRoom.bottom) / 2), cam.viewH <= FIG_LOD]; })()`;
  await g.page.waitForFunction((c) => { const r = window.__dbg(c); return Math.abs(r[0]) < 25 && Math.abs(r[1]) < 25; }, off, { timeout: 8000 }).catch(() => {});
  const o = await g.ev(off);
  assert(Math.abs(o[0]) < 25 && Math.abs(o[1]) < 25 && o[2], `the guest is in the middle of the open view (${o})`);
  assert(await g.ev(`followRoom.right < innerWidth`), 'clear of the desktop card');
  await g.ev(`(() => { drawPeople(); placeGuestTag(); })()`); // (tests skip drawing the skiers)
  eq(await g.ev(`[document.getElementById('guestTag').hidden, document.getElementById('guestTag').textContent === follow.name]`), [false, true], 'a name tag marks the guest');
  // the guest moves on and the view goes with them
  await g.ev(`(() => { for (let n = 0; n < 40; n++) simStep(1.5); })()`);
  await g.page.waitForFunction((c) => { const r = window.__dbg(c); return Math.abs(r[0]) < 25 && Math.abs(r[1]) < 25; }, off, { timeout: 8000 }).catch(() => {});
  const o2 = await g.ev(off);
  assert(Math.abs(o2[0]) < 25 && Math.abs(o2[1]) < 25, `still centred as they move (${o2})`);
  // panning with the keys lets go; so do Stop following and closing the card
  await g.page.keyboard.press('ArrowLeft');
  eq(await g.ev(`[follow, document.querySelector('#sheet [data-action=followGuest]').textContent]`), [null, 'Follow with the camera'], 'an arrow key lets go');
  await g.click('#sheet [data-action=followGuest]'); await g.click('#sheet [data-action=followGuest]');
  eq(await g.ev(`follow`), null, 'Stop following lets go');
  await g.click('#sheet [data-action=followGuest]'); await g.click('#sheet [data-action=close]');
  eq(await g.ev(`follow`), null, 'closing the card lets go');
  await g.ev(`placeGuestTag()`); eq(await g.ev(`document.getElementById('guestTag').hidden`), true, 'and the tag goes with the card');
  // a guest going home ends it, and the card says so
  await g.ev(`(() => { const p = gById.get(${id}); select({ kind: 'guest', obj: p }); startFollow(p); p.st = 'incar'; })()`);
  await g.page.waitForFunction(() => window.__dbg('follow === null'), null, { timeout: 5000 }).catch(() => {});
  eq(await g.ev(`[follow, /Went home/.test(document.getElementById('sheet').textContent)]`), [null, true], 'going home ends it');
  // their day in the report: a second guest followed from late morning to the end
  const id2 = await g.ev(`(() => { const p = guests.find((q) => q.id !== ${id} && q.st === 'queue') || guests.find((q) => q.id !== ${id} && q.st !== 'incar'); select({ kind: 'guest', obj: p }); startFollow(p); select(null); return p.id; })()`);
  await g.ev(SETUPS.finishDay);
  const ds = await g.ev(`state.lastReport.diaries`);
  eq(ds.map((d) => d.id), [id, id2].map(Number), 'both followed guests are in the report');
  eq(ds[0].log[ds[0].log.length - 1][1], 'Went home', 'the first went home when sent to the car');
  const d2 = ds[1], texts = d2.log.map((e) => e[1]);
  assert(texts.some((t) => /^Riding /.test(t)) && texts.some((t) => /^Skiing /.test(t)), `the day has rides and runs (${texts.slice(0, 8)})`);
  assert(texts.some((t) => /^In line for .* · (waited \d+ min|straight on)$/.test(t)), 'lines say how long they took');
  assert(!texts.some((t) => /^(Heading to|Looking around)/.test(t)), 'passing moments are left out');
  assert(/^(Went home|Still out when the day ended)$/.test(texts[texts.length - 1]) && d2.runs >= d2.runs0, 'it ends with them leaving');
  // the report: a tab with their name, and a line in the summary
  await g.ev(`showReport()`);
  eq(await g.ev(`[...document.querySelectorAll('#rpBody [data-rptab]')].map((b) => b.textContent).pop()`), 'Your guests', 'a tab for the followed guests');
  eq(await g.ev(`document.querySelectorAll('#rpBody [data-page=guest] .rp-diary').length`), 2, 'a diary for each');
  assert(await g.ev(`document.querySelectorAll('#rpBody [data-page=guest] li').length >= ${texts.length}`), 'every entry is listed');
  assert(await g.ev(`!!document.querySelector('#rpBody .rp-short [data-rpgo=guest]')`), 'the summary links to their day');
  eq(g.errors, [], 'no page errors');
}
