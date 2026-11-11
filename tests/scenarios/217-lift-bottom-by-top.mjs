// A trail that ends beside both the bottom of one lift and the top of another ends at that top: skiers pick
// between its runs and the line. It used to count only as feeding the line, so the first run from a new upper
// lift, skied back to its own bottom, was refused as leading nowhere (player report, Nov 11).
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter);
  const r = await g.ev(`(() => { state.cash = 1e9;
    const L1 = world.lifts[0];
    let U = null;
    for (const [dx, dz] of [[4, -1], [-4, -1], [4.5, 1], [-4.5, 1], [3, -3], [-3, -3]]) for (const [tx, tz] of [[0, -30], [8, -30], [-8, -30], [0, -22], [10, -24], [-10, -24], [0, -40]]) {
      if (U) break;
      const i = evalLift({ x: L1.b.x + dx, z: L1.b.z + dz }, { x: L1.b.x + tx, z: L1.b.z + tz }, 'double');
      if (!i.problems.length && !i.fromBase) { commitLift(i, 'double'); computeNetwork(); U = world.lifts[world.lifts.length - 1]; }
    }
    if (!U) return null;
    const end = { x: (U.a.x + L1.b.x) / 2, z: (U.a.z + L1.b.z) / 2 };
    let got = null;
    for (const sx of [1, -1]) for (const w of [5, 9, 13]) {
      if (got) break;
      const pts = [{ x: U.b.x + 3 * sx, z: U.b.z + 2 }, { x: (U.a.x + U.b.x) / 2 + w * sx, z: (U.a.z + U.b.z) / 2 }, end];
      const t = evalTrail(pts, 'medium', false, true);
      if (!t.an.problems.length) { got = commitTrail(t, pts, 'medium'); computeNetwork(); } else got = got || null, (window.__why = t.an.problems);
    }
    if (!got) return { why: window.__why, gap: distXZ(U.a, L1.b), near: [distXZ(end, U.a), distXZ(end, L1.b)] };
    return { to: got.to.kind, at: got.to.obj.name, lower: L1.name, upper: U.name, returns: [got.returns, U.returns], says: describeConn(got.to, 'end'),
      reach: U.reachable, from: U.transferFrom.map((M) => M.name) }; })()`);
  assert(r, 'an upper lift was built beside the top of the first');
  assert(!r.why, `the first run from the upper lift may end back at its bottom (${JSON.stringify(r)})`);
  eq([r.to, r.at, r.returns], ['top', r.lower, [true, true]], 'it ends at the lower lift’s top, and it and the upper lift lead home');
  eq([r.reach, r.from], [true, [r.lower]], 'the upper lift is still reached from the lower lift’s top');
  await g.ev(SETUPS.midwinter);
  const d = await g.ev(`(() => { openDay(); let n = 0; while (state.phase === 'open' && n < 190000) { simStep(1.5); n++; }
    const U = world.lifts[world.lifts.length - 1];
    return { phase: state.phase, stranded: state.lastReport.complaints.stranded, rides: U.today ? U.today.riders : null, runs: Object.values(today.trailRuns).length }; })()`);
  eq([d.phase, d.stranded], ['report', 0], `nobody hikes out and the day ends (${JSON.stringify(d)})`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
