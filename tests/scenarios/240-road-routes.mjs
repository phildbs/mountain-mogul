// Roads find their own way (4.17; a player, Nov 23: "please fix the road making tool... you cant build roads with
// this"). A tap where a road should go finds the cheapest way there from your roads, winding across slopes too steep to
// climb straight, round what's in the way; a tap on from a draft adds the next part; Undo the last part takes it back;
// Straight lines keeps the old point-by-point taps.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 2e7; setRouteAuto(true)`);

  // a lot with no road to it yet (as in scenario 193), then a tap on it: the road finds its way to an entrance
  const r = await g.ev(`(() => { openRoads('parking');
    const gs = roadsGestureStart({ x: -36, z: 56 }); roadsGestureMove(gs, { x: -24, z: 64 }); roadsGestureEnd(gs, { x: -24, z: 64 }); commitLot();
    const before = parkReached(1); setRoadsTab('roads');
    const P = parks()[1], c = { x: P.x, z: P.z }; roadsTap(c);
    const d = rdraft, info = d && (d.info || roadCheck(d));
    return { before, drew: !!d, problems: info ? info.problems : ['no draft'], door: info && info.door ? info.door.name : '', pts: d ? d.pts.length : 0, legs: d ? d.legs.length : -1, sheet: /Undo the last part/.test(roadsToolSheet()) };
  })()`);
  eq([r.before, r.drew, r.problems, r.door, r.legs], [false, true, [], 'Lot 2', 0], 'a tap on a lot with no way in finds a road to its edge');
  eq(r.sheet, false, 'nothing to undo yet');
  const built = await g.ev(`(() => { const n = proads().length; commitRoad(); return { roads: proads().length - n, reached: parkReached(1) }; })()`);
  eq(built, { roads: 1, reached: true }, 'built, and cars can reach the lot');

  // on steep ground: a straight road up the slope is refused, the way found climbs at most what a road can
  const rv = await openGame(browser, url, { mountain: 'raven' }); await rv.click('#startBtn'); await rv.wait(300);
  const steep = await rv.ev(`(() => {
    const up = [];
    for (const e of roadPath().filter((p, i) => i % 12 === 0 && inProperty(p.x, p.z) && distXZ(p, roadEnd()) > 20)) for (let a = 0; a < 16; a++) { const t = { x: e.x + Math.cos(a / 16 * Math.PI * 2) * 22, z: e.z + Math.sin(a / 16 * Math.PI * 2) * 22 };
      if (!inProperty(t.x, t.z) || areaAt(t.x, t.z)) continue;
      const line = roadCheck({ R: null, kind: 'road', pts: [[e.x, e.z], [(e.x + t.x) / 2, (e.z + t.z) / 2], [t.x, t.z]] });
      if (line.steep > ROAD_GRADE * 1.3 && !line.problems.some((m) => !/steep/i.test(m))) up.push(t); }
    let ok = 0, tried = 0;
    for (const t of up.filter((t, i) => i % Math.max(1, Math.floor(up.length / 6)) === 0).slice(0, 6)) { tried++; rdraft = null; const w = routeDraft(t); if (w.d && !w.d.info.problems.length && w.d.info.steep <= ROAD_GRADE) ok++; }
    rdraft = null; return { tried, ok };
  })()`);
  assert(steep.tried >= 2, `found slopes too steep for a straight road (${steep.tried})`);
  assert(steep.ok >= 1, `the way found reaches some of them anyway (${steep.ok} of ${steep.tried})`);
  // switchbacks: a road whose bends cross ground too steep (measured on the raw ground) passes on its levelled bed, and
  // once built, the road really climbs no more than a road can (Phil, Nov 23)
  const bendy = await rv.ev(`(() => { state.cash = 5e7; openRoads('roads');
    const raw = (P) => { let m = 0; for (let i = 4; i < P.length; i += 2) { const a = P[i - 4], b = P[i]; if (overCreek(a.x, a.z) || overCreek(b.x, b.z)) continue; let run = 0; for (let j = i - 3; j <= i; j++) run += distXZ(P[j], P[j - 1]); m = Math.max(m, Math.abs(trueY(b.x, b.z) - trueY(a.x, a.z)) / run); } return m; };
    let seed = 11; const R = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let k = 0; k < 160; k++) { const p = { x: (R() - 0.5) * WN * 0.8, z: (R() - 0.5) * WN * 0.8 }; if (!inProperty(p.x, p.z) || areaAt(p.x, p.z)) continue;
      rdraft = null; const w = routeDraft(p); if (!w.d || w.d.info.problems.length) continue;
      const before = raw(w.d.info.P); if (before <= ROAD_GRADE + 0.01) continue;
      rdraft = w.d; const n = proads().length; commitRoad(); if (proads().length === n) return { why: 'not built' };
      const P = proadPath(proads()[proads().length - 1]);
      return { before: Math.round(before * 100), bed: Math.round(w.d.info.steep * 100), after: Math.round(raw(P) * 100), tries: k }; }
    return { why: 'no bendy road found' }; })()`);
  assert(!bendy.why, `a road with bends over steeper ground (${bendy.why || ''})`);
  assert(bendy.before > 16 && bendy.bed <= 16, `passes on its levelled bed: ${bendy.bed}%, though the raw ground reads ${bendy.before}%`);
  assert(bendy.after <= 18, `built, the road climbs ${bendy.after}% at most (a road can climb 16%)`);
  eq(rv.errors, [], 'no page errors on Raven Peak'); await rv.page.close();

  // the access road's point deepest inside your land, away from the main lot
  await g.ev(`window.innerRoadPt = () => { const deep = (p) => { let r = 0; while (r < 30 && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([u, v]) => inProperty(p.x + u * r, p.z + v * r))) r++; return r; };
    return roadPath().filter((p) => inProperty(p.x, p.z) && lotDist(p) > 8).sort((a, b) => deep(b) - deep(a))[0]; }`);
  // a tap on from the draft adds the next part; Undo the last part takes it back; off your land is refused, saying why
  const legs = await g.ev(`(() => { clearRDraft(); const told = [], rt = toast; toast = (m) => told.push(m);
    try {
      const e = innerRoadPt();
      roadsTap({ x: e.x, z: e.z }); const start = rdraft && rdraft.pts.length;
      const free = (x, z) => inProperty(x, z) && !areaAt(x, z) && lotDist({ x, z }) > 6;
      let a = null; for (let k = 0; k < 64 && !a; k++) { const t = { x: e.x + Math.cos(k) * 14, z: e.z + Math.sin(k) * 14 }; if (free(t.x, t.z)) { const keep = JSON.stringify(rdraft); roadsTap(t); if (rdraft.legs.length === 1) a = t; else rdraft = JSON.parse(keep); } }
      const one = rdraft.pts.length;
      let b = null; for (let k = 0; k < 64 && !b; k++) { const t = { x: a.x + Math.cos(k) * 12, z: a.z + Math.sin(k) * 12 }; if (free(t.x, t.z) && distXZ(t, e) > 14) { roadsTap(t); if (rdraft.legs.length === 2) b = t; } }
      const two = rdraft.pts.length, undo = /Undo the last part/.test(roadsToolSheet());
      document.querySelector('#sheet [data-action=rLegBack]')?.click();
      const back = rdraft.pts.length;
      clearRDraft(); roadsTap({ x: HALF - 1, z: -HALF + 1 });
      return { start, one, two, undo, back, off: !rdraft, told: told.join(' | ') };
    } finally { toast = rt; }
  })()`);
  eq(legs.start, 1, 'a tap on the road starts a road there');
  assert(legs.one > 1 && legs.two > legs.one, `taps add parts found for them (${legs.one}, then ${legs.two} points)`);
  eq([legs.undo, legs.back], [true, legs.one], 'Undo the last part takes the last part back');
  eq(legs.off, true, 'a tap off your land starts nothing');
  assert(/off your land/.test(legs.told), 'and says why: ' + legs.told);

  // Straight lines: a tap adds just that point, as before
  const straight = await g.ev(`(() => { clearRDraft(); setRouteAuto(false);
    const e = innerRoadPt();
    roadsTap({ x: e.x, z: e.z }); roadsTap({ x: e.x + 3, z: e.z - 6 }); const n = rdraft.pts.length, sw = /Straight lines/.test(roadsToolSheet());
    clearRDraft(); setRouteAuto(true); return { n, sw }; })()`);
  eq(straight, { n: 2, sw: true }, 'Straight lines: a tap adds one point, as before');
  eq(g.errors, [], 'no page errors');
  return `a tap finds a road’s way (round slopes, to a lot’s edge), parts add and undo, straight lines still there; a switchback over ${bendy.before}% ground: ${bendy.bed}% on its bed, ${bendy.after}% built`;
}
