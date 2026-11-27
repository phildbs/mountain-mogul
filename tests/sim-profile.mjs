// One-off: where a busy day's simulation spends its time. The big resort at the guest cap, run to late morning,
// then a CPU profile of simStep. node sim-profile.mjs [steps]
import { startServer, launch, openGame } from './harness.mjs';
import { bigBuild } from './big-resort.mjs';
const steps = +(process.argv[2] || 2000);
const server = await startServer(), browser = await launch();
const g = await openGame(browser, server.url, { query: '?dev' });
await g.click('#startBtn'); await g.wait(400);
await g.ev(bigBuild); await g.ev(`(() => { for (let k = 0; k < NV*NV; k++) NS[k] = 60; state.day = 60; refreshSnowState(todayWx()); })()`);
await g.ev(`(() => { const s0 = stalls.slice(); while (stalls.length < MAX_CARS) stalls.push({ ...s0[stalls.length % s0.length], car: null }); })()`);
await g.ev(`(() => { const real = demandForDay; demandForDay = () => { real(); dayWant = MAX_G * AGENT * 3; return MAX_G * AGENT; }; openDay(); demandForDay = real; state.speed = 0;
  let n = 0; while (state.phase === 'open' && state.time < 11.5 * 60 && n++ < 200000) simStep(1.5); })()`);
const cdp = await g.page.context().newCDPSession(g.page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
const t = await g.ev(`(() => { const t0 = performance.now(); for (let i = 0; i < ${steps}; i++) simStep(1.5); return { ms: performance.now() - t0, on: guests.filter((x) => x.st !== 'incar' && !x.gone).length, time: state.time }; })()`);
const { profile } = await cdp.send('Profiler.stop');
const self = new Map(), byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas; let total = 0;
profile.samples.forEach((id, i) => { const n = byId.get(id), k = `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + dt[i]); total += dt[i]; });
// inclusive: walk up parents
const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const incl = new Map();
profile.samples.forEach((id, i) => { const seen = new Set(); for (let x = id; x != null; x = parent.get(x)) { const n = byId.get(x), k = `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber + 1}`; if (seen.has(k)) continue; seen.add(k); incl.set(k, (incl.get(k) || 0) + dt[i]); } });
console.log(JSON.stringify({ steps, msPerStep: +(t.ms / steps).toFixed(2), onMountain: t.on, time: t.time }));
const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${(v / total * 100).toFixed(1).padStart(5)}%  ${k}`).join('\n');
console.log('--- self\n' + top(self, 30)); console.log('--- inclusive\n' + top(incl, 40));
await browser.close(); server.close();
