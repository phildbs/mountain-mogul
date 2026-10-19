// A trail with an uphill stretch can be built by grading the ground under it, for extra cost.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter);
  // draw a trail that dips and climbs on its way down
  await g.ev(`(() => { setTool('trail'); const L = world.lifts[0];
    draft.pts = [[L.b.x + 3, L.b.z + 2], [20, 34], [18, 24], [22, 58]].map(([x, z]) => ({ x, z })); draft.dirty = true; recomputeDraft(); })()`);
  const before = await g.ev(`({ problems: draft.info.an.problems, cost: draft.info.cost, text: $('sheet').innerText })`);
  assert(before.problems.some((p) => /uphill/.test(p)), 'the trail runs uphill');
  assert(/Grade it downhill/.test(before.text), 'the panel offers grading');
  eq(await g.ev(`$('sheet').querySelector('[data-action=build]').disabled`), true, 'it can’t be built as is');

  await g.click('[data-action=gradeTrail]'); await g.wait(100);
  await g.ev(`recomputeDraft()`);
  const after = await g.ev(`({ problems: draft.info.an.problems, cost: draft.info.cost, earth: draft.info.earth.cost, text: $('sheet').innerText })`);
  eq(after.problems, [], 'graded, it has no problems');
  assert(after.earth > 0 && after.cost === before.cost + after.earth, `grading adds its cost (${after.earth})`);
  assert(/Earthwork/.test(after.text), 'the cost is itemised');

  const cash0 = await g.ev(`state.cash`), h0 = await g.ev(`Array.from(HT).reduce((a, b) => a + b, 0)`);
  await g.click('[data-action=build]'); await g.wait(200);
  const built = await g.ev(`(() => { const t = world.trails[world.trails.length - 1]; return { n: world.trails.length, problems: t.an.problems, cash: state.cash }; })()`);
  eq(built.n, 3, 'the trail was built');
  eq(built.problems.filter((p) => /uphill/.test(p)), [], 'and it really runs downhill now');
  assert(Math.abs(cash0 - built.cash - after.cost) < 1, 'it cost what the panel said');
  assert(Math.abs((await g.ev(`Array.from(HT).reduce((a, b) => a + b, 0)`)) - h0) > 0.5, 'the ground was reshaped');
  // the reshaped ground is saved
  await g.ev(`saveNow()`); await g.page.reload(); await g.reloaded();
  eq(await g.ev(`world.trails[world.trails.length - 1].an.problems.filter((p) => /uphill/.test(p)).length`), 0, 'still downhill after a reload');
  // a switchback that doubles back over itself can't be graded, and the panel says so
  await g.ev(`(() => { setTool('trail'); const L = world.lifts[0]; draft.grade = true;
    draft.pts = [[L.b.x + 3, L.b.z + 2], [24, 30], [26, 18], [22, 58]].map(([x, z]) => ({ x, z })); draft.dirty = true; recomputeDraft(); })()`);
  assert((await g.ev(`draft.info.an.problems.join()`)).includes('Even graded'), 'an ungradeable hairpin is explained');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
