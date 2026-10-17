// Typing in a text box never drives the game, and the view can always be re-centred.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(500);
  await g.ev(`camTween = null`); // skip the intro glide (software rendering here is slow)
  const cam = () => g.ev(`[cam.target.x, cam.target.z, cam.azGoal, cam.viewGoal || cam.viewH, overlay.slope, overlay.traffic].map(v => typeof v === 'number' ? Math.round(v * 100) / 100 : v).join()`);
  const before = await cam();
  await g.click('#mFeedback'); await g.wait(200);
  await g.page.focus('#fbText');
  await g.page.keyboard.type('wasd qe hello world -+ ot 12345', { delay: 0 });
  await g.page.keyboard.press('ArrowUp'); await g.page.keyboard.press('ArrowLeft');
  await g.wait(300);
  eq(await cam(), before, 'typing feedback leaves the view, tools and overlays alone');
  eq(await g.ev(`state.tool`), 'explore', 'no tool switched');
  eq(await g.ev(`$('fbText').value`), 'wasd qe hello world -+ ot 12345', 'the text went into the box');
  await g.click('#fbClose'); await g.wait(100);
  await g.page.focus('body');
  // shortcuts still work when nothing is being typed
  for (let k = 0; k < 6; k++) await g.page.keyboard.press('w');
  await g.wait(300);
  assert(await cam() !== before, 'W pans the view');
  await g.page.keyboard.press('h'); await g.wait(200);
  const home = await g.ev(`camTween ? [camTween.to.x, camTween.to.z, Math.round(camTween.to.viewH) === Math.round(defaultView())].join() : 'no glide'`);
  eq(home, '0,-6,true', 'H glides back to the standard view');
  await g.click('#cHome'); await g.wait(200);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
