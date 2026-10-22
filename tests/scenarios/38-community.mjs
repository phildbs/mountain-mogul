// New resorts get names of their own; guests' public resorts appear on the boards marked "Guest";
// the Community window has Leaderboard and Profile tabs and shows where your resort stands.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(2200);
  const name = await g.ev(`state.resortName`);
  assert(!(await g.ev(`defaultName(state.resortName)`)), `a new resort gets its own name (${name})`);
  eq(await g.ev(`$('advName').value`), name, 'the welcome offers to rename it');
  await g.click('#sheet [data-action=rollName]'); await g.wait(100);
  const rolled = await g.ev(`state.resortName`);
  assert(rolled !== name && !(await g.ev(`defaultName(state.resortName)`)), `the dice suggests another (${rolled})`);
  eq(await g.ev(`activeSlot().name`), rolled, 'and the save list follows');
  await g.ev(`(() => { const el = $('advName'); el.value = '  Bluebird   Bowl '; el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  eq(await g.ev(`state.resortName`), 'Bluebird Bowl', 'typing a name renames it, tidied');
  // a guest's resort goes on the board, marked Guest
  await g.ev(`select(null)`); await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
  await g.ev(`(() => { if (!$('report').hidden && $('rpNext')) $('rpNext').click(); saveNow(); CLOUD.lastUp = 0; return cloudSave(false); })()`); await g.wait(800);
  const row = await g.ev(`(() => { const r = JSON.parse(localStorage.getItem('FAKE_DB')).rows.find((x) => x.id === slots.active); return { pub: r.public, guest: r.summary.guest }; })()`);
  eq(row, { pub: true, guest: true }, 'a guest resort is saved public, stamped as a guest');
  // the window: leaderboard first, with the standing card
  await g.ev(`openCommunity()`); await g.wait(300);
  eq(await g.ev(`$('cmProfileTab').hidden + '/' + $('cmBoardTab').hidden`), 'true/false', 'opens on the leaderboard');
  const st = await g.ev(`$('cmStanding').innerText`);
  assert(/#1/.test(st) && /Bluebird Bowl/.test(st) && /as a guest/.test(st), 'your standing, noting you are a guest');
  assert(/Guest/i.test(await g.ev(`$('cmBoard').innerText`)), 'the row is tagged Guest');
  await g.ev(`(() => { const s = document.querySelector('#cmBoard .boardsel'); s.value = 'visitors'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await g.wait(100);
  eq(await g.ev(`CLOUD.board`), 'visitors', 'the menu switches the ranking');
  await g.click('[data-cmtab=profile]'); await g.wait(100);
  eq(await g.ev(`$('cmProfileTab').hidden`), false, 'the Profile tab shows the form');
  eq(await g.ev(`$('cmResort').value`), 'Bluebird Bowl', 'with the resort name');
  // private: off the board, and the card offers to make it public
  await g.ev(`(() => { $('cmPublic').checked = false; $('cmProfile').requestSubmit(); })()`); await g.wait(500);
  await g.click('[data-cmtab=board]'); await g.ev(`refreshCommunity()`);
  assert(/private/.test(await g.ev(`$('cmStanding').innerText`)), 'a private resort is told so');
  await g.click('#cmStanding [data-action=goPublic]'); await g.wait(400);
  eq(await g.ev(`isPublic()`), true, 'and can go public from there');
  // another player sees the guest resort
  const db = await g.ev(`localStorage.getItem('FAKE_DB')`);
  await g.page.close();
  const h = await openGame(browser, url);
  await h.ev(`(() => { localStorage.setItem('FAKE_DB', ${JSON.stringify(db)}); })()`);
  await h.ev(`(async () => { CLOUD.boardAt = 0; await loadBoard(true); })()`); await h.wait(500);
  await h.ev(`openCommunity()`); await h.wait(300);
  const other = await h.ev(`$('cmBoard').innerText`);
  assert(/Bluebird Bowl/.test(other) && /Guest/i.test(other) && /Visit/.test(other), 'another player sees it, tagged Guest, with Visit');
  eq(g.errors.concat(h.errors), [], 'no page errors');
  await h.page.close();
}
