// Drawing less: zoomed out, trees use the simple shape; zoomed in, the full one. A computer whose graphics can't keep
// up draws fewer pixels (2x, 1.5x, 1x, remembered for next time), then is offered Low graphics once. A slow day's
// simulation (lots of work each frame) never turns the picture down.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter);

  // trees: the simple shape zoomed out, the full one close up, about a fifth of the drawing
  const lod = await g.ev(`(() => { const tri = (geo) => geo.attributes.position.count / 3, m = treeMesh.userData.lod;
    camTween = null; cam.viewH = 190; cam.viewGoal = null; treeLod(); const out = treeMesh.geometry === m.far;
    cam.viewH = 40; treeLod(); return { out, in: treeMesh.geometry === m.near, near: tri(m.near), far: tri(m.far), haze: m.far.attributes.ihaze === m.near.attributes.ihaze }; })()`);
  assert(lod.out && lod.in, 'simple trees zoomed out, full trees close up');
  assert(lod.far * 4 < lod.near, `the simple tree is a fraction of the drawing (${lod.far} vs ${lod.near} triangles)`);
  assert(lod.haze, 'both shapes share the trees’ haze');

  // slow drawing: frames at 20 a second with little work each
  const feed = (iv, wk, n) => g.ev(`(() => { for (let i = 0; i < ${n}; i++) perfWatch(${iv}, ${wk}); return renderer.getPixelRatio(); })()`);
  await g.ev(`(() => { setDpr(2); perf.since = 0; perf.iv.length = perf.work.length = 0; perf.tipped = false; localStorage.removeItem('mm.dpr'); localStorage.removeItem('mm.gfxTip'); })()`);
  eq(await feed(50, 30, 400), 2, 'slow frames full of the game’s own work (a busy day) leave the picture alone');
  eq(await feed(16, 2, 400), 2, 'smooth frames leave it alone');
  eq(await feed(1500, 2, 400), 2, 'pauses (switched away and back) don’t count');
  await g.ev(`perf.since = 0; perf.iv.length = perf.work.length = 0`); // as just after loading
  eq(await feed(50, 3, 100), 2, 'not in the first seconds after loading, nor on a handful of frames');
  eq(await feed(50, 3, 60), 1.5, 'slow drawing: down to 1.5x');
  eq(await g.ev(`[localStorage.getItem('mm.dpr'), PR_U.value]`), ['1.5', 1.5], 'remembered for next time, and the snowflakes follow');
  eq(await feed(50, 3, 150), 1, 'still slow: the screen’s own pixels');
  eq(await g.ev(`$('toast').hidden`), true, 'no tip yet');
  await feed(50, 3, 150);
  eq(await g.ev(`[!$('toast').hidden, /Low graphics/.test($('toast').innerText), localStorage.getItem('mm.gfxTip')]`), [true, true, '1'], 'still slow: Low graphics is offered');
  await g.ev(`$('toast').hidden = true; perf.tipped = false`);
  await feed(50, 3, 150);
  eq(await g.ev(`$('toast').hidden`), true, 'only once');

  // a reload starts at the remembered sharpness
  await g.ev(`saveNow()`); await g.page.reload(); await g.reloaded();
  eq(await g.ev(`renderer.getPixelRatio()`), 1, 'the next visit starts at what worked');
}
