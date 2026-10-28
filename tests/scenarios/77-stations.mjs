// Shuttle stations and transit centers are separate buildings now, both in the build menu: each snaps
// to the access road, facing it, at a spot where it fits without blocking the road.
// (Player report that led here: stations wouldn't upgrade to transit centers because of the road.)
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(`(() => { setTool('bld'); draft.btype = null; renderSheet(); })()`); await g.wait(50);
  eq(await g.ev(`['shuttle', 'transit'].map((k) => !!document.querySelector('#sheet [data-action=pickB][data-v=' + k + ']'))`), [true, true], 'both in the build menu');
  const r = await g.ev(`(() => { state.cash = 1e8; const out = [];
    for (const type of ['shuttle', 'transit']) for (let i = 0; i < 30 && out.filter((x) => x.type === type).length < 3; i++) {
      const sn = snapToRoad(type, { x: LAND.i0 - HALF + 8 + i * 9 + (type === 'transit' ? 4 : 0), z: LAND.j1 - HALF - 6 }), v = evalBuilding(type, sn.x, sn.z, sn.rot, false);
      if (v.problems.length) continue;
      const B = commitBuilding(v, type, sn.x, sn.z, sn.rot); computeNetwork();
      const front = { x: B.x + Math.sin(B.rot * Math.PI / 2) * BAY_FRONT[type], z: B.z + Math.cos(B.rot * Math.PI / 2) * BAY_FRONT[type] };
      out.push({ type, road: footprintStats(boxOf(B)).road, near: nearestRoad(front).d <= ROAD_HW + 3.5, cost: B.spent >= BTYPES[type].cost });
    } return out; })()`);
  eq([r.filter((x) => x.type === 'shuttle').length, r.filter((x) => x.type === 'transit').length], [3, 3], 'stations and transit centers both place beside the road');
  assert(r.every((x) => !x.road && x.near && x.cost), `clear of the road, beside it, at full price: ${JSON.stringify(r)}`);
  eq(await g.ev(`(() => { const B = world.buildings.find((b) => b.type === 'shuttle'); select({ kind: 'bld', obj: B }); return /Upgrade/.test($('sheet').innerText); })()`), false, 'no upgrade on a station');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
