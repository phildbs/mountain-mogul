// One-off: on each mountain, how often a walk between two random base spots goes round a hill, how much longer it
// is, and what working it out costs. node base-walk-probe.mjs
import { startServer, launch, openGame } from './harness.mjs';
const server = await startServer(), browser = await launch();
for (const mt of ['juniper', 'maple', 'raven', 'twin', 'ridgeback']) {
  const g = await openGame(browser, server.url, { mountain: mt });
  await g.click('#startBtn'); await g.wait(300);
  const r = await g.ev(`(() => {
    let seed = 7; const R = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const t0 = performance.now(), M = baseMask(), tMask = performance.now() - t0, cells = [];
    for (let k = 0; k < NV * NV; k++) if (M.m[k]) cells.push(k);
    const at = (k) => ({ x: k % NV - HALF, z: Math.floor(k / NV) - HALF });
    let n = 0, round = 0, ratio = 0, worst = 1, tWay = 0, floods = 0;
    for (let i = 0; i < 400; i++) {
      const a = at(cells[Math.floor(R() * cells.length)]), b = at(cells[Math.floor(R() * cells.length)]);
      if (distXZ(a, b) < 6) continue; n++;
      const f0 = M.floods.size, t = performance.now(), w = baseWay(a, b); tWay += performance.now() - t; if (M.floods.size > f0) floods++;
      if (!w) continue; round++;
      let len = 0, p = a; for (const [x, z] of w) { len += Math.hypot(x - p.x, z - p.z); p = { x, z }; }
      ratio += len / distXZ(a, b); worst = Math.max(worst, len / distXZ(a, b));
    }
    return { mt: MOUNTAIN.id, baseCells: cells.length, tMaskMs: Math.round(tMask), walks: n, round, avgRatio: round ? +(ratio / round).toFixed(2) : 0, worst: +worst.toFixed(2), msPerWalk: +(tWay / n).toFixed(2), msPerFlood: floods ? +(tWay / floods).toFixed(1) : 0 };
  })()`);
  console.log(JSON.stringify(r));
  await g.page.close();
}
await browser.close(); server.close();
