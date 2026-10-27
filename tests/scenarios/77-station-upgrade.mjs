// Upgrading a shuttle station to a transit center: stations sit as close to the road as they can,
// and the deeper transit center steps back to fit instead of "blocking the access road".
// (Player report: had to build three more stations because none would upgrade.)
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  const r = await g.ev(`(() => { state.cash = 1e8; const out = [];
    for (let i = 0; i < 30 && out.length < 5; i++) {
      const sn = snapToRoad('shuttle', { x: LAND.i0 - HALF + 8 + i * 9, z: LAND.j1 - HALF - 6 }), v = evalBuilding('shuttle', sn.x, sn.z, sn.rot, false);
      if (v.problems.length) continue;
      const B = commitBuilding(v, 'shuttle', sn.x, sn.z, sn.rot); computeNetwork();
      const at = { x: B.x, z: B.z }, cash = state.cash;
      upgradeStation(B);
      const front = { x: B.x + Math.sin(B.rot * Math.PI / 2) * BAY_FRONT.transit, z: B.z + Math.cos(B.rot * Math.PI / 2) * BAY_FRONT.transit };
      out.push({ type: B.type, moved: Math.hypot(B.x - at.x, B.z - at.z), road: footprintStats(boxOf(B)).road, near: nearestRoad(front).d <= ROAD_HW + 3.5, paid: cash - state.cash });
    } return out; })()`);
  assert(r.length >= 4, `placed stations the way a player would: ${r.length}`);
  eq(r.map((x) => x.type), r.map(() => 'transit'), 'every one upgrades');
  assert(r.every((x) => x.moved <= 2 && !x.road && x.near), `stepped back a little, clear of the road and still beside it: ${JSON.stringify(r)}`);
  const [diff, tree] = await g.ev(`[BTYPES.transit.cost - BTYPES.shuttle.cost, TREE_COST]`);
  assert(r.every((x) => x.paid >= diff && (x.paid - diff) % tree === 0), `for the difference in price, plus any trees: ${r.map((x) => x.paid)}`);
  // saved where it now stands, and undo puts the station back
  eq(await g.ev(`(() => { const B = world.buildings.filter((b) => b.type === 'transit').pop(); const sv = saveData(false).world.buildings.find((b) => b.id === B.id); return [sv.type, sv.x === B.x && sv.z === B.z]; })()`), ['transit', true], 'saved');
  eq(await g.ev(`(() => { undoLast(); return world.buildings.filter((b) => b.type === 'shuttle').length; })()`), 1, 'undo turns the last one back into a station');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
