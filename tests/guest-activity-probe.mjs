// Probe: on a big resort with guest areas, what are guests doing through a day (labels from guestActivity), and does anyone
// stay "Looking around"? Usage: GUESTS=2500 [SRC=other.html] [NOHUBS=1] node guest-activity-probe.mjs
import { readFileSync } from 'node:fs';
const T = new URL('./', import.meta.url).pathname;
const { startServer, launch, openGame } = await import(T + 'harness.mjs');
const { bigBuild } = await import(T + 'big-resort.mjs');
const src = readFileSync(T + 'hub-bench.mjs', 'utf8');
const paint = src.slice(src.indexOf('const paint = `') + 15, src.indexOf('})()`;', src.indexOf('const paint = `')) + 4);
const server = await startServer(process.env.SRC ? { source: readFileSync(process.env.SRC, 'utf8') } : {}), browser = await launch();
const g = await openGame(browser, server.url, { mountain: 'juniper' });
await g.click('#startBtn'); await g.wait(200);
console.log('build', JSON.stringify(await g.ev(bigBuild)));
if (!process.env.NOHUBS) console.log('hubs', JSON.stringify(await g.ev(paint)));
const r = await g.ev(`(() => {
  let seed = 7; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  demandForDay = () => ${+(process.env.GUESTS || 2500)}; state.cash = 1e9; state.day = 41; openDay(); state.speed = 0;
  const labs = {}, by = {}, since = new Map(), long = {}; let samples = 0, look = 0, all = 0, n = 0;
  while (state.phase === 'open' && n++ < 120000) {
    simStep(1.5);
    if (n % 20) continue;
    samples++;
    for (const q of guests) {
      if (q.gone || q.st === 'incar') continue; all++;
      const a = guestActivity(q);
      const lab = a.replace(/ to .*| across .*/, ''); labs[lab] = (labs[lab] || 0) + 1; if (a !== 'Looking around') { since.delete(q.id); continue; }
      look++;
      const k = q.st + ':' + (q.then ? q.then.k + (q.then.next ? '>' + q.then.next.k : '') : 'none');
      by[k] = (by[k] || 0) + 1;
      const s0 = since.get(q.id) ?? state.time; since.set(q.id, s0);
      if (state.time - s0 > 30) long[k] = (long[k] || 0) + 1;
    }
  }
  const R = state.lastReport; return { rep: { guests: R.guests, sat: R.sat ?? R.satisfaction, wait: R.avgWait, lifts: Object.values(today.liftRiders||{}).reduce((a,b)=>a+b,0) }, samples, avgGuests: Math.round(all / samples), lookShare: +(look / all * 100).toFixed(1), by: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 20), over30min: long, labels: Object.entries(labs).sort((a, b) => b[1] - a[1]).slice(0, 14) };
})()`);
console.log(JSON.stringify(r, null, 1));
console.log(g.errors.slice(0, 3));
await browser.close(); process.exit(0);
