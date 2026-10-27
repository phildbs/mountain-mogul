// A first visit starts on Maple Notch, the easiest mountain. Juniper Ridge is still one tap away
// in the picker, and anyone who already has a resort keeps playing where they left off.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { mountain: 'fresh' });
  eq(await g.ev(`MOUNTAIN.id`), 'maple', 'a first visit opens on Maple Notch');
  assert(/Maple Notch/i.test(await g.ev(`$('titleSlots').innerText`)), 'the title card is Maple Notch');
  assert(await g.ev(`!!document.querySelector('[data-slot=tutorial]')`), 'with the tutorial offered');
  await g.click('#startBtn'); await g.wait(400);
  eq(await g.ev(`[state.started, state.cash, activeSlot().mountain]`), [true, 2200000, 'maple'], 'and starts there with its money');
  // Juniper from the picker
  await g.ev(`showTitle()`); await g.wait(300);
  await g.click('[data-slot=new]'); await g.wait(200);
  eq(await g.ev(`[...document.querySelectorAll('#titleSlots .pick h2')].map((h) => h.textContent).slice(0, 3)`), ['Maple Notch', 'Juniper Ridge', 'Raven Peak'], 'the picker lists Maple first, then Juniper');
  await g.page.close();

  // an existing player on Juniper keeps it after a reload
  const h = await openGame(browser, url);
  eq(await h.ev(`MOUNTAIN.id`), 'juniper', 'a Juniper resort opens on Juniper');
  await h.click('#startBtn'); await h.wait(300); await h.ev(`saveNow()`);
  await h.page.reload(); await h.wait(2500);
  eq(await h.ev(`MOUNTAIN.id`), 'juniper', 'and is still there after a reload');
  eq(h.errors, [], 'no page errors');
  await h.page.close();
}
