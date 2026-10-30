// A large Juniper resort built with the game's own checks: about 26 lifts and 110 trails, like big public resorts.
export const bigBuild = `(() => {
  let seed = 12345; const R = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  state.cash = 1e10; const out = { liftFail: 0, trailFail: 0 };
  const types = ['quad', 'hsq', 'six', 'double', 'triple'].filter((t) => LIFT_TYPES[t]);
  // Base lifts first, then lifts from mid-mountain.
  for (let n = 0; world.lifts.length < 26 && n < 4000; n++) {
    const base = world.lifts.length < 8;
    const a = base ? { x: -70 + R() * 140, z: 40 + R() * 25 } : { x: -70 + R() * 140, z: -25 + R() * 55 };
    const ang = -Math.PI / 2 + (R() - 0.5) * 0.9, len = 50 + R() * 90;
    const b = { x: a.x + Math.cos(ang) * len, z: a.z + Math.sin(ang) * len };
    if (Math.abs(b.x) > 78 || Math.abs(b.z) > 78 || trueY(b.x, b.z) < trueY(a.x, a.z) + 8) continue;
    if (!base && !world.lifts.some((L) => distXZ(L.b, a) < 70 && trueY(L.b.x, L.b.z) > trueY(a.x, a.z) + 4)) continue;
    const type = types[Math.floor(R() * types.length)], i = evalLift(a, b, type);
    if (i.problems.length) { out.liftFail++; continue; }
    commitLift(i, type); computeNetwork();
  }
  // Trails from each lift top to a lower lift bottom or the base, with some wiggle.
  for (let n = 0; realTrails().length < 110 && n < 6000; n++) {
    const L = world.lifts[Math.floor(R() * world.lifts.length)], top = trueY(L.b.x, L.b.z);
    const goals = world.lifts.filter((M) => trueY(M.a.x, M.a.z) < top - 8).map((M) => ({ x: M.a.x + (R() - 0.5) * 3, z: M.a.z + 2 }));
    goals.push({ x: L.a.x + (R() - 0.5) * 20, z: 66 + R() * 6 });
    const g = goals[Math.floor(R() * goals.length)], s = { x: L.b.x + (R() - 0.5) * 4, z: L.b.z + 3 };
    const k = 3 + Math.floor(R() * 3), pts = [s], side = (R() - 0.5) * 50;
    for (let j = 1; j < k; j++) { const f = j / k; pts.push({ x: s.x + (g.x - s.x) * f + side * Math.sin(f * Math.PI) + (R() - 0.5) * 8, z: s.z + (g.z - s.z) * f }); }
    pts.push(g);
    const width = ['narrow', 'medium', 'wide'][Math.floor(R() * 3)], i = evalTrail(pts, width, false, false);
    if (i.an.problems.length) { out.trailFail++; continue; }
    commitTrail(i, pts, width); computeNetwork();
  }
  // Buildings near lift bottoms so guests have services.
  const bt = ['lodge', 'cafe', 'restaurant', 'rental', 'patrol', 'truck', 'store', 'school', 'kids', 'clinic'];
  for (let n = 0, placed = 0; placed < 30 && n < 3000; n++) {
    const L = world.lifts[Math.floor(R() * world.lifts.length)], type = bt[placed % bt.length];
    const x = L.a.x + (R() - 0.5) * 30, z = L.a.z + (R() - 0.5) * 30;
    const i = evalBuilding(type, x, z, 0); if (!i || i.problems?.length) continue;
    commitBuilding(i, type, x, z, 0); placed++;
  }
  computeNetwork(); syncLabels();
  for (let k = 0; k < NV * NV; k++) NS[k] = 60; state.day = 40; refreshSnowState(todayWx());
  const t = realTrails();
  return { ...out, lifts: world.lifts.length, trails: t.length, buildings: world.buildings.length, returning: t.filter((x) => x.reachable && x.returns).length, fromBase: world.lifts.filter((L) => L.fromBase).length, reachableLifts: world.lifts.filter((L) => L.reachable).length };
})()`;
