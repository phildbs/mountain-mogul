// Two devices: while this one has the resort open, another device saves it further. This device never sends its older
// resort over that: before an upload, and when you come back to the tab, it loads the newer save instead. "Newer" is
// "changed online since this device last had it", so another device's clock running slow doesn't hide it.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.ev(SETUPS.juniperStarter); await g.click('#startBtn'); await g.wait(300);
  await g.page.waitForFunction(() => window.__dbg('CLOUD.ready && !!CLOUD.uid'), null, { timeout: 15000 });
  await g.ev(`saveNow(); cloudSave(true)`);
  await g.page.waitForFunction(() => window.__dbg('!CLOUD.uploading && !!activeSlot().seenAt'), null, { timeout: 10000 });
  const id = await g.ev(`activeSlot().id`);
  const row = () => g.page.evaluate((id) => { const r = JSON.parse(localStorage.getItem('FAKE_DB')).rows.find((x) => x.id === id); return { cash: r.save.cash, at: r.updated_at }; }, id);
  eq(await g.ev(`activeSlot().seenAt`), Date.parse((await row()).at), 'this device remembers the save time of its own upload');
  // "another device" saves further, its clock 10 minutes slow (so its save time looks older than this one's)
  const other = (cash, mins) => g.page.evaluate(([id, cash, mins]) => {
    const d = JSON.parse(localStorage.getItem('FAKE_DB')), r = d.rows.find((x) => x.id === id);
    r.save = { ...r.save, cash }; r.summary = { ...r.summary, cash, when: 'Season 1 · Sat, Dec 12' }; r.updated_at = new Date(Date.now() + mins * 60000).toISOString();
    localStorage.setItem('FAKE_DB', JSON.stringify(d));
  }, [id, cash, mins]);
  await other(7777777, -10);
  // this device carries on and ends a day: the upload finds the newer save and loads it instead of sending
  await g.ev(`state.cash = 1234; saveNow(); cloudSave(true)`);
  await g.reloaded();
  await g.page.waitForFunction(() => window.__dbg('state.started'), null, { timeout: 20000 });
  eq(await g.ev(`state.cash`), 7777777, 'the newer save from the other device is loaded here');
  eq((await row()).cash, 7777777, 'and it was not overwritten online with the older resort');
  await g.page.waitForFunction(() => /played further on another device/.test(document.body.innerText), null, { timeout: 5000 });
  // back to an open tab after playing elsewhere: it loads the newer save straight away
  await g.page.waitForFunction(() => window.__dbg('CLOUD.ready && !!CLOUD.own'), null, { timeout: 15000 });
  await other(8888888, 3);
  await g.ev(`checkedAt = 0; checkNewerElsewhere()`);
  await g.reloaded();
  await g.page.waitForFunction(() => window.__dbg('state.started'), null, { timeout: 20000 });
  eq(await g.ev(`state.cash`), 8888888, 'coming back to the tab loads the newer save');
  // nothing changed elsewhere: this device's own uploads go through, and nothing reloads
  await g.page.waitForFunction(() => window.__dbg('CLOUD.ready && !!CLOUD.own'), null, { timeout: 15000 });
  await g.ev(`state.cash = 4242; saveNow(); cloudSave(true)`);
  await g.page.waitForFunction(() => window.__dbg('!CLOUD.uploading'), null, { timeout: 10000 }); await g.wait(300);
  eq([(await row()).cash, await g.ev(`state.cash`)], [4242, 4242], 'with nothing newer online, this device saves as usual');
  await g.ev(`checkedAt = 0; checkNewerElsewhere()`); await g.wait(500);
  eq(await g.ev(`[state.cash, leaving]`), [4242, false], 'and coming back to the tab changes nothing');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
