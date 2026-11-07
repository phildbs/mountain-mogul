// From a guest (Nov 7): "the land reclaim part is finicky, and why can't you plant trees anywhere?". Landscape's
// Replant only regrew trees that once stood, so open ground (the base, meadows) said "Nothing to regrow here", and a
// dab whose middle was just off your land did nothing at all. Now Plant trees also plants new trees on open ground,
// and works right up to the property line.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(`state.cash = 5e6`);
  const r = await g.ev(`(() => { setTool('clear'); state.landMode = 'plant'; state.brushR = 3; renderSheet();
    const trees0 = () => world.buildings.filter((B) => B.type === 'tree').length;
    // open ground that never had trees: find a spot with no tree of the mountain's own, standing or cleared, nearby
    let spot = null;
    for (let z = 20; z < 70 && !spot; z += 2) for (let x = -40; x < 40 && !spot; x += 2) {
      if (!inProperty(x, z)) continue; let any = false; treesInBrush({ x, z }, 3, () => { any = true; }); clearedInBrush({ x, z }, 3, () => { any = true; });
      if (!any && newTreeCount({ x, z }) >= 8) spot = { x, z }; }
    if (!spot) return 'no open ground';
    const t0 = trees0(), cash = state.cash, shown = newTreeCount(spot);
    stroke.trees = 0; stroke.cost = 0; clearAt(new THREE.Vector3(spot.x, heightAt(spot.x, spot.z), spot.z));
    const planted = trees0() - t0, paid = cash - state.cash;
    // again in the same place: nothing more fits
    clearAt(new THREE.Vector3(spot.x, heightAt(spot.x, spot.z), spot.z));
    const again = trees0() - t0 - planted;
    // nothing on a trail, the road or the lot
    const T = world.buildings.filter((B) => B.type === 'tree');
    const bad = T.filter((B) => realTrails().some((t) => t.samples.some((s) => Math.hypot(s.x - B.x, s.z - B.z) < sampleHW(t, s))) || roadDist(B.x, B.z) < 2 || lotBoxes().some((b) => boxDist(B, b) < 0.5)).length;
    // the edge of the property: the brush's middle just outside, part of it inside
    let edge = null; for (let x = 0; x < HALF && !edge; x += 0.5) if (!inProperty(x, 30) && inProperty(x - 2, 30)) edge = { x, z: 30 };
    const alive = () => trees.alive.reduce((a, v) => a + v, 0);
    let atEdge = 0;
    if (edge) { treesInBrush(edge, 4, (k) => { trees.alive[k] = 0; }); const t1 = trees0(), a1 = alive(); clearAt(new THREE.Vector3(edge.x, heightAt(edge.x, edge.z), edge.z)); atEdge = trees0() - t1 + alive() - a1; }
    const outside = world.buildings.filter((B) => B.type === 'tree' && !inProperty(B.x, B.z)).length;
    return { planted, shown, paid, again, bad, edge: !!edge, atEdge, outside }; })()`);
  assert(typeof r === 'object', `set up (${r})`);
  assert(r.planted >= 8, `new trees planted on open ground (${r.planted})`);
  eq([r.paid, r.shown], [r.planted * 400, r.planted], '$400 each, the price of a Tree, and as many as the brush said');
  eq([r.again, r.bad, r.outside], [0, 0, 0], 'a second dab adds none, and none on a trail, the road, the lot or off your land');
  assert(r.edge && r.atEdge > 0, `with the brush's middle just past the property line, it still plants on your side (${r.atEdge})`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
