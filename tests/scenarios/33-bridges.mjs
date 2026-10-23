// Trails cross the creek on a bridge: the creek bed is left alone, the crossing costs extra,
// skiers ride the deck, and resorts saved before bridges get their creek dug back out.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
const CROSS = `(() => {
  // a short straight trail across the creek that runs downhill the whole way
  const near = []; for (let z = -80; z <= 80; z += 2) for (let x = -80; x <= 80; x += 1)
    if (inProperty(x, z) && sampleGrid(CREEKD, x + HALF, z + HALF) < 0.4) near.push({ x, z });
  for (const c of near.slice(Math.floor(near.length / 3))) for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    const pts = [{ x: c.x - Math.cos(a) * 9, z: c.z - Math.sin(a) * 9 }, { x: c.x + Math.cos(a) * 9, z: c.z + Math.sin(a) * 9 }];
    if (!pts.every((p) => inProperty(p.x, p.z) && sampleGrid(CREEKD, p.x + HALF, p.z + HALF) > 4)) continue;
    const info = evalTrail(pts, 'medium', false, false);
    if (!info.an.problems.some((p) => /uphill|steep|creek|outside/.test(p))) return pts;
  }
  return null;
})()`;
export default async function ({ browser, url }) {
  for (const mt of ['juniper', 'maple', 'raven']) {
    const g = await openGame(browser, url, { mountain: mt });
    await g.click('#startBtn'); await g.wait(400);
    const pts = await g.ev(CROSS);
    assert(pts, `${mt}: found a creek crossing`);
    const r = await g.ev(`(() => {
      const pts = ${JSON.stringify(pts)}, info = evalTrail(pts, 'medium', false, false);
      const bed = []; for (let k = 0; k < NV * NV; k++) if (CREEKD[k] < 0.8) bed.push(k);
      const before = bed.map((k) => HT[k]);
      const deck = info.samples.filter((s) => s.bridge);
      state.cash = 1e7; const cash = state.cash;
      const t = commitTrail(info, pts, 'medium'); computeNetwork(); syncLabels();
      return { bridges: info.bridges, bridgeCost: info.bridgeCost, cost: info.cost, paid: cash - state.cash,
        deckLens: info.samples.filter((s) => s.bridge).length, aboveBed: Math.max(...deck.map((s) => trueY(s.x, s.z) - s.y)), deckLen: deck.length,
        bedSame: bed.every((k, n) => HT[k] === before[n]), mesh: !!t.bridgeGroup && t.bridgeGroup.children.reduce((a, m) => a + (m.geometry ? m.geometry.attributes.position.count / 36 : 0), 0),
        problems: t.an.problems.filter((p) => /uphill|creek|steep/.test(p)) };
    })()`);
    eq(r.bridges, 1, `${mt}: one bridge`);
    assert(r.bridgeCost >= 25000 && r.bridgeCost < 100000, `${mt}: a medium trail’s bridge costs $25k plus its approaches (${r.bridgeCost})`);
    assert(Math.abs(r.paid - r.cost) < 1, `${mt}: paid what was quoted`);
    assert(r.deckLen >= 4 && r.deckLen <= 24, `${mt}: a short deck (${r.deckLen} samples)`);
    assert(r.aboveBed < 0.15, `${mt}: the deck is above the creek bed (${r.aboveBed})`);
    assert(r.bedSame, `${mt}: the creek bed is untouched`);
    assert(r.mesh > 4, `${mt}: the bridge is drawn`);
    eq(r.problems, [], `${mt}: the built trail is fine`);
    // the panel itemises it
    await g.ev(`(() => { setTool('trail'); draft.pts = ${JSON.stringify(pts)}; draft.dirty = true; recomputeDraft(); })()`);
    assert(/Creek bridge/.test(await g.ev(`$('sheet').innerText`)), `${mt}: the panel shows the bridge`);
    await g.ev(`setTool(null)`);
    if (mt === 'juniper') {
      // running along the creek is refused
      const along = await g.ev(`(() => { const c = []; for (let z = 34; z <= 60; z += 2) for (let x = 20; x <= 70; x += 0.5) if (sampleGrid(CREEKD, x + HALF, z + HALF) < 0.3) { c.push({ x, z }); break; } return evalTrail(c, 'narrow', false, false).an.problems; })()`);
      assert(along.some((p) => /along the creek/.test(p)), 'a trail down the creek bed is refused');
      // a resort saved before bridges, with the creek filled in under a trail, gets it dug back out
      const healed = await g.ev(`(() => {
        const bed = []; for (let k = 0; k < NV * NV; k++) if (CREEKD[k] < 1.0) bed.push(k);
        const orig = bed.map((k) => HT0[k]);
        for (const k of bed.slice(0, 40)) HT[k] = HT0[k] + 0.8;
        const enc = encodeTerrain(); restoreTerrain(enc);
        return bed.slice(0, 40).every((k, n) => Math.abs(HT[k] - orig[n]) < 1e-5);
      })()`);
      assert(healed, 'filled-in creek beds are restored on load');
      // skiers ride over it
      await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
      await g.ev(`(() => { openDay(); let k = 0; while (state.phase === 'open' && k < 90000) { simStep(1.5); k++; } })()`);
    }
    eq(g.errors, [], `${mt}: no page errors`);
    await g.page.close();
  }
}
