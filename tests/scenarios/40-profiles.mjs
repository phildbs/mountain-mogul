// A signed-in player has one creator profile: its name shows on all their public resorts, it has a page
// listing them, and making it private hides the name. Guests are asked to sign in instead.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(2000);
  await g.ev(`openCommunity('profile')`); await g.wait(200);
  assert(/need an account/.test(await g.ev(`$('cmMe').innerText`)), 'guests are asked to sign in for a profile');
  await g.ev(`$('community').hidden = true`);
  // sign in; an old per-resort creator name carries over onto the new profile
  await g.ev(`(() => { state.creator = 'Old Name'; saveNow(); })()`);
  await g.ev(`__fakeSwitch('sam', 'sam@example.com')`); await g.wait(1500);
  eq(await g.ev(`CLOUD.profile`), { name: 'Old Name', public: true }, 'the old creator name became the profile');
  // two resorts, both public, both show the profile name after one save
  await g.ev(`newMountain('juniper')`); await g.ev(SETUPS.juniperStarter);
  await g.ev(`(() => { startGame(); select(null); saveNow(); CLOUD.lastUp = 0; return cloudSave(false); })()`); await g.wait(800);
  await g.ev(`openCommunity('profile')`); await g.wait(200);
  await g.ev(`(() => { $('cmCreator').value = '  Sam   T '; $('cmMeForm').requestSubmit(); })()`); await g.wait(600);
  eq(await g.ev(`CLOUD.profile`), { name: 'Sam T', public: true }, 'saving the profile');
  const rows = () => g.ev(`JSON.parse(localStorage.getItem('FAKE_DB')).rows.filter((r) => r.owner === 'sam').map((r) => r.summary.creator)`);
  assert((await rows()).length >= 1 && (await rows()).every((c) => c === 'Sam T'), 'the name is on every one of their resorts');
  // their page
  await g.click('#cmMyPage'); await g.wait(300);
  eq(await g.ev(`$('cmCreatorTab').hidden`), false, 'See my page opens it');
  const page = await g.ev(`$('cmCreatorTab').innerText`);
  assert(/SAM T|Sam T/.test(page) && /Resorts/i.test(page) && /as other players see it/.test(page), 'my page, as others see it');
  await g.click('#cmCreatorTab [data-action=cmBack]'); await g.wait(100);
  eq(await g.ev(`$('cmProfileTab').hidden`), false, 'Back returns to the Profile tab');
  const db = await g.ev(`localStorage.getItem('FAKE_DB')`);
  // another player: the board links the name to Sam's page
  const h = await openGame(browser, url);
  await h.ev(`localStorage.setItem('FAKE_DB', ${JSON.stringify(db)})`);
  await h.click('#startBtn'); await h.wait(1800);
  await h.ev(`(async () => { CLOUD.boardAt = 0; await loadBoard(true); })()`); await h.wait(300);
  await h.ev(`openCommunity('board')`); await h.wait(300);
  assert(await h.ev(`!!document.querySelector('#cmBoard .who-link[data-v=sam]')`), 'the name on the board is a link');
  await h.click('#cmBoard .who-link[data-v=sam]'); await h.wait(300);
  const other = await h.ev(`$('cmCreatorTab').innerText`);
  assert(/Sam T/i.test(other) && /Visit/.test(other), 'it opens Sam’s page with their resorts');
  // Sam goes private: the name disappears from their resorts and the page is closed
  await g.ev(`(() => { $('cmProfPublic').checked = false; $('cmMeForm').requestSubmit(); })()`); await g.wait(600);
  assert((await rows()).every((c) => c === ''), 'a private profile takes the name off their resorts');
  eq(g.errors.concat(h.errors), [], 'no page errors');
  await g.page.close(); await h.page.close();
}
