// From RowdyBreaker (Nov 7). 1) An upper lift with a lit trail off its top ran all evening even when night skiers had no
// lit way up to it: now a lift runs at night only if lit trails and night lifts lead to it from the base, and its lit
// trail leads home. 2) Tapping a gladed run in the Trails list opens it (glades had no middle to fly to, so the tap did
// nothing), with the ‹ Trails button back to the list.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 2e7`);
  const r = await g.ev(`(() => { const i = evalLift({ x: 22, z: -8 }, { x: 25, z: -38 }, 'double'); if (i.problems.length) return i.problems.join('|');
    commitLift(i, 'double'); const [L, M] = world.lifts;
    const pts = [[M.b.x + 3, M.b.z + 2], [M.b.x + 8, (M.b.z + 15) / 2], [23, 16]].map(([x, z]) => ({ x, z, y: heightAt(x, z) }));
    const t = evalTrail(pts, 'medium', false, true); if (t.an.problems.length) return t.an.problems.join('|');
    commitTrail(t, pts, 'medium'); computeNetwork();
    const up = realTrails().at(-1); up.lit = true; rebuildLights(); computeNetwork(); nightSetKey = '';
    const alone = [liftLit(L), liftLit(M)];
    for (const o of L.departing) o.lit = true; rebuildLights(); computeNetwork(); nightSetKey = '';
    const both = [liftLit(L), liftLit(M)];
    return { alone, both, reachNight: flowSets(litTrail).liftR.has(M) }; })()`);
  assert(typeof r === 'object', `set up (${r})`);
  eq(r.alone, [false, false], 'only the upper lift’s trail is lit: no lit way up, so neither lift runs at night');
  eq(r.both[0], true, 'with the base lift’s trails lit too, the base lift runs at night');
  eq([r.both[1], r.reachNight], [true, true], 'and the upper lift, which a lit base trail leads to, runs too');
  // the ‹ Trails button from a gladed run
  const back = await g.ev(`(() => { openGladeTool(); state.gladeThin = 'classic'; clearAreaDraft(); state.brushR = 4;
    for (let s = 0; s < 6; s++) areaPaintAt({ x: -4 + s * 1.5, z: -12 + s * 4 });
    commitArea(); setTool('explore'); computeNetwork();
    select({ kind: 'manage', obj: 'trails' }); renderSheet();
    const row = document.querySelector('#sheet [data-action=goTo][data-k=glade]'); if (!row) return 'no glade in the list'; const rk = row.dataset.k, rid = +row.dataset.id; row.click(); if (!(selected && selected.kind === 'area')) return ['not opened', rk, rid];
    const b = document.querySelector('#sheet .link.back'); if (!b) return 'no back button';
    b.click(); return [b.textContent.trim(), selected && selected.kind, selected && selected.obj]; })()`);
  eq(back, ['‹ Trails', 'manage', 'trails'], 'a gladed run opened from the Trails list goes back to it');
  // Adum888 (Nov 7): canLoad asks liftLit for every guest at a lift, and big night-skiing resorts crawled while each ask
  // checked every trail and the lift network was worked out again each game minute. Now it's worked out only on a change.
  const work = await g.ev(`(() => { for (const k of Object.keys(state.ops.plans)) state.ops.plans[k].night = 1260;
    state.day = 41; openDay(); state.speed = 0; let n = 0; while (state.time < 1000 && n++ < 90000) simStep(1.5);
    const was = flowSets; let calls = 0; flowSets = (...a) => { calls++; return was(...a); };
    try { for (let s = 0; s < 400; s++) simStep(1.5); const quiet = calls; realTrails()[0].lit = !realTrails()[0].lit; simStep(1.5);
      return { night: nightNow(), quiet, afterToggle: calls - quiet }; } finally { flowSets = was; } })()`);
  eq(work.night, true, 'night skiing is on');
  eq(work.quiet, 0, 'ten game minutes of night skiing with nothing changed: the night lifts are not worked out again');
  assert(work.afterToggle >= 1, `switching a trail's lights works them out again (${work.afterToggle})`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
