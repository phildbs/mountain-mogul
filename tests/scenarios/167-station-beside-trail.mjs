// A lift whose stations sit beside trails, not at their ends, still links up: skiers leave the trail for its
// line, and riders getting off at the top drop onto the trail beside it (from player feedback, Nov 4).
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url); await g.click('#startBtn'); await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const fix = await g.ev(`(() => {
    state.cash = 1e8;
    const [E, W] = realTrails().sort((p, q) => q.samples[0].x - p.samples[0].x); // east and west runs from the starter lift
    const side = (T, z, off) => { const S = T.samples; let i = 0; for (let k = 0; k < S.length; k++) if (Math.abs(S[k].z - z) < Math.abs(S[i].z - z)) i = k;
      const a = S[Math.max(0, i - 2)], b = S[Math.min(S.length - 1, i + 2)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
      return { x: S[i].x - dz / l * off, z: S[i].z + dx / l * off }; };
    let X = null; const tried = [];
    for (const zb of [40, 36, 44, 32]) for (const zt of [14, 18, 10, 22]) for (const ob of [3, -3, 4, -4]) for (const ot of [3, -3, 4, -4]) {
      if (X) break;
      const a = side(W, zb, ob), b = side(E, zt, ot), i = evalLift(a, b, 'double');
      if (!i.problems.length && !i.fromBase) X = commitLift(i, 'double'); else tried.push(i.problems[0]);
    }
    if (!X) throw Error('no cross lift: ' + tried.slice(0, 5).join(' | '));
    computeNetwork(); syncLabels();
    const feed = X.feeders.find((t) => t.link === 'load'), dep = X.departing.find((t) => t.link === 'top');
    const sheet = liftSheet(X);
    window.fix = { X: X.id, E: E.id, W: W.id };
    return { plain: realTrails().every((t) => !t.link), feed: feed && feed.parent === W, dep: dep && dep.parent === E,
      reach: X.reachable && X.returns, named: sheet.includes('Reached by ' + W.name) && sheet.includes('From the top: ' + E.name),
      ends: distXZ(W.samples.at(-1), X.a) > STATION_R && distXZ(E.samples[0], X.b) > STATION_R };
  })()`);
  assert(Object.values(fix).every(Boolean), `stations beside trails link up: ${JSON.stringify(fix)}`);
  // A closed trail closes its links too.
  const closed = await g.ev(`(() => { const W = trailById(fix.W), l = liftById(fix.X).feeders.find((t) => t.link); W.open = false; const r = !runnable(l); W.open = true; return r && runnable(l); })()`);
  assert(closed, 'links follow their trail’s open state');
  // Run a day: skiers ride the cross lift, and runs are counted for real trails only.
  const day = await g.ev(`(() => { const r = Math.random; let s = 167; Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    try { openDay(); state.speed = 0; let n = 0, ridden = 0; while (state.phase === 'open' && n < 90000) { simStep(1.5); n++; ridden = Math.max(ridden, today.liftRiders[fix.X] || 0); }
      return { ridden, linkRuns: Object.keys(today.trailRuns || {}).filter((k) => +k < -9e8).length, phase: state.phase }; } finally { Math.random = r; } })()`);
  assert(day.ridden > 0, `guests ride the lift between the trails (${JSON.stringify(day)})`);
  eq(day.linkRuns, 0, 'links are never counted as runs');
  // Saves never hold links, and loading rebuilds them.
  const re = await g.ev(`(() => { const save = JSON.parse(JSON.stringify(saveData(false))); const inSave = save.world ? JSON.stringify(save.world.trails || []) : JSON.stringify(save);
    applySave(save); const X = liftById(fix.X);
    return { saved: !/"link"/.test(inSave), back: X.feeders.some((t) => t.link) && X.departing.some((t) => t.link) }; })()`);
  assert(re.saved && re.back, `links rebuild after loading (${JSON.stringify(re)})`);
  // Short of cash, the lift panel says so before you start a move.
  const poor = await g.ev(`(() => { state.phase = 'closed'; state.cash = 1000; return liftSheet(liftById(fix.X)).includes('Moving costs at least'); })()`);
  assert(poor, 'the lift panel says when a move costs more than you have');
  eq(g.errors, [], 'no page errors'); await g.page.close();
}
