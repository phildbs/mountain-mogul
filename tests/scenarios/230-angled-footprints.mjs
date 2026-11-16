// From player feedback (astemix, Mont-Dauphin): a building turned to an in-between angle took up the whole square around
// it, so angled buildings couldn't stand close together. Now its true turned outline is checked: the square's empty
// corners stay free. Quarter turns keep their plain boxes, exactly as before.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 1e8`);
  // Geometry alone: two lodges at 45°, side by side along their own width with a small gap.
  const geo = await g.ev(`(() => {
    const s = BTYPES.lodge.tiers[0], A = { type: 'lodge', tier: 0, x: 0, z: 0, rot: 0.5 }, p = toWorld(A, s.w + 0.6, 0), B = { ...A, x: p.x, z: p.z };
    const q = toWorld(A, s.w * 0.8, 0), C = { ...A, x: q.x, z: q.z }, a = boxOf(A, 0.4), b = boxOf(B), c = boxOf(C);
    const square = (u, v) => u.x0 < v.x1 && u.x1 > v.x0 && u.z0 < v.z1 && u.z1 > v.z0;
    const inside = (bb, P) => [-1, 1].every((i) => [-1, 1].every((j) => { const k = toWorld(P, i * s.w / 2, j * s.d / 2); return boxDist(k, bb) < 1e-9; }));
    return { squaresTouch: square(a, b), gapOk: !boxOverlap(a, b), overlapCaught: boxOverlap(a, c), cornersInside: inside(boxOf(A), A),
      enclosed: [0, 1].every((i) => [0, 1].every((j) => { const [x, z] = boxAt(a, i, j); return x >= a.x0 - 1e-9 && x <= a.x1 + 1e-9 && z >= a.z0 - 1e-9 && z <= a.z1 + 1e-9; })),
      cornerFree: boxDist({ x: boxOf(A).x0 + 0.2, z: boxOf(A).z0 + 0.2 }, boxOf(A)) > 0.5,
      quarter: ['r' in boxOf({ ...A, rot: 1 }), 'r' in boxOf({ ...A, rot: 0 })] };
  })()`);
  eq(geo, { squaresTouch: true, gapOk: true, overlapCaught: true, cornersInside: true, enclosed: true, cornerFree: true, quarter: [false, false] },
    'angled footprints follow the turned outline; quarter turns are plain boxes');

  // In the game: build a 45° lodge, then a second one close beside it, where the old squares would have clashed.
  const r = await g.ev(`(() => {
    const s = BTYPES.lodge.tiers[0];
    for (let z = 40; z < 90; z++) for (let x = -40; x < 40; x++) {
      const v = evalBuilding('lodge', x, z, 0.5); if (v.problems.length) continue;
      const A = { type: 'lodge', tier: 0, x, z, rot: 0.5 }, p = toWorld(A, s.w + 0.6, 0);
      const w = evalBuilding('lodge', p.x, p.z, 0.5); if (w.problems.length) continue;
      const n = world.buildings.length; commitBuilding(v, 'lodge', x, z, 0.5);
      const first = world.buildings.at(-1), again = evalBuilding('lodge', p.x, p.z, 0.5), q = toWorld(first, s.w * 0.8, 0);
      const close = evalBuilding('lodge', q.x, q.z, 0.5);
      return { built: world.buildings.length === n + 1, again: again.problems, close: close.problems.some((m) => m.includes('Too close')),
        squares: boxOverlap({ ...boxOf(first, 0.4), r: undefined }, { ...again.bb, r: undefined }) };
    }
    return null;
  })()`);
  assert(r, 'found a spot for two angled lodges');
  eq(r, { built: true, again: [], close: true, squares: true }, "a second angled lodge fits in the first one's empty corner; an overlapping one is still refused");

  // The ground patch shown while placing follows the turned outline too.
  const foot = await g.ev(`(() => { pickBuilding('picnic'); setDraftDegrees(45); draftTap({ x: 0, z: 60 }); recomputeDraft();
    if (!footMesh || !draft.bpos) return null;
    const P = footMesh.geometry.attributes.position, b = { type: 'picnic', tier: 0, x: draft.bpos.x, z: draft.bpos.z, rot: draft.rot }, bb = boxOf(b, 0.15);
    let worst = 0; for (let i = 0; i < P.count; i++) worst = Math.max(worst, boxDist({ x: P.getX(i), z: P.getZ(i) }, bb));
    return worst < 1e-4; })()`);
  eq(foot, true, 'placing preview patch lies on the turned outline');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
