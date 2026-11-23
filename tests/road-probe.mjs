// Review probe (not a scenario): how hard is it to build a road on a mountain? Straight roads from the end of the access
// road in every direction, what stops them, and how much of the property a road could reach at all by winding at
// ROAD_GRADE or less. Usage: node road-probe.mjs [mountain id], e.g. c:m0eu53g80c7dzf6 (Hawk Notch, Nov 23) or juniper.
import { startServer, launch, openGame } from './harness.mjs';
const mt = process.argv[2] || 'c:m0eu53g80c7dzf6';
const s = await startServer(), b = await launch();
const g = await openGame(b, s.url, { mountain: mt });
await g.click('#startBtn'); await g.wait(300);
const r = await g.ev(`(() => {
  const end = roadEnd(), lot = parks()[0], P = roadPath().filter((p) => inProperty(p.x, p.z) && (!lot || rectDist(p, parkRect(lot)) > 10));
  const e = P[Math.floor(P.length / 2)] || end, out = { mt: MOUNTAIN.id, name: MOUNTAIN.name, from: { x: +e.x.toFixed(1), z: +e.z.toFixed(1) }, grade: ROAD_GRADE, straight: {}, why: {} };
  // 1) straight roads, 16 directions, 15 and 30 units long, from partway along the access road
  for (const L of [15, 30]) { let ok = 0;
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, pts = [[e.x, e.z], [e.x + Math.cos(a) * L / 2, e.z + Math.sin(a) * L / 2], [e.x + Math.cos(a) * L, e.z + Math.sin(a) * L]];
      const info = roadCheck({ R: null, kind: 'road', pts }); if (!info.problems.length) ok++;
      for (const p of info.problems) { const w = p.replace(/\\d+/g, '#').replace(/^(.{0,60}).*/, '$1'); out.why[w] = (out.why[w] || 0) + 1; } }
    out.straight[L] = ok + ' of 16'; }
  // 2) what share of the property a road could reach from the access road, stepping 2 units at a time at ROAD_GRADE or less
  const st = 2, cells = new Map(), key = (i, j) => i + ',' + j; let total = 0, steepCells = 0;
  const H = (x, z) => heightAt(x, z);
  for (let x = -HALF + 1; x < HALF; x += st) for (let z = -HALF + 1; z < HALF; z += st) if (inProperty(x, z)) { total++; }
  const q = [[Math.round(e.x / st), Math.round(e.z / st)]], seen = new Set([key(...q[0])]);
  while (q.length) { const [i, j] = q.shift();
    for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1],[2,1],[1,2],[-2,1],[-1,2],[2,-1],[1,-2],[-2,-1],[-1,-2]]) {
      const a = i + di, c = j + dj, k = key(a, c); if (seen.has(k)) continue;
      const x0 = i * st, z0 = j * st, x1 = a * st, z1 = c * st; if (!inProperty(x1, z1)) continue;
      const d = Math.hypot(x1 - x0, z1 - z0), gr = Math.abs(H(x1, z1) - H(x0, z0)) / d; if (gr > ROAD_GRADE) continue;
      seen.add(k); q.push([a, c]); } }
  out.reachable = Math.round(seen.size / total * 100) + '% of the property (' + seen.size + ' of ' + total + ' spots)';
  // 3) how steep the land is: share of property spots steeper than the road limit straight up the slope
  let over = 0; for (let x = -HALF + 1; x < HALF; x += st) for (let z = -HALF + 1; z < HALF; z += st) if (inProperty(x, z)) { const gx = (H(x + 1, z) - H(x - 1, z)) / 2, gz = (H(x, z + 1) - H(x, z - 1)) / 2; if (Math.hypot(gx, gz) > ROAD_GRADE) over++; }
  out.steeperThanRoads = Math.round(over / total * 100) + '% of the property';
  return out;
})()`);
console.log(JSON.stringify(r, null, 1));
console.log('page errors', g.errors);
await b.close(); s.close();
