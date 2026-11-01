// Terrain parks: jumps, rails, boxes and a halfpipe built on a trail from Trail › Terrain park. Placement checks
// (room, overlap, ends), building and removing, saving and undo, park fans riding them during a day, skiers
// going around them, shaping on the report, and the tool on a phone.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 5e6; state.reputation = 1.1`);
  // the trail and a point on it, at = fraction down, side = fraction across
  const at = `((t, at, side = 0) => { const sp = featFrame(t, at * t.len), hw = sampleHW(t, t.samples[sp.i]) * side; return { x: sp.x - sp.dz * hw, z: sp.z + sp.dx * hw }; })`;
  // the tool opens from the Trail menu and lists every feature
  const tool = await g.ev(`(() => { setTool('trail'); renderSheet(); document.querySelector('[data-action="trailMode"][data-v="tpark"]').click();
    return { tool: state.tool, picks: document.querySelectorAll('#sheet [data-action="parkPick"]').length }; })()`);
  eq(tool, { tool: 'tpark', picks: 7 }, 'Trail › Terrain park opens the picker with seven features');
  // a small jump a third of the way down
  const built = await g.ev(`(() => { const t = realTrails()[0], at = ${at}, cash = state.cash;
    document.querySelector('#sheet [data-action="parkPick"][data-v="jump"]').click();
    parkTap(at(t, 0.35)); const info = parkSiteInfo(), ghost = !!parkGhost;
    document.querySelector('#sheet [data-action="parkBuild"]').click();
    return { problems: info.problems, ghost, paid: cash - state.cash, feats: t.feats.length, model: !!t.fxGroup && t.fxGroup.children.length, fx: t.fx.length }; })()`);
  eq(built.problems, [], 'the jump fits');
  assert(built.ghost, 'a preview shows before building');
  eq([built.paid, built.feats, built.model, built.fx], [12000, 1, 1, 1], 'built for $12,000 with its model');
  // a second one on top of it is refused; the very top of the trail is too
  const bad = await g.ev(`(() => { const t = realTrails()[0], at = ${at};
    parkTap(at(t, 0.35)); const a = parkSiteInfo().problems; parkTap(at(t, 0.003)); const b = parkSiteInfo().problems;
    return { a, b, btn: document.querySelector('#sheet [data-action="parkBuild"]').disabled }; })()`);
  assert(bad.a.some((p) => p.includes('Too close')), `overlapping features are refused: ${bad.a}`);
  assert(bad.b.some((p) => p.includes('room at the top')), `features keep clear of the ends: ${bad.b}`);
  eq(bad.btn, true, 'Build waits for a good spot');
  // more features down the same trail, and a halfpipe wherever the pitch suits it
  const more = await g.ev(`(() => { const t = realTrails()[0], at = ${at}, out = {};
    for (const [type, a, side] of [['rail', 0.5, -0.4], ['box', 0.5, 0.4], ['tabletop', 0.62, 0], ['roller', 0.2, 0]]) {
      parkDraft.type = type; parkTap(at(t, a, side)); out[type] = parkSiteInfo().problems; if (!out[type].length) parkBuild(); }
    parkDraft.type = 'pipe'; let pipe = null;
    for (const T of realTrails()) for (let a = 0.1; a < 0.92 && !pipe; a += 0.04) { parkTap(at(T, a)); if (!parkSiteInfo().problems.length) { pipe = T.name; parkBuild(); } }
    return { out, pipe, n: realTrails().reduce((s, T) => s + T.feats.length, 0) }; })()`);
  for (const [k, v] of Object.entries(more.out)) eq(v, [], `the ${k} fits`);
  assert(more.pipe, 'a halfpipe fits somewhere on the starter trails');
  eq(more.n, 6, 'six features built');
  // fans value the park; others would rather cruise elsewhere
  const fit = await g.ev(`(() => { const t = realTrails()[0], base = { ab: 2, pref: 2, seen: {}, explore: 0, learnLaps: 9 };
    return [trailFit(t, { ...base, fs: true }) > trailFit(t, { ...base, fs: false }), t.fxPts[1] < t.fxPts[2], t.fxPts[0]]; })()`);
  eq(fit, [true, true, 0], 'park fans favour it; intermediates ride only the small features; beginners none');
  // riders rise over a jump; non-riders steer clear of a rail
  const pose = await g.ev(`(() => { const t = realTrails()[0], sp = t.fx.find((s) => s.type === 'tabletop');
    const fan = { id: 0, ab: 3, fs: true }; while (!ridesFeat(fan, sp)) fan.id++;
    const air = featPose(t, fan, sp.s0 + 2.2, 0, sp.hw), rail = t.fx.find((s) => s.type === 'rail'), cruise = featPose(t, { id: 1, ab: 1, fs: false }, rail.sc, rail.lat, rail.hw);
    return [air.y > 0.5, Math.abs(cruise.off - rail.lat) > rail.F.w / 2]; })()`);
  eq(pose, [true, true], 'riders fly over the big jump; other skiers go around the rail');
  // saves and loads; undo takes back the last build
  const saved = await g.ev(`(() => { const cash = state.cash; undoLast(); const after = realTrails().reduce((s, T) => s + T.feats.length, 0), back = state.cash - cash;
    const sv = JSON.parse(JSON.stringify(saveData(false))); applySave(sv);
    return { after, back, n: realTrails().reduce((s, T) => s + T.feats.length, 0), models: realTrails().filter((T) => T.fxGroup).length }; })()`);
  eq([saved.after, saved.back, saved.n], [5, 250000, 5], 'undo removes the halfpipe and refunds it; features save and load');
  assert(saved.models >= 1, 'models are rebuilt on load');
  // removing: tap a built feature with nothing picked
  const rem = await g.ev(`(() => { openParkTool(); const t = realTrails()[0], sp = t.fx.find((s) => s.type === 'roller'), cash = state.cash;
    parkTap(featPt(sp, 0, 0)); const sel = parkDraft.sel && parkDraft.sel.f.type;
    document.querySelector('#sheet [data-action="parkRemove"]').click(); return { sel, back: state.cash - cash, left: t.feats.length }; })()`);
  eq(rem, { sel: 'roller', back: 1500, left: 4 }, 'tapping a feature selects it; removing returns 25%');
  // moving: tap it, Move, tap a new spot; it keeps its id and costs a fifth of its price
  const mv = await g.ev(`(() => { const t = realTrails()[0], at = ${at}, sp = t.fx.find((s) => s.type === 'rail'), id = sp.f.id, cash = state.cash;
    parkTap(featPt(sp, 0, 0)); document.querySelector('#sheet [data-action="parkMove"]').click();
    parkTap(at(t, 0.8, 0.3)); const probs = parkSiteInfo().problems; parkBuild();
    const f = t.feats.find((x) => x.id === id); return { probs, fee: cash - state.cash, at: f && f.at > 0.7, n: t.feats.length }; })()`);
  eq(mv, { probs: [], fee: 2000, at: true, n: 4 }, 'a rail moves down the trail for $2,000, keeping its id');
  // the trail card lists the park
  const card = await g.ev(`(() => { setTool('explore'); select({ kind: 'trail', obj: realTrails()[0] }); return document.querySelector('#sheet').textContent; })()`);
  assert(card.includes('Terrain park') && card.includes('Big jump') && card.includes('/night'), 'the trail card shows its park');
  // a day: fans ride features, shaping is paid overnight and shown on the report
  const day = await g.ev(`(() => { select(null); const want = realTrails().filter(runnable).reduce((a, t) => a + parkUpkeep(t), 0);
    openDay(); let n = 0; while (state.time < 700 && n < 200000) { simStep(1.5); n++; }
    // open for the day: a feature becomes a blueprint
    const t = realTrails()[1], at = ${at}; openParkTool(); parkDraft.type = 'jump'; let planned = false;
    for (let a = 0.25; a < 0.9 && !planned; a += 0.05) { parkTap(at(t, a, -0.5)); if (!parkSiteInfo().problems.length) { parkBuild(); planned = true; } }
    const plan = world.plans.find((p) => p.kind === 'feat'); setTool('explore');
    while (state.phase === 'open' && n < 200000) { simStep(1.5); n++; }
    const r = state.lastReport; return { want, park: r.exp.park, hits: r.parkHits, phase: state.phase, plan: !!plan && plan.type, rp: r.park && [r.park.fans > 0, r.park.rode > 0, r.park.feats.length] }; })()`);
  eq(day.plan, 'jump', 'while open, a feature becomes a blueprint');
  eq(day.rp, [true, true, 4], 'the report counts park fans, riders and every feature');
  eq(day.phase, 'report', 'the day ends');
  eq(day.park, day.want, 'park shaping is charged for open trails');
  assert(day.hits > 20, `park fans ride the features (${day.hits} rides)`);
  const rpt = await g.ev(`(() => { showReport(); const page = document.querySelector('.rp-page[data-page="park"]');
    return [document.body.textContent.includes('Terrain park shaping'), !!document.querySelector('[data-rptab="park"]'), !!page && page.textContent.includes('Most ridden')]; })()`);
  eq(rpt, [true, true, true], 'the report lists park shaping and has a Park page');
  const overnight = await g.ev(`(() => { const before = realTrails()[1].feats.length; nextDay(); return [realTrails()[1].feats.length - before, world.plans.filter((p) => p.kind === 'feat').length]; })()`);
  eq(overnight, [1, 0], 'the planned jump is built overnight');
  // advice: fans with no park, and a park far from patrol
  const adv = await g.ev(`(() => { const out = []; parkAdvice({ complaints: { noPark: 20 } }, (u, t) => out.push(t));
    parkAdvice({ complaints: {}, park: { falls: 4, fans: 20, missed: [0, 12, 0, 0], cruise: [] } }, (u, t) => out.push(t)); return out; })()`);
  assert(adv.some((t) => t.includes('20 park fans came looking')), `fans with no park are pointed at the tool: ${adv}`);
  assert(adv.some((t) => t.includes('patrol hut')) && adv.some((t) => t.includes('small features')), `falls far from patrol, and intermediates with nothing to ride, get advice: ${adv}`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
  // the picker on a phone
  const m = await openGame(browser, url, { width: 390, height: 844, hasTouch: true });
  await m.click('#startBtn'); await m.wait(300);
  await m.ev(SETUPS.juniperStarter);
  const phone = await m.ev(`(() => { openParkTool(); const el = document.querySelector('#sheet'), r = el.getBoundingClientRect();
    return { w: r.width <= 390, rows: el.querySelectorAll('[data-action="parkPick"]').length, wide: el.scrollWidth <= el.clientWidth + 1 }; })()`);
  eq(phone, { w: true, rows: 7, wide: true }, 'the picker fits a phone');
  eq(m.errors, [], 'no page errors on the phone');
  await m.page.close();
}
