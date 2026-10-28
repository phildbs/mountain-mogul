// Two bases on Twin Notch: guests park by the lifts that suit them, cross between the bases by village
// gondola or base shuttle, and go home to the base where they parked. Lodge sizes are separate choices.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
import { build } from '../twin-resort.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { mountain: 'twin' });
  await g.click('#startBtn'); await g.wait(300);
  // lodges: three sizes, each its own price, none upgradable
  eq(await g.ev(`[0, 1, 2].map((t) => sizeCost('lodge', t) > (t ? sizeCost('lodge', t - 1) : 0))`), [true, true, true], 'bigger lodges cost more');
  await g.ev(build);
  const setup = await g.ev(`(() => { state.welcomed = true; select(null); state.lotLayout = [[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 0, 1], [0, 1, 1], [0, 2, 1]]; state.lotSections = 6; buildLot(); state.reputation = 1.2;
    const put = (type, u0, v0, tier) => { for (let dz = 0; dz < 14; dz += 2) for (let dx = -12; dx <= 12; dx += 2) { const x = 160 * u0 - 80 + dx, z = 80 - 160 * v0 - dz, v = evalBuilding(type, x, z, 0, false, null, null, tier); if (!v.problems.length) { commitBuilding(v, type, x, z, 0); computeNetwork(); return world.buildings[world.buildings.length - 1]; } } return null; };
    const A = put('lodge', 0.7, 0.16, 2), B = put('lodge', 0.3, 0.16, 0);
    return { tiers: [A && A.tier, B && B.tier], zones: [baseOf(world.lifts[0].a), baseOf(world.lifts[1].a)], link: crossCost(0, 1) }; })()`);
  eq(setup.tiers, [2, 0], 'a large lodge and a small one, built at their size');
  eq([setup.zones, setup.link], [[0, 1], null], 'a lift at each base, and no way across yet'); // Infinity serialises as null
  // a level village gondola between the bases
  const v = await g.ev(`(() => { const W = (u, v) => ({ x: 160 * u - 80, z: 80 - 160 * v });
    for (const dz of [2, 4, -6, -8, 0]) { const A = W(0.62, 0.14), B = W(0.34, 0.14); A.z += dz; B.z += dz; const i = evalLift(A, B, 'village'); if (!i.problems.length) { commitLift(i, 'village'); computeNetwork(); break; } }
    const L = world.lifts.find(isVillage); if (!L) return null; const s = L.lay.sup.filter((p) => !p.term), t = L.lay.sup.filter((p) => p.term);
    const line = (x) => t[0].y + (t[1].y - t[0].y) * x; return { straight: s.every((p) => Math.abs(p.y - line(p.s)) < 0.6), link: crossCost(0, 1) < Infinity, notQuad: evalLift(W(0.62, 0.3), W(0.62, 0.6), 'village').problems.length > 0 }; })()`);
  assert(v, 'the village gondola was built');
  eq([v.straight, v.link, v.notQuad], [true, true, true], 'it runs straight between the bases, links them, and can’t be built up the mountain');
  await g.ev(SETUPS.midwinter);
  await g.ev(`(() => { openDay(); let n = 0; while (state.time < 780 && n < 99999) { simStep(1.5); n++; } })()`);
  const mid = await g.ev(`({ crossings: today.crossings || 0, lots: [0, 1].map((k) => (today.lotCars || {})[k] || 0) })`);
  assert(mid.crossings > 0 && mid.lots.every((n) => n > 0), `guests park at both lots and cross: ${JSON.stringify(mid)}`);
  // saved mid-crossing and loaded back: nobody gets lost
  eq(await g.ev(`(() => { const n = guests.length; restoreSim(JSON.parse(JSON.stringify(serializeSim()))); return guests.length === n; })()`), true, 'a day saved while guests cross loads back');
  eq(await g.ev(SETUPS.finishDay), 'report', 'the day ends');
  const r = await g.ev(`state.lastReport.bases`);
  assert(r && r.crossings > 0 && r.stranded === 0 && r.gondola, `the report counts crossings: ${JSON.stringify(r)}`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
