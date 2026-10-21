// When the browser kills the page mid-game, the next visit reports it with what the player was doing;
// two graphics resets in a few minutes switch the game to Low graphics; Graphics in the menu toggles it.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter);
  await g.wait(4500); // a heartbeat
  const alive = await g.ev(`JSON.parse(localStorage.getItem('mm.alive'))`);
  assert(alive && alive.mt === 'juniper' && alive.lifts === 1, 'while playing, the game notes what is happening');
  // the browser kills the page: no pagehide, so the note stays. Simulate by reloading with it put back.
  await g.page.evaluate(() => { const rm = Storage.prototype.removeItem; Storage.prototype.removeItem = function (k) { if (k !== 'mm.alive') rm.call(this, k); }; });
  await g.page.reload(); await g.reloaded(); await g.wait(1500);
  const errs = await g.ev(`JSON.parse(localStorage.getItem('FAKE_DB')).errors || []`);
  const crash = errs.find((e) => /closed unexpectedly/.test(e.message));
  assert(crash, 'the next visit reports it');
  eq(crash.context.lifts, 1, 'with what the player was doing');
  eq(await g.ev(`localStorage.getItem('mm.alive')`), null, 'and clears the note');
  eq(await g.ev(`localStorage.getItem('mm.booting')`), null, 'a launch that finishes clears its marker');

  // two graphics resets in a few minutes: Low graphics from then on
  await g.ev(`(() => { localStorage.setItem('mm.glresets', JSON.stringify([Date.now() - 60000])); window.reloadInto = () => {}; })()`);
  await g.ev(`(() => { const e = new Event('webglcontextlost', { cancelable: true }); canvas.dispatchEvent(e); })()`);
  eq(await g.ev(`localStorage.getItem('mm.gfx')`), 'low', 'switched to Low graphics');
  const errs2 = await g.ev(`JSON.parse(localStorage.getItem('FAKE_DB')).errors || []`);
  assert(errs2.some((e) => /Graphics reset/.test(e.message)), 'the graphics reset is reported');
  await g.page.reload(); await g.reloaded(); await g.wait(500);
  eq(await g.ev(`GFX`), 'low', 'the game starts in Low graphics');
  eq(await g.ev(`renderer.shadowMap.enabled`), false, 'without shadows');
  eq(await g.ev(`$('mGfxV').textContent`), 'Low', 'the menu shows it');
  eq(g.errors.filter((e) => !/WebGL|context/i.test(e)), [], 'no page errors');
  await g.page.close();
}
