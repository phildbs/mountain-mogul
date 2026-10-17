// Up to three mountains per account: creating, upgrading an old single save, signing in,
// the limit, deleting, a second device and signing out.
import { openGame, assert, eq, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  const v = () => g.ev(`({ uid: CLOUD.uid, active: slots.active, n: slots.list.length, own: (CLOUD.own || []).length, rows: [...document.querySelectorAll('#titleSlots li')].length })`);
  eq((await v()).n, 0, 'fresh device has no mountains');
  await g.click('#startBtn'); await g.wait(500);
  await g.ev(SETUPS.juniperStarter); await g.ev(`saveNow(); cloudSave(true)`); await g.wait(300);
  await g.ev(`$('mTitle').onclick()`); await g.wait(500);
  eq((await v()).own, 1, 'first mountain saved online');

  // turn it into a save from before multiple mountains: one key, plus the owner key
  await g.ev(`(() => { const s = slots.list[0], raw = localStorage.getItem(slotKey(s.id)); slots = { active: null, list: [] };
    localStorage.setItem(SAVE_KEY, raw); localStorage.setItem(SAVE_KEY + '.owner', CLOUD.uid); localStorage.removeItem(slotKey(s.id)); localStorage.removeItem(SLOTS_KEY);
    const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.rows[0].id = CLOUD.uid; localStorage.setItem('FAKE_DB', JSON.stringify(d)); })()`);
  await g.page.reload(); await g.reloaded();
  const mig = await g.ev(`({ id: slots.active, uid: CLOUD.uid, lifts: world.lifts.length, legacy: localStorage.getItem(SAVE_KEY) })`);
  eq(mig.id, mig.uid, 'upgraded save keeps the account id'); eq(mig.lifts, 1, 'upgraded save keeps the resort'); eq(mig.legacy, null, 'old key removed');

  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  const sw = await g.ev(`({ owner: activeSlot().owner, own: CLOUD.own.length })`);
  eq(sw.owner, 'user-B', 'empty account takes the device mountain'); eq(sw.own, 1, 'and saves it online');

  for (let k = 0; k < 2; k++) { await g.click('[data-slot=new]'); await g.wait(100); await g.click('[data-slot=pick][data-mt=juniper]'); await g.wait(600); await g.ev(`saveNow(); cloudSave(true); $('mTitle').onclick()`); await g.wait(500); }
  eq((await v()).own, 3, 'three mountains online');
  eq(await g.ev(`newMountain()`), false, 'a fourth is refused');
  eq(await g.ev(`!!document.querySelector('[data-slot=new]')`), false, 'New mountain hidden at the limit');

  const second = await g.ev(`slots.list[1].id`);
  await g.click(`[data-slot=del][data-id="${second}"]`); await g.wait(100); await g.click('[data-slot=delYes]'); await g.wait(600);
  eq(await g.ev(`CLOUD.own.length + '/' + slots.list.length`), '2/2', 'deleted locally and online');

  // a second device: only the session and the online database carry over
  await g.ev(`(() => { slots = { active: null, list: [] }; for (const k of Object.keys(localStorage)) if (!k.startsWith('FAKE')) localStorage.removeItem(k); })()`);
  await g.page.reload(); await g.reloaded();
  const dev2 = await g.ev(`({ local: slots.list.length, rows: slotRows().length })`);
  eq(dev2.local, 1, 'second device pulls the newest mountain'); eq(dev2.rows, 2, 'and lists the other one online');

  // the server refuses a fourth mountain made elsewhere
  await g.ev(`(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.rows.push({ id: 'elsewhere', owner: CLOUD.uid, public: false, summary: { name: 'Elsewhere' }, save: null, updated_at: new Date().toISOString() }); localStorage.setItem('FAKE_DB', JSON.stringify(d)); })()`);
  await g.ev(`newMountain(); saveNow()`); await g.ev(`cloudSave(true)`); await g.wait(300);
  assert(/3 mountains online/.test(await g.ev(`CLOUD.error`)), 'limit error shown');

  await g.ev(`signOut()`); await g.wait(1200);
  eq((await v()).n, 0, 'signing out clears the device');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
