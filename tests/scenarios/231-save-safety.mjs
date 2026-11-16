// Save safety (Nov 16 review of the fix-only releases: saves were the bugs that cost players their progress).
// Cases the other save scenarios don't cover:
//  1. the same resort open in two tabs of one browser, on the same version: the tab left behind must never save its
//     older resort over the newer one, even when it's simply closed;
//  2. the connection dropping while you play: nothing is lost, and once it's back the newest resort goes online;
//  3. a damaged copy on this device: the resort comes back from online, and is never opened blank and saved over.
import { openGame, openTab, eq, assert, SETUPS } from '../harness.mjs';
const saved = `(() => { try { return JSON.parse(localStorage.getItem(saveKey())).clock.day; } catch (e) { return null; } })()`;
const online = (g) => g.ev(`(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); const r = d.rows.find((x) => x.id === slots.active); return r && r.save && r.save.clock.day; })()`);
const look = `[state.started, state.day, world.lifts.length, world.trails.length, state.resortName]`;
async function starter(g) {
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.resortName = 'Safe Resort'; state.day = 20; saveNow(); $('mTitle').onclick()`); await g.wait(800); // the title uploads at once
  eq(await online(g), 20, 'set up: saved online');
  await g.click('#startBtn'); await g.wait(300);
  const [L, T] = await g.ev(`[world.lifts.length, world.trails.length]`);
  return (day) => [true, day, L, T, 'Safe Resort']; // how the resort should look on a given day
}
export default async function ({ browser, url }) {
  // 1. Two tabs. A plays on; B, opened earlier on the same resort, is left behind.
  {
    const A = await openGame(browser, url, { tabs: true });
    const want = await starter(A);
    const B = await openTab(A, url);
    await B.click('#startBtn'); await B.wait(300);
    eq(await B.ev(look), want(20), 'the second tab opens the same resort');
    await A.ev(`state.day = 27; saveNow()`); // played on in A, not online yet
    eq(await A.ev(saved), 27, 'A saved on this device');
    // B is closed (or switched away from): it saves as it goes, but must not save its day 20 over day 27
    await B.ev(`window.dispatchEvent(new Event('pagehide')); saveNow(); cloudSaveNow()`); await B.wait(300);
    eq(await A.ev(saved), 27, 'the tab left behind saved nothing over the newer resort');
    // nor may it upload its older resort
    await B.ev(`CLOUD.lastUp = 0; cloudSave(false)`); await B.wait(500);
    eq(await B.ev(`[tabBehind(), document.getElementById('updateBar').hidden]`), [true, false], 'the tab left behind knows, and says to reload');
    await A.ev(`CLOUD.lastUp = 0; cloudSave(false)`); await A.wait(500);
    eq(await online(A), 27, 'A uploads its newer resort');
    // back to B: it picks up the newer resort rather than carrying on with day 20
    await B.ev(`checkedAt = 0; window.dispatchEvent(new Event('focus'))`); await B.wait(500);
    if (await B.ev(`!state.started || leaving`)) { await B.reloaded(); if (await B.ev(`!state.started`)) { await B.click('#startBtn'); await B.wait(300); } }
    eq((await B.ev(look))[1], 27, 'the tab left behind loads the newer resort when you come back to it');
    // a new tab opens the newest resort
    await B.page.close();
    const C = await openTab(A, url);
    await C.click('#startBtn'); await C.wait(300);
    eq(await C.ev(look), want(27), 'a new tab opens the newest resort');
    eq([...A.errors, ...B.errors, ...C.errors], [], 'no page errors (two tabs)');
    await C.page.close(); await A.page.close();
  }
  // 2. The connection drops while you play.
  {
    const g = await openGame(browser, url);
    const want = await starter(g);
    await g.ev(`localStorage.setItem('FAKE_OFFLINE', '1')`);
    await g.ev(`state.day = 24; saveNow(); CLOUD.lastUp = 0; cloudSave(false)`); await g.wait(500);
    eq([await g.ev(saved), await online(g)], [24, 20], 'offline: saved on this device, the online copy untouched');
    // reopened while still offline: the resort is all there
    await g.page.reload(); await g.reloaded();
    await g.click('#startBtn'); await g.wait(500);
    if (await g.ev(`!state.started`)) { await g.reloaded(); await g.click('#startBtn'); await g.wait(500); }
    eq(await g.ev(look), want(24), 'reopened offline: the resort is all there');
    // back online: the newer resort goes up, and the older online copy isn't taken for newer progress
    await g.ev(`localStorage.removeItem('FAKE_OFFLINE')`);
    await g.ev(`state.day = 25; saveNow(); CLOUD.lastUp = 0; cloudSave(false)`); await g.wait(800);
    eq([await g.ev(`state.day`), await online(g)], [25, 25], 'back online: the newest resort goes up');
    eq(g.errors, [], 'no page errors (offline)');
    await g.page.close();
  }
  // 3. A damaged copy on this device.
  {
    const g = await openGame(browser, url);
    const want = await starter(g);
    await g.ev(`$('mTitle').onclick()`); await g.wait(800);
    await g.ev(`(() => { const t = localStorage.getItem(saveKey()); localStorage.setItem(saveKey(), t.slice(0, t.length >> 1)); })()`);
    await g.page.reload(); await g.reloaded();
    await g.click('#startBtn'); await g.wait(800);
    if (await g.ev(`!state.started`)) { await g.reloaded(); if (await g.ev(`!state.started`)) { await g.click('#startBtn'); await g.wait(800); } }
    eq(await g.ev(look), want(20), 'a damaged copy here: the resort comes back from online');
    await g.ev(`saveNow(); CLOUD.lastUp = 0; cloudSave(false)`); await g.wait(500);
    eq(await online(g), 20, 'and the online copy is still the resort');
    eq(g.errors, [], 'no page errors (damaged copy)');
    await g.page.close();
  }
}
