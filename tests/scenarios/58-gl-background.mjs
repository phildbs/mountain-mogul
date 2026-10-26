// A graphics reset while the game is switched away (phones reclaim memory) waits for the player to come
// back before reloading, isn't counted toward switching to Low graphics, and is reported as such.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter);
  await g.page.evaluate(() => {
    window.__stay = 1; window.__hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window.__hidden ? 'hidden' : 'visible') });
  });
  await g.page.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  await g.ev(`(() => { localStorage.setItem('mm.glresets', JSON.stringify([Date.now() - 60000])); canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })); })()`);
  await g.wait(2500);
  eq(await g.page.evaluate(() => window.__stay), 1, 'no reload while the game is in the background');
  eq(await g.ev(`localStorage.getItem('mm.gfx')`), null, 'a background reset doesn’t switch to Low graphics');
  eq(await g.ev(`JSON.parse(localStorage.getItem('mm.glresets')).length`), 1, 'and isn’t counted');
  const errs = await g.ev(`JSON.parse(localStorage.getItem('FAKE_DB')).errors || []`);
  assert(errs.some((e) => e.message === 'Graphics reset (full, in background)'), 'reported as a background reset');
  // the player comes back: now it reloads into the game
  const back = g.page.waitForEvent('load', { timeout: 15000 });
  await g.page.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await back; await g.reloaded(); await g.wait(500);
  eq(await g.page.evaluate(() => window.__stay), undefined, 'reloaded once the player is back');
  eq(await g.ev(`[state.started, world.lifts.length]`), [true, 1], 'straight back into the resort');
  eq(g.errors.filter((e) => !/WebGL|context/i.test(e)), [], 'no page errors');
  await g.page.close();
}
