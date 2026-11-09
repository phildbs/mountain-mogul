// From Phil (Nov 9): on a phone, applying a bigger lot froze the view, still showing the green draft, until the game
// was reopened. The draft's handles outlived it, and the next frame stopped on them. Drawn frames, as on a phone.
import { openGame, eq, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { render: true, width: 390, height: 844 });
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev('state.cash = 2e7');
  await g.ev(`(() => { openRoads('parking'); startLotEdit(0); ldraft.n += 8; ldraft.x += 2; ldraft.info = null; showRGhost(); renderSheet(); })()`);
  await g.wait(600);
  eq(await g.ev(`roadHandleEls.length > 0`), true, 'the draft has its handles on screen');
  await g.ev(`commitLot()`); await g.wait(600);
  const t0 = await g.ev(`state.time`);
  eq(await g.ev(`[stalls.length, rGhost.length, [...document.querySelectorAll('#roadHandles .handle')].filter((e) => !e.hidden).length]`), [144, 0, 0], 'applied: the bigger lot, no ghost, no handles left');
  await g.ev(`(() => { setTool('explore'); openDay(); state.speed = 4; })()`); await g.wait(1500);
  eq(await g.ev(`state.time > ${t0}`), true, 'and the game keeps running');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
