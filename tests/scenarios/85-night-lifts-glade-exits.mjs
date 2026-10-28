// After closing, an upper lift that isn't serving night skiing stops instead of turning empty all night; and a glade
// whose fall line wanders off the paint still finds the trail its bottom runs onto.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 2e7`);
  // a glade beside the first trail, slanting across the slope: the fall line leaves the paint before the bottom
  const gl = await g.ev(`(() => { openGladeTool(); state.gladeThin = 'classic'; clearAreaDraft(); state.brushR = 4;
    for (let s = 0; s < 6; s++) areaPaintAt({ x: -4 + s * 1.5, z: -12 + s * 4 });
    const i = areaDraftInfo(); const out = { problems: i.problems, lines: i.lines }; clearAreaDraft(); return out; })()`);
  eq(gl.problems, [], 'the glade can be cut');
  assert(gl.lines > 0, `it has ski lines: ${JSON.stringify(gl)}`);
  // an upper lift, and night skiing on the base lift's trail
  const r = await g.ev(`(() => { const i = evalLift({ x: 22, z: -8 }, { x: 25, z: -38 }, 'double'); if (i.problems.length) return i.problems.join('|');
    commitLift(i, 'double'); const M = world.lifts[1];
    const pts = [[M.b.x + 3, M.b.z + 2], [M.b.x + 8, (M.b.z + 15) / 2], [23, 16]].map(([x, z]) => ({ x, z, y: heightAt(x, z) }));
    const t = evalTrail(pts, 'medium', false, true); if (t.an.problems.length) return t.an.problems.join('|');
    commitTrail(t, pts, 'medium'); computeNetwork();
    const lit = realTrails().find((o) => world.lifts[0].departing.includes(o)); lit.lit = true; rebuildLights(); computeNetwork();
    for (const k of ['weekday', 'weekend', 'quiet']) opsState().plans[k].night = 1200;
    return { lit: lit.lit, upperLit: liftLit(M), baseLit: liftLit(world.lifts[0]) }; })()`);
  eq(r, { lit: true, upperLit: false, baseLit: true }, 'the base lift serves a lit trail, the upper lift doesn’t');
  const d = await g.ev(`(() => { state.day = 40; openDay(); const [L, M] = world.lifts; let n = 0;
    while (state.time < 600 && n < 90000) { simStep(1.5); n++; }
    const day0 = M.phase; for (let k = 0; k < 40; k++) simStep(1.5); const dayMoved = M.phase !== day0;
    while (state.time < closeTime() + 45 && n < 90000) { simStep(1.5); n++; }
    let idle = 0, idleMoved = 0, base0 = L.phase;
    while (state.time < closeTime() + 150 && state.phase === 'open' && n < 90000) {
      const ph = M.phase, empty = !M.riders.some((x) => x.length) && !M.queue.length && !M.incoming;
      simStep(1.5); n++;
      if (empty && !M.riders.some((x) => x.length) && !M.queue.length) { idle++; if (M.phase !== ph) idleMoved++; }
    }
    return { dayMoved, night: nightNow(), idle, idleMoved, baseMoved: L.phase !== base0 }; })()`);
  assert(d.dayMoved, 'the upper lift runs in the day');
  assert(d.night && d.idle > 50, `night skiing is on and the upper lift sat idle: ${JSON.stringify(d)}`);
  eq(d.idleMoved, 0, 'the idle upper lift stands still at night');
  assert(d.baseMoved, 'the lit base lift keeps running for night skiers');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
