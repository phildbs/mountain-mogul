// Another account's copy of a resort you already have (same mountain, name and day) can't be added to your account a
// second time: it says so and offers to remove it from this device. A different resort can still be added.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.ev(SETUPS.juniperStarter); await g.click('#startBtn'); await g.wait(300);
  await g.ev(`saveNow(); $('mTitle').onclick()`); await g.wait(400);
  await g.page.waitForFunction(() => window.__dbg('CLOUD.ready && !!CLOUD.uid'), null, { timeout: 15000 });
  // leave two other accounts' copies on this device: one the same resort as yours, one a different resort
  const ids = await g.ev(`(() => {
    const s = activeSlot(), sv = localStorage.getItem(slotKey(s.id)), same = newId(), other = newId();
    localStorage.setItem(slotKey(same), sv); localStorage.setItem(slotKey(other), sv);
    slots.list.push({ ...s, id: same, owner: 'someone-else' }, { ...s, id: other, owner: 'someone-else', name: 'Not Mine Peak' });
    writeSlots(); renderSlots(); return { same, other, own: s.id, n: ownIds().size };
  })()`);
  const card = (id) => g.ev(`(() => { const b = document.querySelector('#titleSlots [data-id="${id}"]'); const c = b && b.closest('.scard'); return c ? c.innerText.replace(/\\s+/g, ' ') : ''; })()`);
  const dup = await card(ids.same);
  assert(/Already in your account/.test(dup) && /Remove from this device/.test(dup) && !/Add to my account/.test(dup), `the same resort says it's already yours and offers to remove it (${dup})`);
  assert(/Add to my account/.test(await card(ids.other)), 'a different resort can still be added');
  // even asked directly, it isn't copied again
  await g.ev(`adoptMountain('${ids.same}')`); await g.wait(200);
  eq(await g.ev(`ownIds().size`), ids.n, 'no second copy, no slot used');
  // remove it from this device: your own copy stays
  await g.click(`#titleSlots [data-slot=del][data-id="${ids.same}"]`); await g.wait(100);
  await g.click(`#titleSlots [data-slot=delYes][data-id="${ids.same}"]`); await g.wait(300);
  eq(await g.ev(`[!!slotById('${ids.same}'), !!localStorage.getItem(slotKey('${ids.same}')), !!slotById('${ids.own}'), !!localStorage.getItem(slotKey('${ids.own}'))]`), [false, false, true, true], 'the copy is gone from this device; yours is kept');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
