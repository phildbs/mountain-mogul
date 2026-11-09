// The access road stays clear: buildings and lots graded beside it bank down to it instead of lifting or
// burying it, the drawn road is never under the ground, old saves with a buried road get it back, and the
// road ends at the main lot's entrance.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  for (const mountain of ['raven', 'ridgeback']) {
    const g = await openGame(browser, url, { mountain });
    await g.click('#startBtn'); await g.wait(300);
    await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 1e8; state.reputation = 1`);
    // How much of the road the ground covers: look straight down at points across it.
    await g.ev(`window.covered = () => { const rc = new THREE.Raycaster(), D = new THREE.Vector3(0, -1, 0); let n = 0, bad = 0;
      roadMesh.updateMatrixWorld(); terrainMesh.updateMatrixWorld();
      const P = roadPath(); for (let k = 2; k < P.length - 2; k += 1) { const a = P[k - 1], b = P[k + 1], L = Math.hypot(b.x - a.x, b.z - a.z) || 1, nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L;
        for (const f of [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9]) { const x = P[k].x + nx * f * ROAD_HW, z = P[k].z + nz * f * ROAD_HW;
          if (!inWorld(x, z) || Math.abs(x) > HALF - 3 || Math.abs(z) > HALF - 3) continue;
          rc.set(new THREE.Vector3(x, 500, z), D); const hit = rc.intersectObjects([terrainMesh, roadMesh])[0]; n++;
          if (hit && hit.object === terrainMesh) bad++; } }
      return { n, bad }; }`);
    eq((await g.ev(`covered()`)).bad, 0, `${mountain}: a fresh road is clear`);

    // Condos and lodges as close to the road as they're allowed, on both sides, all along it.
    const placed = await g.ev(`(() => { const out = []; const P = roadPath();
      for (let k = 12; k < P.length - 12 && out.length < 10; k += 5) {
        const p = P[k], a = P[k - 2], b = P[k + 2], L = Math.hypot(b.x - a.x, b.z - a.z), nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L;
        found: for (const side of [1, -1]) for (const off of [3, 3.4, 3.8, 4.4]) for (const [type, tier] of [['condo', 1], ['lodge', 0]]) {
          const x = Math.round(p.x + nx * side * off), z = Math.round(p.z + nz * side * off), r = Math.atan2(-nx * side, -nz * side);
          if (!inProperty(x, z)) continue;
          const v = evalBuilding(type, x, z, r, false, null, null, tier);
          if (!v.problems.length) { const B = commitBuilding(v, type, x, z, r); out.push({ id: B.id, pad: Math.abs(v.padY - heightAt(p.x, p.z) / VEX) }); break found; }
        }
      }
      computeNetwork(); return out; })()`);
    assert(placed.length >= 5, `${mountain}: buildings beside the road (${placed.length})`);
    if (mountain === 'raven') assert(placed.some((p) => p.pad > 0.4), `${mountain}: some pads well above or below the road (${placed.map((p) => p.pad.toFixed(1))})`);
    const after = await g.ev(`(() => { let moved = 0; for (let k = 0; k < NV * NV; k++) if (ROADD[k] < ROAD_HW + 0.3 && Math.abs(HT[k] - HT0[k]) > 1e-4) moved++; return { moved, ...covered() }; })()`);
    eq(after.moved, 0, `${mountain}: grading beside the road leaves the roadbed alone`);
    eq(after.bad, 0, `${mountain}: the ground never covers the road (${after.n} points)`);

    // A save from before: the road buried under a bank. Loading puts the roadbed back.
    const old = await g.ev(`(() => { for (let k = 0; k < NV * NV; k++) if (ROADD[k] < 2.5 && ROADD[k] > 0.5 && (k % 7) < 3) HT[k] += 1.5;
      const enc = encodeTerrain(); restoreTerrain(enc); buildRoad();
      let moved = 0; for (let k = 0; k < NV * NV; k++) if (ROADD[k] < ROAD_HW + 0.3 && Math.abs(HT[k] - HT0[k]) > 1e-4) moved++;
      return { moved, ...covered() }; })()`);
    eq(old.moved, 0, `${mountain}: an old save's buried road is dug back out`);
    eq(old.bad, 0, `${mountain}: and drawn on top`);

    // The main lot's entrance is where the road ends: cars come off the road into it and park.
    const drive = await g.ev(`(() => { const P = parks()[0], d = gateDoor(P, P.ents[0]), h = roadHit(d), k = stalls.findIndex((s) => s.lot === 0), p = carPath(stalls[k]);
      return { gap: h.d, reached: parkReached(0), ends: Math.hypot(p.at(-1).x - stalls[k].x, p.at(-1).z - stalls[k].z) < 0.01, end: Math.hypot(d.x - roadEnd().x, d.z - roadEnd().z) }; })()`);
    assert(drive.gap < 3.15 && drive.end < 4 && drive.reached && drive.ends, `${mountain}: the main lot is entered where the road ends (${JSON.stringify(drive)})`);
    eq(g.errors, [], `${mountain}: no errors`);
    await g.page.close();
  }

  // Lifts: a station or a tower can't stand on the road (with the road frontage bought).
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  const lift = await g.ev(`(() => { state.cash = 1e8; state.land = PARCELS.map((p) => ({ id: p.id })); applyLand();
    const P = roadPath(), K = P.findIndex((q, i) => i > 5 && inProperty(q.x, q.z) && inProperty(q.x, q.z - 12)), p = P[K];
    const top = { x: p.x * 0.5, z: p.z - 45 }, on = evalLift({ x: p.x, z: p.z }, top, 'double').problems, off = evalLift({ x: p.x * 0.97, z: p.z - 5 }, top, 'double').problems;
    return { on, off, render: roadMesh.renderOrder, transparent: ROAD_MAT.transparent }; })()`);
  assert(lift.on.some((m) => /access road/.test(m)), 'a station on the road is refused: ' + lift.on);
  assert(!lift.off.some((m) => /access road/.test(m)), 'just off it is fine: ' + lift.off);
  assert(lift.render > 2 && lift.transparent, 'the road is drawn after trails, so a trail crossing it never covers it');
  eq(g.errors, [], 'no errors');
}
