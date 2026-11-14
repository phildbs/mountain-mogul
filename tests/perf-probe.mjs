// Perf probe (not a scenario): a big resort mid-day, drawn, with draw calls and per-frame timings.
import { startServer, launch, openGame } from './harness.mjs';
import { bigBuild } from './big-resort.mjs';

const srv = await startServer(); const browser = await launch();
const g = await openGame(browser, srv.url, { render: true, width: 1280, height: 800 });
const t0 = Date.now();
console.log('build', JSON.stringify(await g.ev(bigBuild)), Date.now() - t0, 'ms');
console.log(await g.ev(`(() => { state.day = 41; openDay(); state.speed = 0; let n = 0; while (state.time < 660 && n++ < 90000) simStep(1.5);
  return { time: state.time, people: (typeof guests !== 'undefined' ? guests.length : -1) }; })()`));
// Wrap the per-frame helpers so each one's time is counted.
await g.ev(`(() => {
  window.__pt = {}; const names = ['updateSnow','updatePuffs','updateFireworks','updateDusk','updateNightLights','updateEveningGlow','syncRaceCourse','syncPond','updateSplash','updateChairs','updatePlumes','drawPeople','processHover','updateLabels','placeGuestTag','updateChips','updateLandMarks','updateLotMarks','updateRoadMarks','updateHandles','treeLod','refreshTimebar','simStep','updateCash','fitTopBar','syncShowSpeed'];
  for (const n of names) { const f = eval(n); eval(n + ' = function(...a){ const s = performance.now(); try { return f.apply(this, a); } finally { __pt[n] = (__pt[n]||0) + performance.now() - s; } }'); }
  const r = renderer.render.bind(renderer); const gl = renderer.getContext();
  renderer.render = (s, c) => { const t = performance.now(); r(s, c); gl.finish(); __pt.RENDER = (__pt.RENDER||0) + performance.now() - t; __pt.frames = (__pt.frames||0) + 1; };
})()`);
async function measure(label, setup, ms = 6000) {
  await g.ev(setup + '; for (const k in __pt) delete __pt[k]; renderer.info.autoReset = true;');
  await g.wait(ms);
  const r = await g.ev(`(() => { const i = renderer.info; let meshes = 0, vis = 0, inst = 0, instCount = 0, pts = 0; scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine) { meshes++; let v = true; for (let p = o; p; p = p.parent) if (!p.visible) { v = false; break; } if (v) vis++; if (o.isInstancedMesh) { inst++; instCount += o.count; } } });
    return { pt: __pt, calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures, programs: i.programs.length, meshes, visibleMeshes: vis, inst, instCount, dpr: renderer.getPixelRatio(), viewH: cam.viewH,
      labels: document.querySelectorAll('#labels > *').length, dom: document.getElementsByTagName('*').length }; })()`);
  const f = r.pt.frames || 1, per = {};
  for (const [k, v] of Object.entries(r.pt)) if (k !== 'frames' && v / f > 0.05) per[k] = +(v / f).toFixed(2);
  console.log(`\n== ${label}: ${f} frames in ${ms} ms`);
  console.log('ms/frame', JSON.stringify(Object.fromEntries(Object.entries(per).sort((a, b) => b[1] - a[1]))));
  delete r.pt; console.log(JSON.stringify(r));
}
await measure('paused, default view', 'state.speed = 0');
await measure('playing x1, default view', 'state.speed = 1');
await measure('playing x1, zoomed in', 'state.speed = 1; cam.viewH = 30; updateCamera()');
await measure('paused, zoomed in', 'state.speed = 0');
console.log('errors', g.errors.slice(0, 5));
await browser.close(); srv.close();
