// Review probe (not a scenario): auto-routed roads (routeDraft) to spots spread over the property: how many pass
// roadCheck, what stops the rest, and how long a route takes. Usage: node route-probe.mjs [mountain id]
import { startServer, launch, openGame } from './harness.mjs';
const mt = process.argv[2] || 'juniper', low = process.argv[3] === 'low'; // low: only spots on low ground, where lots go
const s = await startServer(), b = await launch();
const g = await openGame(b, s.url, { mountain: mt });
await g.click('#startBtn'); await g.wait(300);
console.log(JSON.stringify(await g.ev(`(() => {
  const out = { mt: MOUNTAIN.id + (${low} ? ' low' : ''), tried: 0, ok: 0, none: 0, why: {}, ms: [], steep: [] }; let seed = 5; const R = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  while (out.tried < 40) { const p = { x: (R() - 0.5) * WN * 0.9, z: (R() - 0.5) * WN * 0.9 }; if (!inProperty(p.x, p.z) || areaAt(p.x, p.z) || (${low} && trueY(p.x, p.z) > MOUNTAIN.baseH + 8)) continue; out.tried++;
    rdraft = null; const t = performance.now(), r = routeDraft(p); out.ms.push(Math.round(performance.now() - t));
    if (!r.d) { out.none++; continue; }
    const pr = r.d.info.problems; if (!pr.length) { out.ok++; out.steep.push(Math.round(r.d.info.steep * 100)); } for (const w of pr) { const k = w.replace(/\\d+/g, '#').slice(0, 60); out.why[k] = (out.why[k] || 0) + 1; } }
  out.ms = 'median ' + out.ms.sort((a, b) => a - b)[20] + ' ms, max ' + out.ms[39] + ' ms'; out.steep = 'steepest ' + Math.max(...out.steep) + '%';
  return out; })()`)));
console.log('page errors', g.errors);
await b.close(); s.close();
