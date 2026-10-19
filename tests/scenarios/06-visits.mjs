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
  await g.ev(`select({ kind: 'lift', obj: world.lifts[0] })`);
  eq(await g.ev(`!!selected`), false, 'lift panel stays closed');
  await g.click('#badge');
  eq(await g.ev(`$('menu').hidden`), true, 'menu stays closed');
  await g.click('#cashBox'); await g.wait(200);
  eq(await g.ev(`[...document.querySelectorAll('#sheet button:not([data-action=manage])')].map(b => b.textContent.trim()).join()`), '✕', 'finances read only');
  await g.ev(`select(null)`); await g.click('#tbGo'); await g.ev(SETUPS.finishDay);
  assert(await g.ev(`state.lastReport.guests`) > 0, 'watched a day');
  await g.click('#visitHome'); await g.wait(1200);
  eq(await g.ev(`[$('title').hidden, state.resortName, world.lifts.length].join()`), 'false,My Hill,0', 'back on the title with my resort');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
