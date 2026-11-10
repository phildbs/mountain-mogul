// One-off: how a full day runs at a guest cap. The cap is read from index.html, so run it after editing MAX_G.
// node cap-bench.mjs
import { startServer, launch, openGame } from './harness.mjs';
import { bigBuild } from './big-resort.mjs';
const server = await startServer(), browser = await launch();
const g = await openGame(browser, server.url, { query: '?dev' });
await g.click('#startBtn'); await g.wait(400);
await g.ev(bigBuild); await g.ev(`(() => { for (let k = 0; k < NV*NV; k++) NS[k] = 60; state.day = 60; refreshSnowState(todayWx()); })()`);
// room for every car: the lot's spaces copied over and over (cars overlap; fine for timing)
await g.ev(`(() => { const s0 = stalls.slice(); while (stalls.length < MAX_CARS) stalls.push({ ...s0[stalls.length % s0.length], car: null }); })()`);
const r = await g.ev(`(() => { const real = demandForDay; demandForDay = () => { real(); dayWant = MAX_G * AGENT * 3; return MAX_G * AGENT; }; openDay(); demandForDay = real;
  let n = 0, peak = 0, slow = 0, saveKb = 0; const t0 = performance.now();
  while (state.phase === 'open' && n++ < 200000) { const a = performance.now(); simStep(1.5); const d = performance.now() - a; slow = Math.max(slow, d);
    const on = guests.filter((x) => x.st !== 'incar' && !x.gone).length; if (on > peak) { peak = on; if (state.time > 720 && !saveKb) saveKb = Math.round(JSON.stringify(saveData(true)).length / 1024); } }
  const ms = performance.now() - t0, rr = state.lastReport;
  return { cap: MAX_G, guests: rr.guests, turnedAway: rr.turnedAway, peakOnMountain: peak, steps: n, secs: Math.round(ms / 100) / 10, msPerStep: Math.round(ms / n * 100) / 100, worstStepMs: Math.round(slow), saveKb }; })()`);
console.log(JSON.stringify(r), g.errors);
await browser.close(); server.close();
