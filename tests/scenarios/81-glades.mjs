// Glades: painted over forest and thinned (Tight / Classic / Open). Skiers drop in from a lift top or a trail and
// run out at the bottom; the trees left make the rating harder and tree collisions likelier and more serious.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter);
  // paint beside the lift, top to bottom
  const info = await g.ev(`(() => { state.cash = 1e8; const L = world.lifts[0];
    state.gladeThin = 'classic'; openGladeTool(); clearAreaDraft(); state.brushR = 4;
    const dx = L.b.x - L.a.x, dz = L.b.z - L.a.z, len = Math.hypot(dx, dz), nx = -dz / len, nz = dx / len;
    for (let f = 0.98; f > 0.02; f -= 0.04) areaPaintAt({ x: L.a.x + dx * f + nx * 12, z: L.a.z + dz * f + nz * 12 });
    const i = areaDraftInfo(); return { problems: i.problems, lines: i.lines, rating: i.rating, thinned: i.treeSet.size, trees0: i.trees0 }; })()`);
  eq(info.problems, [], 'the glade can be cut');
  assert(info.lines > 0 && info.rating >= 2 && info.thinned > 0, `it has lines, a black-or-harder rating and trees to thin: ${JSON.stringify(info)}`);
  const A = await g.ev(`(() => { const before = gladeTreeCount([...areaDraft.cells]); commitArea(); const A = world.areas.find(isGlade);
    const lines = world.trails.filter((t) => t.glade === A.id);
    return { lvl: gladeLevel(A), keep: A.keepNow, left: gladeTreeCount(A.cells), before, lines: lines.map((t) => [t.reachable, t.returns, trailSign(t) >= t.an.rating]), real: realTrails().some((t) => t.glade) }; })()`);
  eq(A.lvl, 'classic', 'classic thinning leaves a classic glade');
  assert(A.left < A.before, 'trees were thinned, not cleared');
  assert(A.lines.length && A.lines.every((l) => l[0] && l[1] && l[2]), `every line is reachable, returns and rates at least its slope: ${JSON.stringify(A.lines)}`);
  eq(A.real, false, 'glade lines stay out of the trail list');
  // signs keep skiers who aren't good enough out; without them they may wander in
  eq(await g.ev(`(() => { const t = world.trails.find((o) => o.glade), gs = { ab: 1, pref: 1, seen: {}, explore: 0, learnLaps: 9 }; const A = world.areas.find(isGlade);
    const a = trailFit(t, gs); A.signs = false; const b = trailFit(t, gs); A.signs = true; return [a === -60, b > -60]; })()`), [true, true], 'signs turn intermediates away');
  // replanting inside makes it tighter (and harder)
  eq(await g.ev(`(() => { const A = world.areas.find(isGlade); state.cash = 1e8; for (const k of A.cells) replantAt({ x: keyX(k), z: keyZ(k) }); computeNetwork(); return gladeLevel(A); })()`), 'tight', 'replanting tightens the glade');
  // a day: skiers ski it; collisions are counted, can be serious, and show on the report
  await g.ev(SETUPS.midwinter);
  const d = await g.ev(`(() => { state.reputation = 1.2; openDay(); for (const t of world.trails) if (t.glade) { t.gladeRisk = 4000; t.gladeSevere = 1; }
    let n = 0; while (state.time < 840 && n < 190000) { simStep(1.5); n++; }
    const lines = world.trails.filter((t) => t.glade), runs = lines.reduce((m, t) => m + (today.trailRuns[t.id] || 0), 0), hit = Object.values(today.glades || {})[0];
    while (state.phase === 'open' && n < 190000) { simStep(1.5); n++; }
    return { runs, hit, phase: state.phase, report: state.lastReport.glades }; })()`);
  assert(d.runs > 0, `skiers ski the glade (${d.runs} runs by 2 PM)`);
  assert(d.hit && d.hit.n > 0 && d.hit.severe > 0, `tree collisions are counted, serious ones too: ${JSON.stringify(d.hit)}`);
  eq(d.phase, 'report', 'the day ends');
  assert(d.report && d.report.length === 1 && d.report[0].n > 0, 'the report lists the glade’s collisions');
  // closing it, and saving
  eq(await g.ev(`(() => { if (state.phase === 'report') nextDay(); const A = world.areas.find(isGlade); A.closed = true; computeNetwork(); const shut = world.trails.filter((t) => t.glade).every((t) => !t.open);
    const sv = JSON.parse(JSON.stringify(saveData(false))); applySave(sv); const B = world.areas.find(isGlade); return [shut, !!B && B.closed && B.signs && B.trees0 > 0 && world.trails.some((t) => t.glade)]; })()`), [true, true], 'closing shuts its lines, and it saves and loads');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
