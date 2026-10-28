// A trail may end at the top of a lower lift: skiers carry on down that lift's runs. Two runs ending at the
// same lift top used to lead into each other and both showed as dead ends (player report, Oct 28).
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter);
  const r = await g.ev(`(() => { state.cash = 1e9;
    const L1 = world.lifts[0], mid = (f, dx) => ({ x: L1.a.x + (L1.b.x - L1.a.x) * f + dx, z: L1.a.z + (L1.b.z - L1.a.z) * f });
    let M = null;
    for (const dx of [14, -14, 18, -18, 22, -22]) { const i = evalLift(mid(0.02, dx), mid(0.55, dx), 'double'); if (!i.problems.length) { commitLift(i, 'double'); computeNetwork(); M = world.lifts[world.lifts.length - 1]; break; } }
    if (!M) return null;
    const put = (name, pts) => { const t = commitTrail(evalTrail(pts, 'medium', false, false), pts, 'medium'); t.name = name; computeNetwork(); return t; };
    const sx = Math.sign(M.a.x - L1.a.x), top = { x: L1.b.x + 2, z: L1.b.z + 3 };
    put('Lower run', [{ x: M.b.x + 3 * sx, z: M.b.z + 2 }, { x: M.b.x + 5 * sx, z: (M.b.z + M.a.z) / 2 }, { x: M.a.x + 4 * sx, z: M.a.z - 2 }]);
    const A = put('Feeder A', [top, { x: (top.x + M.b.x) / 2, z: (top.z + M.b.z) / 2 }, { x: M.b.x - 1, z: M.b.z - 1.2 }]);
    const B = put('Feeder B', [{ x: top.x - 3, z: top.z + 1 }, { x: (top.x + M.b.x) / 2 - 3, z: (top.z + M.b.z) / 2 + 1 }, { x: M.b.x + 0.5, z: M.b.z - 1.6 }]);
    return { ends: [A, B].map((t) => t.to && t.to.kind), returns: [A.returns, B.returns], says: describeConn(A.to, 'end'), lift: M.name }; })()`);
  assert(r, 'a second lift was built');
  eq([r.ends, r.returns], [['top', 'top'], [true, true]], 'both runs end at the lower lift’s top and lead back to the base');
  eq(r.says, `Ends at the top of ${r.lift}, joining its runs.`, 'the trail panel says where it ends');
  // guests ski down a feeder and on down the lower lift's runs
  await g.ev(SETUPS.midwinter);
  const d = await g.ev(`(() => { openDay(); let n = 0; while (state.time < 900 && n < 90000) { simStep(1.5); n++; }
    const runs = (name) => today.trailRuns[realTrails().find((t) => t.name === name).id] || 0;
    const out = { feeders: runs('Feeder A') + runs('Feeder B'), lower: runs('Lower run') };
    while (state.phase === 'open' && n < 190000) { simStep(1.5); n++; }
    return { ...out, phase: state.phase, stranded: state.lastReport.complaints.stranded }; })()`);
  assert(d.feeders > 0 && d.lower > 0, `guests ski the feeders and the run below (${JSON.stringify(d)})`);
  eq([d.phase, d.stranded], ['report', 0], 'nobody hikes out and the day ends');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
