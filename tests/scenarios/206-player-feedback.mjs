// Adum888's feedback, Nov 10: the Buildings list sorted by type folds each type away and opens where you left it;
// the profit map can leave types out (condos); a tap on one of your roads starts a new road there (with a way to
// change that road instead); a road being drawn shows its steepest stretch, the too-steep parts in red, and a
// switchback is measured along the road, not straight across the hairpin.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 2e7`);

  // a few buildings of three types, each with a last day
  const made = await g.ev(`(() => { const L = world.lifts[0]; let n = 0;
    for (const type of ['cafe', 'cafe', 'cafe', 'restroom', 'restroom', 'truck', 'truck', 'truck', 'truck'])
      for (let r = 6; r < 40; r += 1.5) { let ok = false; for (let a = 0; a < 24 && !ok; a++) { const x = L.a.x + Math.cos(a / 24 * 6.283) * r, z = L.a.z + Math.sin(a / 24 * 6.283) * r, v = evalBuilding(type, x, z, 0);
        if (!v.problems.length && isBase({ x, z })) { commitBuilding(v, type, x, z, 0); ok = true; n++; } } if (ok) break; }
    world.buildings.forEach((B, i) => { B.yday = { profit: 1000 * (i + 1) - 4000, visits: 10, revenue: 5000 }; });
    return n; })()`);
  assert(made >= 8, `buildings placed (${made})`);

  // fold a type away, and back
  const fold = await g.ev(`(() => { listView.blds.sort = 'type'; openManage('blds'); const rows = () => $('sheet').querySelectorAll('.lrow[data-action=goTo]').length, all = rows();
    $('sheet').querySelector('.lgroup[data-v=cafe]').click(); const folded = rows(), exp = $('sheet').querySelector('.lgroup[data-v=cafe]').getAttribute('aria-expanded'), kept = localStorage.getItem('mm.bldShut');
    $('sheet').querySelector('[data-action=bldGroup][data-v="*"]').click(); return { all, folded, exp, kept, back: rows() }; })()`);
  eq([fold.folded, fold.exp, fold.kept, fold.back], [fold.all - 3, 'false', '["cafe"]', fold.all], 'a type folds away, remembered on this device, and Show every list brings it back');

  // back to the list where you left it
  const scroll = await g.ev(`(() => { sheetSize('full'); const s = $('sheet'); s.style.maxHeight = '200px'; s.style.overflow = 'auto'; renderSheet(); s.scrollTop = 150; const was = s.scrollTop;
    goToFeature('bld', world.buildings.at(-1).id); const there = s.scrollTop; openManage('blds'); return { was, back: s.scrollTop, there }; })()`);
  assert(scroll.was > 50 && Math.abs(scroll.back - scroll.was) < 2, `the list opens where you left it (${JSON.stringify(scroll)})`);
  await g.ev(`$('sheet').style.maxHeight = ''; $('sheet').style.overflow = ''`);

  // leave a type off the profit map
  const pm = await g.ev(`(() => { setProfitMap('all'); openManage('blds'); const chip = $('sheet').querySelector('[data-action=profitType][data-v=truck]'), had = [...profitScale('all').keys()].filter((B) => B.type === 'truck').length;
    chip.click(); const now = [...profitScale('all').keys()].filter((B) => B.type === 'truck').length, pressed = $('sheet').querySelector('[data-action=profitType][data-v=truck]').getAttribute('aria-pressed');
    const kept = localStorage.getItem('mm.profitHide'); $('sheet').querySelector('[data-action=profitType][data-v=truck]').click(); setProfitMap('off');
    return { had, now, pressed, kept, again: [...profitScale('all').keys()].filter((B) => B.type === 'truck').length }; })()`);
  eq([pm.had > 0, pm.now, pm.pressed, pm.kept, pm.again === pm.had], [true, 0, 'false', '["truck"]', true], 'food trucks left off the profit map, and put back');

  // a road of yours, then a tap on it starts a new road there
  const tap = await g.ev(`(() => { openRoads('roads'); const P = parks()[0];
    const gs = roadsGestureStart({ x: -45, z: 76.8 }); for (const q of [{ x: -45, z: 73 }, { x: -44, z: 69 }, { x: -42, z: 65 }, { x: -40, z: 62 }]) roadsGestureMove(gs, q); roadsGestureEnd(gs, { x: -40, z: 62 });
    if ((rdraft.info || roadCheck(rdraft)).problems.length) return (rdraft.info || roadCheck(rdraft)).problems.join('|');
    commitRoad(); clearRDraft(); const R = proads()[0], q = proadPath(R)[Math.floor(proadPath(R).length / 2)];
    roadsTap({ x: q.x + 0.2, z: q.z }); const d = rdraft, txt = $('sheet').textContent;
    return { isNew: !!d && !d.R && d.pts.length === 1, from: d && d.from === R.id, offer: txt.includes('Change ' + R.name + ' instead') }; })()`);
  eq(tap, { isNew: true, from: true, offer: true }, 'a tap on your road starts a new one there, with Change that road instead on the panel');
  eq(await g.ev(`(() => { $('sheet').querySelector('[data-action=roadPick]').click(); return !!rdraft && rdraft.R === proads()[0]; })()`), true, '…which switches to changing it');
  await g.ev(`clearRDraft()`);

  // steepness: straight up is too steep, shown red with its steepest grade; a switchback is measured along the road
  const st = await g.ev(`(() => { rdraft = { R: null, kind: 'road', pts: [[-12, 71.9], [-12, 50], [-12, 20]] }; const up = roadCheck(rdraft); rdraft.info = up; showRGhost();
    const red = rGhost.some((m) => m.material === ROAD_GHOST_STEEP), txt = roadDraftHtml();
    rdraft = { R: null, kind: 'road', pts: [[-12, 71.9], [-4, 66], [-12, 61], [-4, 56], [-12, 51]] }; const zig = roadCheck(rdraft), P = zig.P;
    let across = 0; for (let i = 4; i < P.length; i += 2) across = Math.max(across, Math.abs(trueY(P[i].x, P[i].z) - trueY(P[i - 4].x, P[i - 4].z)) / (distXZ(P[i], P[i - 4]) || 1));
    clearRDraft(); return { up: up.steepAt.length > 0, red, shown: /Steepest/.test(txt) && txt.includes(Math.round(up.steep * 100) + '%'), along: zig.steep, across }; })()`);
  eq([st.up, st.red, st.shown], [true, true, true], 'a road straight up: too steep, the steep stretch red, its steepest grade on the panel');
  assert(st.along <= st.across + 1e-9, `a switchback is no steeper along the road than straight across its bends (${st.along} vs ${st.across})`);
  eq(g.errors, [], 'no page errors');
  return 'buildings list folds by type and opens where you left it; profit map types; a new road from your own road; road steepness';
}
