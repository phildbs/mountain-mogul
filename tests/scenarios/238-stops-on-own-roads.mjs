// From Adum888's feedback: shuttle stations and transit centers can go beside a road of your own, not only the access
// road. Buses drive your roads to reach them, and the road can't be removed, moved away or made a driveway under them.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 2e7`);

  // A road of your own off the access road.
  const road = await g.ev(`(() => { openRoads('roads');
    rdraft = { R: null, kind: 'road', pts: [[-45, 76.8], [-45, 72], [-44, 66], [-42, 60], [-40, 54]] }; const info = roadCheck(rdraft);
    if (info.problems.length) return info.problems.join('|');
    commitRoad(); setTool('explore'); return { n: proads().length, in: !!proadIn(proads()[0]) }; })()`);
  eq(road, { n: 1, in: true }, 'a road of your own, joined to the access road');

  // A shuttle station beside it, snapped to it like one by the access road.
  const st = await g.ev(`(() => { const R = proads()[0], P = proadPath(R);
    for (let i = Math.floor(P.length * 0.3); i < P.length * 0.9; i += 3) for (const s of [1, -1]) {
      const a = P[i], b = P[i + 1] || P[i], L = distXZ(a, b) || 1, nx = -(b.z - a.z) / L * s, nz = (b.x - a.x) / L * s;
      const sn = snapToRoad('shuttle', { x: a.x + nx * 4, z: a.z + nz * 4 }), v = evalBuilding('shuttle', sn.x, sn.z, sn.rot);
      if (v.problems.length) continue;
      const B = commitBuilding(v, 'shuttle', sn.x, sn.z, sn.rot); computeNetwork();
      if (B.road !== R.id) return 'served the access road';
      const path = busPath(B), on = path.filter((q) => P.includes(q)).length;
      return { road: B.road === R.id, on: on > 5, ends: distXZ(path.at(-1), B.stop) < 0.01, approach: nearestRoad(B.approach, B).d < 1.5 };
    }
    return 'no spot'; })()`);
  eq(st, { road: true, on: true, ends: true, approach: true }, 'built beside your road, and buses drive along it to the bay');

  // Buses come to it on an open day.
  const bus = await g.ev(`(() => { openDay(); let n = 0, seen = false;
    while (state.phase === 'open' && n++ < 4000 && !seen) { simStep(1.5); seen = buses.some((b) => b.kind === 'town' && b.st !== 'in'); }
    return seen; })()`);
  eq(bus, true, 'a town bus reached the stop');
  await g.ev(SETUPS.finishDay);

  // The road under it is protected.
  const keep = await g.ev(`(() => { const R = proads()[0], c0 = proads().length; nextDay(); removeRoadNow(R);
    const removed = proads().length < c0;
    startRoadEdit(R); rdraft.kind = 'drive'; rdraft.info = null; const drive = roadCheck(rdraft).problems.some((m) => /driveway/.test(m)); clearRDraft();
    return { removed, drive }; })()`);
  eq(keep, { removed: false, drive: true }, 'can’t remove the road or make it a driveway under a station');

  // It keeps its road through a save and reload.
  await g.ev(`saveNow()`); await g.page.reload(); await g.reloaded();
  const back = await g.ev(`(() => { const B = world.buildings.find((b) => b.type === 'shuttle'), R = proads()[0]; return { road: B.road === R.id, near: nearestRoad(B.approach, B).d < 1.5, path: busPath(B).some((q) => proadPath(R).includes(q)) }; })()`);
  eq(back, { road: true, near: true, path: true }, 'after a reload it still serves your road');
  // A base shuttle between it and a stop on the access road drives a joined-up route both ways.
  const loop = await g.ev(`(() => { const A = world.buildings.find((b) => b.type === 'shuttle'), P = roadPath();
    for (let i = Math.floor(P.length * 0.5); i < P.length - 2; i += 4) for (const s of [1, -1]) {
      const a = P[i], c = P[i + 1], L = distXZ(a, c) || 1, sn = snapToRoad('shuttle', { x: a.x - (c.z - a.z) / L * 4 * s, z: a.z + (c.x - a.x) / L * 4 * s }), v = evalBuilding('shuttle', sn.x, sn.z, sn.rot);
      if (v.problems.length) continue;
      const B = commitBuilding(v, 'shuttle', sn.x, sn.z, sn.rot); if (B.road) return 'took your road';
      const gap = (Q) => Math.max(...Q.slice(1).map((q, k) => distXZ(q, Q[k])));
      const ab = loopPath(A, B), ba = loopPath(B, A);
      return { ends: distXZ(ab[0], A.stop) < 0.01 && distXZ(ab.at(-1), B.stop) < 0.01 && distXZ(ba.at(-1), A.stop) < 0.01, joined: gap(ab) < 8 && gap(ba) < 8 };
    }
    return 'no spot'; })()`);
  eq(loop, { ends: true, joined: true }, 'a base shuttle route from your road to the access road');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
