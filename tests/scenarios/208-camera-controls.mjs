// Free camera: right-drag turns and tilts about the spot under the mouse; two fingers twist to turn, slide up or
// down to tilt, pinch to zoom without turning; double tap zooms in, a two-finger tap zooms out, a flick glides.
// The tilt is saved, older saves get the usual one, and re-centring puts it back.
import { openGame, eq, assert } from '../harness.mjs';
const deg = (r) => Math.round(r * 180 / Math.PI);
export default async function ({ browser, url }) {
  // ---- desktop ----
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(`camTween = null; updateCamera()`);
  const az0 = await g.ev(`cam.az`), el0 = await g.ev(`EL`);
  eq(deg(el0), 27, 'a new game starts at the usual tilt');
  const P = await g.ev(`(() => { const p = pickTerrain(640, 450, true); return { x: p.x, y: p.y, z: p.z }; })()`);
  const m = g.page.mouse;
  await m.move(640, 450); await m.down({ button: 'right' });
  for (let k = 1; k <= 10; k++) await m.move(640 + k * 20, 450 - k * 8);
  await m.up({ button: 'right' }); await g.wait(100);
  const after = await g.ev(`({ az: cam.az, azGoal: cam.azGoal, el: EL, q: project(${P.x}, ${P.y}, ${P.z}) })`);
  assert(Math.abs(after.az - az0) > 0.5, `right-drag across turns the view (${after.az - az0})`);
  eq(after.az, after.azGoal, 'the turn stays where it was left');
  eq(deg(after.el), 22, 'right-drag up tilts toward the horizon, down to 22°');
  assert(Math.hypot(after.q.x - 640, after.q.y - 450) < 3, `the spot under the mouse stays put (${Math.round(after.q.x)}, ${Math.round(after.q.y)})`);
  // tilting stops at its limits
  await m.move(640, 450); await m.down({ button: 'right' });
  for (let k = 1; k <= 10; k++) await m.move(640, 450 + k * 60);
  await m.up({ button: 'right' });
  eq(deg(await g.ev(`EL`)), 72, 'right-drag down tilts to nearly straight down, no further');
  eq(await g.ev(`state.tool`), 'explore', 'nothing was picked or changed');
  // Q snaps to the old eighth-turn angles from a free angle
  await g.ev(`cam.azGoal = cam.az = 0.35 + 2.3 * Math.PI / 4`);
  await g.page.focus('body'); await g.page.keyboard.press('e');
  eq(Math.round(await g.ev(`(cam.azGoal - 0.35) / (Math.PI / 4) * 100`)), 300, 'E turns to the next eighth');
  await g.page.keyboard.press('q');
  eq(Math.round(await g.ev(`(cam.azGoal - 0.35) / (Math.PI / 4) * 100`)), 200, 'Q turns back an eighth');
  await g.page.keyboard.press('Shift+ArrowUp');
  eq(deg(await g.ev(`EL`)), 67, 'Shift+Up tilts 5° toward the horizon');
  // saved, and loaded again
  await g.ev(`camTween = null; saveNow()`);
  eq(deg(await g.ev(`JSON.parse(localStorage.getItem(saveKey())).cam.el`)), 67, 'the tilt is saved');
  await g.page.reload(); await g.reloaded(); await g.click('#startBtn'); await g.wait(200);
  await g.ev(`if (camTween) { camTween.t = 0.999 }`); await g.wait(200);
  eq(deg(await g.ev(`EL`)), 67, 'and comes back on loading');
  // an older save, with no tilt, gets the usual one
  const key = await g.ev(`saveKey()`); // leave the game first: it saves on the way out
  await g.page.goto(url + 'blank');
  await g.page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); delete s.cam.el; localStorage.setItem(k, JSON.stringify(s)); }, key);
  await g.page.goto(url); await g.reloaded(); await g.click('#startBtn'); await g.wait(200);
  await g.ev(`if (camTween) { camTween.t = 0.999 }`); await g.wait(200);
  eq(deg(await g.ev(`EL`)), 27, 'an older save starts at the usual tilt');
  await g.ev(`EL = 1.1`); await g.click('#cHome'); await g.ev(`camTween.t = 0.999`); await g.wait(200);
  eq(deg(await g.ev(`EL`)), 27, 're-centring puts the tilt back');
  eq(g.errors, [], 'no page errors (desktop)');
  await g.page.close();

  // ---- phone ----
  const p = await openGame(browser, url, { width: 390, height: 844, hasTouch: true });
  await p.click('#startBtn'); await p.wait(400);
  await p.ev(`camTween = null; select(null); sheetSize && sheetSize('min'); updateCamera()`);
  const cdp = await p.page.context().newCDPSession(p.page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const two = async (from, to, steps = 12) => {
    await touch('touchStart', from);
    for (let k = 1; k <= steps; k++) await touch('touchMove', from.map(([x, y], i) => [x + (to[i][0] - x) * k / steps, y + (to[i][1] - y) * k / steps]));
    await touch('touchEnd', []); await p.wait(50);
  };
  const view = () => p.ev(`({ az: cam.az, el: EL, v: cam.viewH })`);
  const cx = 195, cy = 330, r = 70;
  // twist a quarter turn
  let v0 = await view();
  const ring = (a) => [[cx - r * Math.cos(a), cy - r * Math.sin(a)], [cx + r * Math.cos(a), cy + r * Math.sin(a)]];
  await touch('touchStart', ring(0));
  for (let k = 1; k <= 16; k++) await touch('touchMove', ring(k / 16 * Math.PI / 2));
  await touch('touchEnd', []); await p.wait(50);
  let v1 = await view();
  assert(Math.abs(v1.az - v0.az) > 1, `a two-finger twist turns the view (${(v1.az - v0.az).toFixed(2)})`);
  assert(Math.abs(v1.el - v0.el) < 0.01, 'a twist does not tilt');
  // pinch out: zooms, doesn't turn or tilt
  v0 = v1;
  await two([[cx - 40, cy], [cx + 40, cy]], [[cx - 130, cy + 4], [cx + 130, cy - 4]]);
  v1 = await view();
  assert(v1.v < v0.v * 0.5, `a pinch zooms in (${Math.round(v0.v)} to ${Math.round(v1.v)})`);
  assert(Math.abs(v1.az - v0.az) < 0.001 && Math.abs(v1.el - v0.el) < 0.001, 'a pinch with a little wobble neither turns nor tilts');
  // two fingers side by side, up together: tilt toward the horizon
  await p.ev(`EL = 1; updateCamera()`); v0 = await view();
  await two([[cx - 60, cy + 120], [cx + 60, cy + 120]], [[cx - 60, cy - 20], [cx + 60, cy - 20]]);
  v1 = await view();
  assert(v1.el < v0.el - 0.3, `two fingers up tilts toward the horizon (${deg(v0.el)}° to ${deg(v1.el)}°)`);
  assert(Math.abs(v1.az - v0.az) < 0.001 && Math.abs(v1.v - v0.v) < 0.5, 'tilting neither turns nor zooms');
  // double tap zooms in; a quick two-finger tap zooms out
  await p.ev(`cam.viewH = 150; cam.viewGoal = null; select(null)`);
  await p.page.touchscreen.tap(cx, cy); await p.wait(60); await p.page.touchscreen.tap(cx + 3, cy + 2);
  assert(await p.ev(`cam.viewGoal`) < 100, 'a double tap zooms in');
  await p.ev(`cam.viewH = 150; cam.viewGoal = null; cam.zoomPt = null`);
  await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]]); await touch('touchEnd', []);
  assert(await p.ev(`cam.viewGoal`) > 200, 'a two-finger tap zooms out');
  // a flick glides on after the finger lifts
  await p.ev(`cam.viewGoal = null; cam.viewH = 150; cam.zoomPt = null; cam.target.set(0, 40, -4); updateCamera()`);
  const st = await p.ev(`[cam.target.x, cam.target.z]`);
  await touch('touchStart', [[cx, cy]]);
  for (let k = 1; k <= 6; k++) { await touch('touchMove', [[cx + k * 12, cy]]); }
  await touch('touchEnd', []);
  eq(await p.ev(`!!glide`), true, 'a flick starts a glide');
  const mid = await p.ev(`[cam.target.x, cam.target.z]`);
  await p.wait(400);
  const end = await p.ev(`[cam.target.x, cam.target.z, !!glide]`);
  assert(Math.hypot(end[0] - mid[0], end[1] - mid[1]) > 0.5, 'the view kept moving after the finger lifted');
  assert(Math.hypot(mid[0] - st[0], mid[1] - st[1]) > 0, 'and the drag itself moved it');
  eq(p.errors, [], 'no page errors (phone)');
  await p.page.close();
}
