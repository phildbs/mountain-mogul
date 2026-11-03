// Visiting someone else's resort is read only, can watch a day, and leaves your save alone.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(600);
  await g.ev(`newMountain('juniper')`);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`(() => { state.ticket = 80; const sv = saveData(false); const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.users['other'] = { anon: false };
    d.rows.push({ id: 'theirs', owner: 'other', public: true, summary: { ...summaryDoc(), name: 'Sam Summit', creator: 'Sam' }, save: sv, updated_at: new Date().toISOString() });
    localStorage.setItem('FAKE_DB', JSON.stringify(d)); clearSave(); applySave(null); state.resortName = 'My Hill'; saveNow(); refreshTitle(); })()`);
  await g.ev(`loadBoard(true)`); await g.wait(300);
  await g.ev(`visitResort('theirs')`); await g.wait(2000);
  eq(await g.ev(`[visiting.name, world.lifts.length, state.ticket, $('tbGo').textContent].join()`), 'Sam Summit,1,80,Watch a day', 'visiting');
  // The visit bar is a menu behind a floating eye button, open on arrival and tucked away by a tap on the map.
  eq(await g.ev(`[!$('mpFab').hidden, getComputedStyle($('mpFab').querySelector('.eye')).display !== 'none', getComputedStyle($('mpFab').querySelector('.crown')).display, $('visitBar').classList.contains('open')]`), [true, true, 'none', true], 'an eye button, its menu open on arrival');
  assert(/Visiting.*Sam Summit/.test(await g.ev(`$('visitBar').innerText`)), 'the menu says whose resort it is');
  await g.page.mouse.click(640, 500); await g.wait(100);
  eq(await g.page.isVisible('#visitBar'), false, 'a tap on the map closes it');
  await g.click('#mpFab'); await g.wait(100);
  eq(await g.page.isVisible('#visitHome'), true, 'the eye opens it again');
  await g.click('#mpFab'); await g.wait(100);
  await g.ev(`select({ kind: 'lift', obj: world.lifts[0] })`);
  eq(await g.ev(`!!selected`), false, 'lift panel stays closed');
  await g.click('#badge');
  eq(await g.ev(`$('menu').hidden`), true, 'menu stays closed');
  await g.click('#cashBox'); await g.wait(200);
  eq(await g.ev(`[...document.querySelectorAll('#sheet button:not([data-action=manage]):not([data-sheet])')].map(b => b.textContent.trim()).join()`), '✕', 'finances read only');
  // Card layout is available to visitors; gameplay controls must remain absent.
  eq(await g.ev(`[...sheet.querySelectorAll('[data-sheet]')].map(b=>b.dataset.sheet).sort()`), ['expand','min'], 'only layout controls added');
  const snapshot = `(() => {const {savedAt,cam,...resort}=saveData(false);return JSON.stringify(resort);})()`;
  const resort = await g.ev(snapshot);
  await g.page.locator('#sheet [data-sheet=min]').click();
  eq(await g.ev('sheetMode'), 'min', 'visitor can minimize finances');
  await g.page.locator('#sheet [data-sheet=expand]').click();
  eq(await g.ev('sheetMode'), 'full', 'visitor can expand finances');
  eq(await g.ev(snapshot), resort, 'layout controls do not change the visited resort');
  await g.ev(`setTool('trail')`);
  eq(await g.ev('state.tool'), 'explore', 'visitor still cannot build');
  await g.ev(`select(null)`); await g.click('#tbGo'); await g.ev(SETUPS.finishDay);
  assert(await g.ev(`state.lastReport.guests`) > 0, 'watched a day');
  await g.click('#mpFab'); await g.click('#visitHome'); await g.wait(1200);
  eq(await g.ev(`$('mpFab').hidden`), true, 'the eye goes with the visit');
  eq(await g.ev(`[$('title').hidden, state.resortName, world.lifts.length].join()`), 'false,My Hill,0', 'back on the title with my resort');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
