// Bridges over roads (Adum888, Nov 27; Phil chose the automatic bridge and twice a creek bridge's price): a trail
// across a road goes over it on a deck that clears the road, with ramps either side; the terrain rating ignores the
// bridge; a road drawn across a trail pays for the trail's bridge; the bridge comes back on load and goes with the road.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 5e7`);

  // A road across the slope, through the east starter trail (it runs (22,15) → (24,40)).
  const rd = await g.ev(`(() => {
    const t = realTrails().find((t) => t.samples.some((s) => s.x > 18 && Math.abs(s.z - 28) < 1)), rating = t.an.rating, maxGrade = t.an.maxGrade;
    const pts = [[12, 28], [36, 28]], info = roadCheck({ pts, kind: 'road' });
    state.proads = [{ id: 1, name: 'Test Road', kind: 'road', pts }]; netChanged();
    const S = t.samples, over = S.filter((s) => s.over);
    return { tid: t.id, name: t.name, crossed: info.overTrails.map((o) => o.name), pays: info.trailBridges, want: 2 * TRAIL_WIDTHS[t.width].bridge,
      rb: S.filter((s) => s.rb).length, over: over.length, deck: over.length ? Math.min(...over.map((s) => s.y - trueY(s.x, s.z))) : 0,
      rating, ratingNow: t.an.rating, maxGrade, maxNow: t.an.maxGrade, built: !!t.bridgeGroup, problems: t.an.problems,
      onDeck: (() => { const k = S.findIndex((s) => s.over); const a = S[k]; return surfaceAt(a.x, a.z, a.y, true) - heightAt(a.x, a.z); })() };
  })()`);
  assert(rd.crossed.includes(rd.name), `the road's check sees the trail it crosses: ${JSON.stringify(rd)}`);
  eq(rd.pays, rd.want, 'and charges twice a creek bridge for it');
  assert(rd.over > 0 && rd.rb >= rd.over + 8, `the trail goes over the road on a deck with ramps (${rd.over} over, ${rd.rb} in all)`);
  assert(rd.deck >= 0.5, `the deck clears the road (${rd.deck.toFixed(2)})`);
  assert(rd.onDeck > 0.9, `skiers stand on the deck, not the road (${rd.onDeck.toFixed(2)} above it, drawn)`);
  eq([rd.ratingNow, +rd.maxNow.toFixed(3)], [rd.rating, +rd.maxGrade.toFixed(3)], 'the bridge doesn’t change the trail’s rating or steepness');
  eq(rd.problems, [], 'the trail has no problems');
  assert(rd.built, 'the bridge is drawn');

  // A new trail drawn across the road: one bridge over a road, priced at twice a creek bridge.
  const nt = await g.ev(`(() => {
    const t = trailById(${rd.tid}), pts = t.pts.map((p) => ({ x: p.x - 3, z: p.z, y: heightAt(p.x - 3, p.z) }));
    const info = evalTrail(pts, 'medium');
    return { roadBridges: info.roadBridges, creek: info.bridges, cost: info.bridgeCost, line: (() => { draft.kind = 'trail'; return ''; })() };
  })()`);
  eq([nt.roadBridges, nt.creek], [1, 0], 'a new trail across it gets one road bridge');
  assert(nt.cost >= 2 * 25000, `priced at twice a medium creek bridge, plus any approach work (${nt.cost})`);

  // Saved and loaded: the bridge is worked out again from the road.
  await g.ev('saveNow()'); await g.page.reload(); await g.reloaded(); await g.click('#startBtn');
  const back = await g.ev(`(() => { const t = trailById(${rd.tid}); return t && { rb: t.samples.filter((s) => s.rb).length, built: !!t.bridgeGroup }; })()`);
  eq(back, { rb: rd.rb, built: true }, 'the bridge loads back');

  // Without the road, no bridge.
  const gone = await g.ev(`(() => { state.proads = []; netChanged(); const t = trailById(${rd.tid}); return { rb: t.samples.filter((s) => s.rb).length, built: !!t.bridgeGroup }; })()`);
  eq(gone, { rb: 0, built: false }, 'the bridge goes with the road');

  // A day with skiers over the bridge: nothing breaks.
  await g.ev(`(() => { state.proads = [{ id: 1, name: 'Test Road', kind: 'road', pts: [[12, 28], [36, 28]] }]; netChanged(); })()`);
  eq(await g.ev(`(() => { openDay(); state.speed = 0; let n = 0; while (state.phase === 'open' && n++ < 90000) simStep(1.5); return state.phase; })()`), 'report', 'a day runs to its report');
  assert(await g.ev(`(state.lastReport.trailRuns || {})[${rd.tid}] > 0 || Object.keys(state.lastReport).length > 0`), 'the report is there');
  eq(g.errors, [], 'no errors');
  await g.page.close();
  return `deck ${rd.deck.toFixed(2)} over the road, ${rd.rb} bridge samples, road pays ${rd.pays}`;
}
