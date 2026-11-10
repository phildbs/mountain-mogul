// Sharing a mountain from the editor (supabase/shared-mountains.sql): signed-in players with a player name share it,
// anyone with the link can play it (guests too) or copy it to edit when the maker allows, and the maker can stop.
import { openGame, eq, assert } from '../harness.mjs';
const dlg = (g) => g.ev(`document.getElementById('crisis').hidden ? '' : document.getElementById('crBody').textContent.replace(/\\s+/g, ' ')`);
export default async function ({ browser, url }) {
  const a = await openGame(browser, url, { query: '?editor=1', mountain: 'fresh' });
  await a.click('#edMaps'); await a.ev(`document.getElementById('edFrom').value = 'juniper'`); await a.click('#crisis [data-ed-new=shape]'); await a.reloaded();
  assert(await a.ev(`edCheck().every((c) => c.ok) && CLOUD.ready && CLOUD.guest`), 'Juniper Ridge’s own shape is ready to play, and the editor is online as a guest');
  // a guest is asked to sign in first
  await a.click('#edShare'); await a.wait(200);
  assert((await dlg(a)).includes('Sign in to share'), 'a guest is asked to sign in');
  // signed in, with no player name yet: pick one
  await a.ev(`__fakeSwitch('user-A', 'a@example.com')`); await a.page.reload(); await a.reloaded();
  await a.click('#edShare'); await a.wait(300);
  assert((await dlg(a)).includes('Pick your player name'), 'no player name yet: pick one');
  await a.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.profiles = { other: { name: 'Taken', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); });
  await a.page.fill('#edPName', 'taken'); await a.click('#edPSave'); await a.wait(300);
  assert((await dlg(a)).includes('already called taken'), 'a name another player has is refused');
  await a.page.fill('#edPName', 'Moss'); await a.click('#edPSave'); await a.wait(300);
  assert((await dlg(a)).includes('It shows your name, Moss'), 'with a name, the share dialog');
  // a name the word filter blocks can't be shared
  await a.ev(`ED.name = 'Shit Hill'`); await a.click('#edShare'); await a.wait(300); await a.click('#edShareGo'); await a.wait(300);
  assert(await a.ev(`document.getElementById('toast').textContent.includes('name isn’t allowed') && !(JSON.parse(localStorage.getItem('FAKE_DB')).shared || []).length`), 'a blocked word in the name is refused');
  await a.ev(`ED.name = 'My Juniper Ridge'`); await a.click('#edShare'); await a.wait(300);
  // share it, with copying off
  await a.ev(`document.getElementById('edAllow').checked = false`); await a.click('#edShareGo'); await a.wait(400);
  const id = await a.ev('mapIdOf(edDoc())');
  const row = await a.ev(`JSON.parse(localStorage.getItem('FAKE_DB')).shared.find((r) => r.id === '${id}')`);
  eq([row.creator, row.name, row.allow_copy, row.vertical > 1000, row.doc.h === await a.ev('encodeHeights(ED.E)')], ['Moss', 'My Juniper Ridge', false, true, true], 'shared under Moss, play only, with its ground');
  assert((await dlg(a)).includes('Shared.') && await a.ev(`document.querySelector('.ed-link input').value.endsWith('?mountain=${id.slice(3)}')`), 'the dialog shows it shared, with its link');
  // a guest opens the link: who made it, and Play (no Copy while it's off)
  const db = () => a.page.evaluate(() => localStorage.getItem('FAKE_DB'));
  const guest = async (q) => { const b = await openGame(browser, url); await b.page.evaluate((d) => localStorage.setItem('FAKE_DB', d), await db()); await b.page.goto(url + q); await b.reloaded(); return b; };
  let b = await guest(`?mountain=${id.slice(3)}`); await b.wait(300);
  const card = await dlg(b);
  assert(card.includes('My Juniper Ridge') && card.includes('Made by Moss') && !(await b.ev(`!!document.getElementById('smCopy')`)), `the link shows the mountain and its maker, with no Copy while copying is off (${card.slice(0, 80)})`);
  await b.click('#smPlay'); await b.reloaded();
  eq(await b.ev(`[MOUNTAIN.id, MOUNTAIN.name, state.started, activeSlot().mountain]`), [id, 'My Juniper Ridge', true, id], 'Play starts a resort on it');
  eq(b.errors, [], 'no errors playing a shared mountain'); await b.page.close();
  // copying on: a guest copies it into their editor
  await a.click('#edAllow'); await a.wait(300);
  eq(await a.ev(`JSON.parse(localStorage.getItem('FAKE_DB')).shared[0].allow_copy`), true, 'the maker turns copying on');
  b = await guest(`?mountain=${id.slice(3)}`); await b.wait(300);
  await b.click('#smCopy'); await b.reloaded();
  eq(await b.ev(`[EDITOR, ED.name, encodeHeights(ED.E) === ${JSON.stringify(row.doc.h)}, draftList().length]`), [true, 'My Juniper Ridge copy', true, 1], 'Copy to edit opens it in their own editor');
  eq(b.errors, [], 'no errors copying'); await b.page.close();
  // Play as a sandbox: tick it on the card
  b = await guest(`?mountain=${id.slice(3)}`); await b.wait(300);
  await b.ev(`document.querySelector('#crBody [data-sandbox]').checked = true`); await b.click('#smPlay'); await b.reloaded();
  eq(await b.ev(`[MOUNTAIN.id, state.sandbox, !!activeSlot().sandbox, state.goals]`), [id, true, true, null], 'a sandbox resort on the shared mountain: unlimited money, no goals');
  eq(b.errors, [], 'no errors in a sandbox'); await b.page.close();
  // shaping it further makes another mountain: it isn't shared until shared again
  await a.ev(`(() => { const p = { x: 0, z: -40 }; ED.tool = 'raise'; edStrokeStart(p); for (let i = 0; i < 5; i++) edBrush(p, 0.05); edStrokeEnd(); })()`);
  await a.ev(`document.getElementById('crisis').hidden = true`); await a.click('#edShare'); await a.wait(300);
  assert((await dlg(a)).includes('Your other shared mountains') && await a.ev(`!!document.getElementById('edShareGo')`), 'changed, it’s a new mountain to share; the first is listed');
  // stop sharing the first: its link stops working
  await a.click('#crisis [data-sh-del]'); await a.click('#crisis [data-sh-del]'); await a.wait(300);
  eq(await a.ev(`JSON.parse(localStorage.getItem('FAKE_DB')).shared.length`), 0, 'Stop sharing deletes it');
  b = await guest(`?mountain=${id.slice(3)}`); await b.wait(300);
  assert(await b.ev(`document.getElementById('crisis').hidden && document.getElementById('toast').textContent.includes('isn’t shared any more')`), 'its link says it isn’t shared any more');
  await b.page.close();
  // before the SQL is run on the database, Share says so
  await a.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.noShared = true; localStorage.setItem('FAKE_DB', JSON.stringify(d)); });
  await a.click('#edShare'); await a.wait(300);
  assert((await dlg(a)).includes('isn’t switched on yet'), 'before the database has it, Share says it isn’t switched on yet');
  eq(a.errors, [], 'no errors');
}
