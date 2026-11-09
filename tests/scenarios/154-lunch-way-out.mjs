// From player feedback (Aspen Heights): guests heading home around lunch time walked past an open lodge to their car,
// and the report blamed "nowhere to eat at the base". Now they grab a bite on the way out, and guests who set off
// before their lunch time aren't counted as leaving hungry. Also: a skier passing two restrooms on a trail skips
// a long line at the first for the same thing a little further on (it only compared places for lunch before).
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`(() => {
    let seed = 77; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    window.__out = 0; const f = lunchOnWayOut; lunchOnWayOut = (x) => { const r = f(x); if (r) __out++; return r; };
    state.reputation = 1.2; openDay(); state.speed = 0;
  })()`);
  eq(await g.ev(SETUPS.finishDay), 'report', 'the day finishes');
  const r = await g.ev(`({ out: __out, meals: state.lastReport.meals, hungry: state.lastReport.hungry, served: world.buildings[0].yday.services })`);
  const base = ((r.hungry && r.hungry.nowhere) || []).filter((x) => x.id === 'base').reduce((a, x) => a + x.n, 0);
  assert(r.out >= 5, `guests heading home grab lunch at the base lodge first (${r.out})`);
  assert(base <= 3, `few guests "found nowhere to eat" at a base with an open lodge (${base}, was about 18): ${JSON.stringify(r)}`);
  // Missed lunches across a few seeded days: one day swings a few either way (any change to how cars come in moves every
  // draw after it), so the average is what's checked. On main before 3.16, seeds 1 to 15 averaged 14.1; was 28 with the bug.
  const missed = [r.meals.missed];
  for (const seed of [11, 23, 42]) {
    const h = await openGame(browser, url); await h.click('#startBtn'); await h.wait(300);
    await h.ev(SETUPS.juniperStarter); await h.ev(SETUPS.midwinter);
    await h.ev(`(() => { let seed = ${seed}; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); state.reputation = 1.2; openDay(); state.speed = 0; })()`);
    await h.ev(SETUPS.finishDay); missed.push(await h.ev(`state.lastReport.meals.missed`)); await h.page.close();
  }
  const avg = missed.reduce((a, b) => a + b, 0) / missed.length;
  assert(avg <= 16, `missed lunches stay low (${missed.join(', ')}; average ${avg.toFixed(1)}, was 28)`);

  // Two restrooms beside the same trail, the first with a long line: a skier who needs one goes to the second.
  const g2 = await openGame(browser, url);
  await g2.click('#startBtn'); await g2.wait(300);
  await g2.ev(SETUPS.juniperStarter); await g2.ev(SETUPS.midwinter);
  const rr = await g2.ev(`(() => {
    state.cash = 1e7; const T = realTrails()[0], placed = [];
    for (const i of [Math.floor(T.samples.length * 0.45), Math.floor(T.samples.length * 0.55)]) {
      const p = T.samples[i], q = T.samples[i + 1], nx = -(q.z - p.z), nz = q.x - p.x, k = Math.hypot(nx, nz) || 1;
      let done = false;
      for (const off of [trailHW(T) + 2.2, -(trailHW(T) + 2.2), trailHW(T) + 3, -(trailHW(T) + 3)]) for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        if (done) break;
        const x = p.x + nx / k * off, z = p.z + nz / k * off, b = evalBuilding('restroom', x, z, r);
        if (b.problems.length) continue;
        placed.push(commitBuilding(b, 'restroom', x, z, r)); done = true;
      }
    }
    computeNetwork(); syncLabels();
    const stops = T.stops.filter((s) => s.B.type === 'restroom');
    if (stops.length < 2) return { stops: stops.length, placed: placed.length };
    openDay(); state.speed = 0; for (let n = 0; n < 400 && state.time < 640; n++) simStep(1.5);
    const [A, B] = stops, Ab = A.B, Bb = B.B;
    for (let i = 0; i < 40; i++) Ab.q.rr.push({ id: -1000 - i, qT: state.time, svc: 'rr', pat: 99 }); // a long line at the first
    Ab.used.rr = poolSlots(Ab, 'rr');
    const x = guests.find((y) => !y.leaving && y.st === 'ski') || guests.find((y) => !y.leaving && !y.gone);
    if (!x) return { stops: stops.length, guests: guests.length, sts: guests.map((y) => y.st).join() };
    x.queueAt = null;
    x.bl = 1.2; x.ate = true; x.warmed = true; x.fat = 0; x.restT = state.time; x.qh = 0.8;
    startSki(x, T, A.at * 0.5 - 0.3);
    for (let n = 0; n < 200 && x.st === 'ski' && x.T === T; n++) updateSki(x, 0.05);
    return { stops: stops.length, near: Math.round(distXZ(Ab.door, Bb.door)), went: x.bid === Bb.id ? 'second' : x.bid === Ab.id ? 'first' : String(x.bid), waitA: Math.round(estWait(Ab, 'rr')), waitB: Math.round(estWait(Bb, 'rr')) };
  })()`);
  eq(rr.stops, 2, 'two restrooms beside the trail: ' + JSON.stringify(rr));
  assert(rr.near <= 20, `they’re close together (${rr.near}): ${JSON.stringify(rr)}`);
  eq(rr.went, 'second', `the skier skips the long line for the restroom a little further on: ${JSON.stringify(rr)}`);
  eq(g.errors, [], 'no page errors'); eq(g2.errors, [], 'no page errors');
  await g.page.close(); await g2.page.close();
}
