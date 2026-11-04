// The match demo (?matchDemo=1), for previews: Crown Peak with a starter resort and two pretend rivals, drawn as a
// match draws them, with nothing online. Also checks the ground past the map's edge (the ring) that their furthest
// lot rows and land stand on, and that the view can reach it.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { query: '?matchDemo=1', mountain: 'fresh' });
  await g.page.waitForFunction(() => window.__dbg('!!(matchView && matchView.demo)'), null, { timeout: 20000 });
  const s = await g.ev(`(() => {
    const lots = rivalGroup.children.filter((o) => o.material === LOT_MAT), roads = rivalGroup.children.filter((o) => o.material === ROAD_MAT);
    const off = lots.filter((o) => { o.geometry.computeBoundingSphere(); const c = o.geometry.boundingSphere.center; return !inWorld(c.x, c.z); }).length;
    const h = [heightAt(0, HALF + 20), heightAt(-HALF - 30, -HALF - 30)];
    return { mt: MOUNTAIN.id, lifts: world.lifts.length, lots: lots.length, off, roads: roads.length, land: rivalLand.length, far: farTrees.n, farCut: farTrees.cut.reduce((a, b) => a + b, 0),
      h: h.every((y) => Number.isFinite(y) && y > -5), edge: Math.abs(heightAt(0, HALF - 0.01) - heightAt(0, HALF + 0.01)) < 0.05, out: roadOutPath().length > 10 };
  })()`);
  eq([s.mt, s.lifts >= 1], ['match', true], 'a starter resort on Crown Peak');
  eq([s.lots, s.roads, s.land], [14, 2, 2], 'both rivals’ lots (6 and 8 sections), roads and land');
  assert(s.off >= 2, `some rival lot sections stand past the old map edge, on the ring (${s.off})`);
  assert(s.far > 1000 && s.farCut > 0, `the ring has its own forest, cleared under rivals' roads and lots (${s.far}, ${s.farCut})`);
  assert(s.h && s.edge, 'ground heights past the map are real, and meet the map at its edge');
  assert(s.out, 'your road carries on past the edge');
  // The view can be moved out past the old edge, over a rival's base.
  const far = await g.ev(`(() => { for (let i = 0; i < 400; i++) moveTarget(1.2, -1); const p = pickTerrain(W / 2, H / 2, true); return p ? Math.max(Math.abs(p.x), Math.abs(p.z)) : 0; })()`);
  assert(far > HALF_OF(), `the view reaches past the old map edge (${Math.round(far)})`);
  const saved = await g.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('skiTycoon') && /"mt":"match"/.test(localStorage.getItem(k) || '')));
  eq(saved, [], 'the demo is never saved');
  await g.ev(`openWhatsNew()`);
  eq(await g.ev(`$('wnTabs').querySelector('[aria-pressed=true]').dataset.wn`), 'kotm', 'in a match, What’s new opens on the King of the Mountain tab');
  if (process.env.SHOTS) { await g.page.setViewportSize({ width: 390, height: 844 }); await g.wait(400); await g.page.screenshot({ path: 'whats-new-kotm.png' }); }
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
const HALF_OF = () => 112;
