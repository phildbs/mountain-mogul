// Trail lights and lamp posts: one line per kind in the day report's Operations, with their upkeep added
// up, and no crew wages (only real buildings are staffed).
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const r = await g.ev(`(() => {
    state.cash = 5e6;
    const before = planRunCost(blankPlan());
    const lodge = world.buildings.find((B) => B.type === 'lodge'), made = { tlight: 0, lamp: 0 };
    for (let r = 4; r <= 30; r += 1.5) for (let a = 0; a < 24; a++) {
      const type = made.tlight < 4 ? 'tlight' : made.lamp < 2 ? 'lamp' : null; if (!type) break;
      const x = Math.round((lodge.door.x + Math.cos(a / 24 * 6.283) * r) * 2) / 2, z = Math.round((lodge.door.z + Math.sin(a / 24 * 6.283) * r) * 2) / 2;
      const v = evalBuilding(type, x, z, 0, false); if (!v.problems.length) { commitBuilding(v, type, x, z, 0); made[type]++; }
    }
    computeNetwork();
    const t0 = today; today = t0 || { liftRiders: {}, liftCost: {} }; // a report outside the day's run
    const html = opsReportHtml({ ops: opsReport(startOps(state.day), 0, 0) }); today = t0;
    return { made, extra: planRunCost(blankPlan()) - before, html };
  })()`);
  eq(r.made, { tlight: 4, lamp: 2 }, 'placed four trail lights and two lamp posts');
  eq(r.extra, 4 * 10 + 2 * 15, 'they add only their upkeep to the plan, no crew');
  eq((r.html.match(/Trail light/g) || []).length, 1, 'one Trail lights line');
  assert(/Trail lights <em>× 4<\/em><\/span><span>\$40 upkeep/.test(r.html), 'trail lights counted and added up: ' + r.html.match(/Trail lights[^]*?upkeep/));
  assert(/Lamp posts <em>× 2<\/em><\/span><span>\$30 upkeep/.test(r.html), 'lamp posts counted and added up');
  eq(g.errors, [], 'no page errors');
}
