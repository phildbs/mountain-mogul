// Trail popularity at real scale: a 26-lift, 110-trail Juniper resort, ~5,000 guests.
// Compares a busy day on main and this branch (same seed), then times the whole-day traffic map and measures save size.
// Usage: BIG_SAVE=/path/save.json GUESTS=5000 node heat-bench.mjs (builds the resort if the save is missing). SHOTS=dir saves screenshots.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { startServer, launch, openGame } from './harness.mjs';
import { bigBuild } from './big-resort.mjs';
const SAVE = process.env.BIG_SAVE, GUESTS = +(process.env.GUESTS || 5000), SHOTS = process.env.SHOTS;
const main = execFileSync('git', ['show', 'origin/main:index.html'], { maxBuffer: 8e6, encoding: 'utf8' });
const servers = { main: await startServer({ source: main }), branch: await startServer() };
const browser = await launch();
const open = async (v, o = {}) => { const g = await openGame(browser, servers[v].url, { mountain: 'juniper', ...o }); await g.click('#startBtn'); await g.wait(200); return g; };
if (!existsSync(SAVE)) { const g = await open('main'); console.log('built', JSON.stringify(await g.ev(bigBuild))); writeFileSync(SAVE, JSON.stringify(await g.ev('saveData(false)'))); await g.page.close(); }
const save = readFileSync(SAVE, 'utf8');
const seed = (s) => `let seed=${s};Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);`;
const day = `(() => {
  demandForDay = () => ${GUESTS}; state.cash = 1e9; state.day = 41; openDay(); state.speed = 0;
  let n = 0; const t = performance.now();
  while (state.phase === 'open' && n++ < 120000) simStep(1.5);
  const r = state.lastReport;
  return { ms: Math.round(performance.now() - t), guests: r.guests, sat: r.sat, injuries: r.injuries, profit: r.profit, popular: r.popular && r.popular.name };
})()`;
for (const v of (process.env.RUNS || 'main,branch').split(',')) {
  const g = await open(v, SHOTS && v === 'branch' ? { render: true } : {});
  await g.ev(`applySave(${save});afterLoad()`);
  await g.ev(seed(7));
  const r = await g.ev(day);
  let extra = {};
  if (v === 'branch') extra = await g.ev(`(() => {
    const d = state.lastReport.trailsDay, use = JSON.stringify(state.dayUse).length, rep = JSON.stringify(d).length;
    nextDay(); const t0 = performance.now(); setTraffic('day'); const paint = performance.now() - t0;
    const t1 = performance.now(); openManage('trails'); listView.trails.sort = 'popular'; renderSheet(); const list = performance.now() - t1;
    return { trails: realTrails().length, top: d.top.map((x) => x.name + ' ' + x.n), quietN: d.quietN, dayUseBytes: use, reportBytes: rep, paintMs: +paint.toFixed(1), listMs: +list.toFixed(1), saveBytes: JSON.stringify(saveData(false)).length };
  })()`);
  console.log(v.padEnd(7), JSON.stringify({ ...r, ...extra }), g.errors.length ? 'ERRORS ' + g.errors.slice(0, 3).join(' | ') : '');
  if (SHOTS && v === 'branch') {
    mkdirSync(SHOTS, { recursive: true });
    await g.ev(`(() => { selected = null; renderSheet(); recenter(); })()`); await g.wait(2500);
    await g.page.screenshot({ path: `${SHOTS}/heat-desktop.png` });
    await g.ev(`openManage('trails')`); await g.wait(500); await g.page.screenshot({ path: `${SHOTS}/list-desktop.png` });
    await g.ev(`showReport(state.lastReport, true); document.querySelector('#rpBody [data-rptab=trails]').click()`); await g.wait(400);
    await g.page.screenshot({ path: `${SHOTS}/report-desktop.png` });
    await g.page.setViewportSize({ width: 390, height: 844 }); await g.wait(600);
    await g.page.screenshot({ path: `${SHOTS}/report-phone.png` });
    await g.ev(`$('report').hidden = true; rpPast = false; openManage('trails')`); await g.wait(600); await g.page.screenshot({ path: `${SHOTS}/list-phone.png` });
    await g.ev(`selected = null; renderSheet(); recenter()`); await g.wait(2500); await g.page.screenshot({ path: `${SHOTS}/heat-phone.png` });
  }
  await g.page.close();
}
await browser.close(); process.exit(0);
