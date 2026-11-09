// From Phil (Nov 9): on a phone a road couldn't be started: a touch on the access road went to editing its route, and
// the road is only a few pixels wide zoomed out. Now a tap on a road starts a new one there, taps lay it out, a drag
// paints it, and touches reach a fingertip's width. Real touches on a phone-sized screen.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { render: true, width: 390, height: 844, hasTouch: true });
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev('state.cash = 2e7');
  // a lot west of the base, then the Roads tab, zoomed out like a phone player
  await g.ev(`(() => { openRoads('parking'); const gs = roadsGestureStart({ x: -36, z: 56 }); roadsGestureMove(gs, { x: -24, z: 64 }); roadsGestureEnd(gs, { x: -24, z: 64 }); commitLot(); setRoadsTab('roads');
    camTween = null; cam.viewGoal = null; cam.viewH = 95; renderSheet(); /* the lot and the road above the panel: find a camera spot that shows both */
    const top = sheet.getBoundingClientRect().top, ok = (x, z) => { const q = project(x, heightAt(x, z), z); return q.ok && q.x > 30 && q.x < W - 30 && q.y > 60 && q.y < top - 30; };
    let found = false; for (let tz = 30; tz <= 130 && !found; tz += 3) for (let tx = -80; tx <= 20 && !found; tx += 3) { cam.target.x = tx; cam.target.z = tz; cam.target.y = heightAt(tx, tz); updateCamera(); camera.updateMatrixWorld(); if (ok(-45, 75.6) && ok(-45, 69) && ok(-32, 74.2) && ok(-36, 60)) found = true; } return found; })()`); // the lot and the road above the panel
  await g.wait(800);
  const scr = (x, z) => g.ev(`(() => { camera.updateMatrixWorld(); const q = project(${x}, heightAt(${x}, ${z}), ${z}); return [Math.round(q.x), Math.round(q.y)]; })()`);
  eq(await g.ev(`isCoarse`), true, 'a touch screen');
  // a tap a little off the road's centre starts a road there
  const [rx, ry] = await scr(-45, 75.6);
  await g.page.touchscreen.tap(rx, ry); await g.wait(200);
  eq(await g.ev(`[!!rdraft, rdraft && !rdraft.main && rdraft.pts.length, rdraft && mapRoadDist(rdraft.pts[0][0], rdraft.pts[0][1]) < 0.5]`), [true, 1, true], 'a tap on the access road starts a new road on it');
  // taps lay it out, ending on the lot's west end
  const P = await g.ev(`(() => { const P = parks()[1], d = parkAt(P, -0.4, parkD(P) / 2); return { x: d.x, z: d.z }; })()`);
  for (const [x, z] of [[-45, 69], [P.x - 4, P.z + 1], [P.x, P.z]]) { const [sx, sy] = await scr(x, z); await g.page.touchscreen.tap(sx, sy); await g.wait(150); }
  const d = await g.ev(`(() => { const i = rdraft.info || roadCheck(rdraft); return { pts: rdraft.pts.length, gate: !!rdraft.gate, problems: i.problems, btn: !!document.querySelector('#sheet [data-action=roadBuild]:not([disabled])') }; })()`);
  eq([d.pts, d.gate, d.problems, d.btn], [4, true, [], true], 'four taps: a road to the lot, ready to build');
  await g.ev(`document.querySelector('#sheet [data-action=roadBuild]').click()`); await g.wait(300);
  eq(await g.ev(`[proads().length, parkReached(1), !!state.mainRoad]`), [1, true, false], 'built, the lot reached, the access road untouched');
  // the access road's route only changes from its own button
  const [ax, ay] = await scr(-32, 74.2);
  await g.page.touchscreen.tap(ax, ay); await g.wait(200);
  eq(await g.ev(`!!(rdraft && rdraft.main)`), false, 'a tap on the access road never starts changing its route');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
