// Names fit what's built: trails by rating (and sometimes where they run or the mountain's flavour),
// lifts by where they go, shops from big pools, all picked at random without repeats. The dice suggests another.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter);
  const bad = await g.ev(`(() => { const t = realTrails()[0], out = [];
    for (let r = 0; r < 4; r++) {
      const ok = new Set([...TRAIL_NAMES[r], ...Object.values(TRAIL_PLACE).flatMap((p) => p[r]), ...TRAIL_LOCAL.juniper[r]]);
      for (let k = 0; k < 40; k++) { const n = trailNameFor(t.samples, r, 'medium'); if (!ok.has(n)) out.push(r + ':' + n); }
    }
    return out; })()`);
  eq(bad, [], 'every trail name comes from its rating’s pools');
  const greens = await g.ev(`(() => { const t = realTrails()[0]; const s = new Set(); for (let k = 0; k < 40; k++) s.add(trailNameFor(t.samples, 0, 'medium')); return s.size; })()`);
  assert(greens > 10, `green names vary (${greens} different in 40 picks)`);
  eq(await g.ev(`(() => { const t = realTrails()[0]; let n = 0; for (let k = 0; k < 60; k++) if (realTrails().some((o) => o.name === trailNameFor(t.samples, 1, 'medium'))) n++; return n; })()`), 0, 'never a name already used');
  const lifts = await g.ev(`(() => { const L = world.lifts[0]; return { carpet: liftNameFor('carpet', L.a, L.b), quad: liftNameFor('quad', L.a, L.b) }; })()`);
  assert(await g.ev(`CARPET_NAMES.includes(${JSON.stringify(lifts.carpet)})`), `a carpet gets a carpet name (${lifts.carpet})`);
  assert(/ Quad$/.test(lifts.quad), `a quad is named as one (${lifts.quad})`);
  const cafe = await g.ev(`nextBuildingName('cafe', 0, 0)`);
  assert(await g.ev(`OTHER_NAMES.cafe.includes(${JSON.stringify(cafe)})`), `cafés come from the café pool (${cafe})`);
  eq(await g.ev(`nextBuildingName('parking', 0, 0)`), 'Lot B', 'satellite lots stay lettered');
  // the dice on a trail's panel
  await g.ev(`(() => { const t = realTrails()[0]; select({ kind: 'trail', obj: t }); })()`); await g.wait(100);
  const before = await g.ev(`realTrails()[0].name`);
  await g.click('[data-action=rerollName]'); await g.wait(100);
  const after = await g.ev(`realTrails()[0].name`);
  assert(after && after !== before, `the dice gives a new name (${before} → ${after})`);
  eq(await g.ev(`$('nameInput').value`), after, 'and the panel shows it');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
