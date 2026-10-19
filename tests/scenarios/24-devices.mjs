// Two devices: progress made on one reaches the other. Leaving for the title uploads at once,
// Continue loads a newer online copy, and an older copy never uploads over a newer one.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`saveNow()`); await g.wait(1500); // settles online
  const id = await g.ev(`slots.active`);
  const row = () => g.ev(`(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); const r = d.rows.find((x) => x.id === '${id}'); return r && { day: r.save && r.save.clock.day, at: r.updated_at }; })()`);

  // the "tablet": play on, then head to the title, which uploads straight away
  await g.ev(`state.day = 113; saveNow()`);
  await g.ev(`$('mTitle').onclick()`); await g.wait(800);
  eq((await row()).day, 113, 'going to the title uploads at once');

  // finishing a day uploads it too
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(`state.day = 40; openDay()`); await g.ev(SETUPS.finishDay); await g.wait(800);
  eq((await row()).day, 40, 'a finished day is saved online at once');
  await g.ev(`state.day = 113; saveNow(); $('mTitle').onclick()`); await g.wait(800);
  // the "PC": its copy here is older, and the online one is newer
  await g.ev(`(() => { const sv = JSON.parse(localStorage.getItem(slotKey(slots.active))); sv.clock.day = 93; localStorage.setItem(slotKey(slots.active), JSON.stringify(sv));
    activeSlot().savedAt = Date.now() - 600000; writeSlots(); })()`);
  await g.page.reload(); await g.reloaded();
  assert(/Newer save online/.test(await g.ev(`$('titleSlots').innerText`)), 'the card says a newer save is online');
  // an older device never uploads over it
  await g.ev(`state.day = 93; CLOUD.lastUp = 0; cloudSave(false)`); await g.wait(500);
  eq((await row()).day, 113, 'the older copy did not overwrite the newer one');
  // Continue brings the newer one in
  await g.click('#startBtn'); await g.wait(300);
  if (await g.ev(`!state.started`)) await g.reloaded();
  await g.wait(500);
  eq(await g.ev(`state.day`), 113, 'Continue loaded the newer online copy');
  eq(await g.ev(`onlineIsNewer(activeSlot())`), false, 'and the device is up to date');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
