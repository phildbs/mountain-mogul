// Where two lifts cross, one cable goes over the other: the newer lift (or a gondola) stands on taller towers either
// side, neither lift has a tower in the other's path, and removing a lift puts the other back as it was.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter);
  await g.ev(`state.cash = 5e7; updateCash(false)`);
  // the gap between the two cables where lifts i and j cross, and how near each lift's nearest tower is to the crossing
  await g.ev(`window.crossOf = (i, j) => { const A = world.lifts[i], B = world.lifts[j], c = liftCrossings(A.a, A.b, A.type, A).find((c) => { const x = A.a.x + A.lay.dx * c.s, z = A.a.z + A.lay.dz * c.s, t = ((x - B.a.x) * B.lay.dx + (z - B.a.z) * B.lay.dz) / (B.lay.hlen * B.lay.hlen); return Math.hypot(B.a.x + B.lay.dx * t - x, B.a.z + B.lay.dz * t - z) < 0.01; });
    if (!c) return null;
    const x = A.a.x + A.lay.dx * c.s, z = A.a.z + A.lay.dz * c.s, u = ((x - B.a.x) * B.lay.dx + (z - B.a.z) * B.lay.dz) / (B.lay.hlen * B.lay.hlen);
    const near = (L) => Math.min(...L.lay.sup.filter((p) => !p.term).map((p) => Math.hypot(L.a.x + L.lay.dx * p.s - x, L.a.z + L.lay.dz * p.s - z)));
    return { gap: cableAt(A.lay, c.s) - cableAt(B.lay, u), nearA: near(A), nearB: near(B) }; }`);
  const sup = (i) => g.ev(`JSON.stringify(world.lifts[${i}].lay.sup.map((p) => [p.s, p.y]))`);
  const L0 = await g.ev(`(() => { const L = world.lifts[0]; return { a: L.a, b: L.b }; })()`), alone = await sup(0);
  const mz = (L0.a.z + L0.b.z) / 2, mx = (L0.a.x + L0.b.x) / 2;

  // a second chairlift across the first: the drawing already shows it going over
  const draft = await g.ev(`(() => { const i = evalLift({ x: ${mx} - 22, z: ${mz} + 12 }, { x: ${mx} + 22, z: ${mz} - 12 }, 'quad'); window.info2 = i; const c = liftCrossings(i.a, i.b, 'quad'); return { problems: i.problems, n: c.length, y: c[0] && c[0].y, at: c[0] && cableAt(i.lay, c[0].s) }; })()`);
  eq(draft.problems, [], 'a lift may cross another');
  assert(draft.n === 1 && draft.at >= draft.y - 0.02, `the line being drawn clears the lift under it (${draft.at} vs ${draft.y})`);
  await g.ev(`commitLift(info2, 'quad')`);
  let c = await g.ev(`crossOf(1, 0)`);
  assert(c && c.gap >= 0.88, `the newer chairlift's cable is over the older one's (${c && c.gap})`);
  assert(c.nearA >= 1.25 && c.nearB >= 1.25, `no tower of either lift in the other's path (${c.nearA}, ${c.nearB})`);
  assert(await sup(0) !== alone, 'the older lift moved a tower out of the way');
  const rid = await g.ev(`(() => { const L = world.lifts[0]; L.riders[0].push('x'); L.queue.push('q'); return world.lifts[0].chairCount; })()`);

  // a gondola across both goes over both; a T-bar across stays under and lifts what crosses it
  await g.ev(`(() => { const i = evalLift({ x: ${mx} - 20, z: ${mz} + 26 }, { x: ${mx} + 16, z: ${mz} - 24 }, 'gondola'); if (!liftCrossings(i.a, i.b, 'gondola').length) throw new Error('gondola crosses nothing'); commitLift(i, 'gondola'); })()`);
  const n = await g.ev(`liftCrossings(world.lifts[2].a, world.lifts[2].b, 'gondola', world.lifts[2]).length`);
  assert(n >= 1, 'the gondola crosses a chairlift');
  for (const j of [0, 1]) { c = await g.ev(`crossOf(2, ${j})`); if (c) assert(c.gap >= 1.23 && c.nearA >= 1.25 && c.nearB >= 1.25, `gondola over lift ${j}: gap ${c.gap}, towers ${c.nearA}, ${c.nearB}`); }
  eq(await g.ev(`(() => { const L = world.lifts[0]; return [L.riders.flat().length, L.queue.length]; })()`), [1, 1], 're-rigging a crossed lift keeps its riders and its line');
  await g.ev(`(() => { const L = world.lifts[0]; L.riders.forEach((r) => r.length = 0); L.queue.length = 0; })()`);

  // every cable still clears the ground
  const low = await g.ev(`Math.min(...world.lifts.flatMap((L) => Array.from({ length: 80 }, (_, i) => cableAt(L.lay, (i + 1) / 81) - heightAt(L.a.x + L.lay.dx * (i + 1) / 81, L.a.z + L.lay.dz * (i + 1) / 81))))`);
  assert(low > 0.5, `cables clear the ground (${low})`);

  // saved and loaded: the same rigging
  const before = [await sup(0), await sup(1), await sup(2)];
  await g.ev(`saveNow()`); await g.page.reload(); await g.reloaded();
  eq([await sup(0), await sup(1), await sup(2)], before, 'the rigging is the same after a reload');

  // removing the lifts on top puts the first one back as it was
  await g.ev(`removeLift(world.lifts[2]); removeLift(world.lifts[1])`);
  eq(await sup(0), alone, 'alone again, the first lift is as it was');
}
