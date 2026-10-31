// Trail shaping at real scale: a 26-lift, 110-trail Juniper resort, ~5,000 guests.
// Usage: BIG_SAVE=/path/save.json GUESTS=5000 node shape-bench.mjs (builds the resort if the save is missing).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { startServer, launch, openGame } from './harness.mjs';
import { bigBuild } from './big-resort.mjs';
const SAVE = process.env.BIG_SAVE, GUESTS = +(process.env.GUESTS || 5000);
const main = execFileSync('git', ['show', 'origin/main:index.html'], { maxBuffer: 8e6, encoding: 'utf8' });
const servers = { main: await startServer({ source: main }), branch: await startServer() };
const browser = await launch();
const open = async (v) => { const g = await openGame(browser, servers[v].url, { mountain: 'juniper' }); await g.click('#startBtn'); await g.wait(200); return g; };
if (!existsSync(SAVE)) { const g = await open('main'); console.log('built', JSON.stringify(await g.ev(bigBuild))); writeFileSync(SAVE, JSON.stringify(await g.ev('saveData(false)'))); await g.page.close(); }
const save = readFileSync(SAVE, 'utf8');
const seed = (s) => `let seed=${s};Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);`;
// Every third trail: wide in the middle, narrow at the ends (applied overnight, like a player would).
const shape = `(() => {
  state.cash = 1e10; const ts = realTrails(), times = [], drafts = []; let done = 0, blocked = 0, spent = 0;
  for (let i = 0; i < ts.length; i += 3) {
    const t = ts[i]; startShape(t);
    draft.ws = draft.ws.map((v, k, a) => k === 0 || k === a.length - 1 ? 1.6 : 5);
    const a = performance.now(); const info = evalShape(t, draft.ws); times.push(performance.now() - a);
    const b = performance.now(); recomputeShapeDraft(); drafts.push(performance.now() - b);
    if (info.problems.length) { blocked++; cancelShape(); continue; }
    applyShape(t, draft.ws, info); spent += info.cost; done++; cancelShape();
  }
  computeNetwork(); syncLabels(); times.sort((a, b) => a - b); drafts.sort((a, b) => a - b);
  return { trails: ts.length, shaped: done, blocked, spent, evalMedianMs: +times[times.length >> 1].toFixed(1), evalWorstMs: +times.at(-1).toFixed(1), dragFrameMedianMs: +drafts[drafts.length >> 1].toFixed(1), dragFrameWorstMs: +drafts.at(-1).toFixed(1),
    groomPerNight: realTrails().reduce((a, t) => a + groomCost(t), 0) };
})()`;
const day = `(() => {
  demandForDay = () => ${GUESTS}; state.cash = 1e9; state.day = 41; openDay(); state.speed = 0;
  const steps = []; let n = 0; const t = performance.now();
  while (state.phase === 'open' && n++ < 120000) { const a = performance.now(); simStep(1.5); steps.push(performance.now() - a); }
  const ms = performance.now() - t; steps.sort((a, b) => a - b); const r = state.lastReport;
  return { ms: Math.round(ms), p50: +steps[steps.length >> 1].toFixed(2), p95: +steps[Math.floor(steps.length * .95)].toFixed(2), guests: r.guests, sat: Math.round(r.sat ?? r.satisfaction ?? 0), injuries: r.injuries ?? (r.injured || null), rev: Math.round((r.rev && Object.values(r.rev).reduce((a, b) => a + (+b || 0), 0)) || 0) };
})()`;
for (const v of (process.env.RUNS || 'main,branch,shaped').split(',')) {
  const g = await open(v === 'shaped' ? 'branch' : v);
  await g.ev(`applySave(${save})`);
  const groom = await g.ev(`realTrails().reduce((a, t) => a + Math.round(t.an.len * GROOM_PER_UNIT * (typeof widthFactor === 'function' ? widthFactor(t) : 1)), 0)`);
  const pre = v === 'shaped' ? await g.ev(shape) : { groomPerNight: groom };
  await g.ev(seed(7));
  const r = await g.ev(day);
  console.log(v.padEnd(7), JSON.stringify({ ...pre, ...r }), g.errors.length ? 'ERRORS ' + g.errors.slice(0, 3).join(' | ') : '');
  await g.page.close();
}
await browser.close(); process.exit(0);
