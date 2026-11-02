// More decor (2.81): trail map boards show the resort's own map; string lights are a chain of tapped poles (one
// card); string lights and holiday trees take a bulb colour the player picks (saved); floodlights face the nearest
// trail, turn like buildings and cost night power; lights by an après venue add a little après pull. Also: tapping
// a thin object on screen selects it, and placing things clears only the trees on their footprint.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);

  // Models fit their footprints; all four sit in the Decor tab and can be bulldozed.
  const models = await g.ev(`(() => ['tmap', 'xtree', 'flood'].map((type) => {
    const s = BTYPES[type], box = new THREE.Box3().setFromObject(MODELS[type](0, { hue: 1 }).build());
    return [type, box.min.x >= -s.w / 2 - 0.1 && box.max.x <= s.w / 2 + 0.1 && box.min.z >= -s.d / 2 - 0.1 && box.max.z <= s.d / 2 + 0.1,
      BGROUPS.find((t) => t[0] === 'decor')[2].includes(type), DOZE_TYPES.includes(type), isDecor({ type })];
  }))()`);
  const tab = await g.ev(`(() => { showFeature('decor'); return ['tmap', 'strlight', 'xtree', 'flood'].map((v) => !!document.querySelector('#sheet [data-action=pickB][data-v=' + v + ']')); })()`);
  eq(tab, [true, true, true, true], "What's new opens the Decor tab with all four");
  await g.ev(`setTool('explore')`);
  eq(models, [['tmap', true, true, true, true], ['xtree', true, true, true, true], ['flood', true, true, true, true]], 'new decor pieces fit, in the Decor tab');

  const placed = await g.ev(`(() => {
    state.cash = 1e8;
    const t = realTrails()[0]; removeTrail(t); t.ws = Array(shapeStations(t)).fill(5.5); addTrail(t);
    for (const q of realTrails()) q.lit = true;
    computeNetwork();
    const place = (type, near, r0, r1, rot = 0) => { for (let r = r0; r < r1; r += 0.25) for (let a = 0; a < 32; a++) {
      const x = near.x + Math.cos(a / 32 * 6.283) * r, z = near.z + Math.sin(a / 32 * 6.283) * r, i = evalBuilding(type, x, z, rot);
      if (i && !(i.problems || []).length) { const b = commitBuilding(i, type, x, z, rot); computeNetwork(); return b; }
    } return null; };
    const L = world.buildings.find((b) => b.type === 'lodge'), mid = t.samples[Math.floor(t.samples.length / 2)];
    // a floodlight placed by tapping faces the trail beside it; string lights are a chain of tapped poles
    pickBuilding('flood'); const fp = place('bench', mid, 6, 9); const fx = fp.x, fz = fp.z; removeBuilding(fp);
    draftTap({ x: fx, z: fz }); recomputeBldDraft(); buildBuildingDraft();
    const F = world.buildings.find((b) => b.type === 'flood');
    let S = null, chainMsg = [];
    for (let r = 2; r < 9 && !S; r += 0.5) for (let a = 0; a < 16 && !S; a++) {
      const o = { x: L.door.x + Math.cos(a / 16 * 6.283) * r, z: L.door.z + Math.sin(a / 16 * 6.283) * r }, dx = Math.cos(a / 16 * 6.283 + 1.57), dz = Math.sin(a / 16 * 6.283 + 1.57);
      pickBuilding('strlight'); for (const k of [0, 1, 2]) chainTap({ x: o.x + dx * 2.5 * k, z: o.z + dz * 2.5 * k });
      if (draft.chain.length === 3 && !draft.info.problems.length) {
        chainTap({ x: o.x + dx * 15, z: o.z + dz * 15 }); chainMsg.push(draft.chain.length);
        draftUndo(); chainMsg.push(draft.chain.length); chainTap({ x: o.x + dx * 5, z: o.z + dz * 5 });
        buildBuildingDraft(); S = world.buildings.find((b) => b.type === 'strlight');
      }
    }
    setTool('explore');
    const X = place('xtree', L.door, 3, 9), M = place('tmap', world.lifts[0].a, 2.5, 8);
    window.__chain = { msg: chainMsg, poles: S && S.pts.length, one: world.buildings.filter((b) => b.type === 'strlight').length, upkeep: S && bspec(S).upkeep };
    const q = nearestTrailPt(F);
    return { ids: [F, S, X, M].map((b) => b && b.id), flood: !!F.floodAt && distXZ(F, F.floodAt) > 4 && F.floodR >= 6.5 && distXZ(F.floodAt, q) < distXZ(F, q) && canTurn('flood'),
      map: !!TMAP.c && TMAP.sig.includes('|') && M.group.children.some((m) => m.material === TMAP.mat)};
  })()`);
  assert(placed.ids.every(Boolean), `all four placed (${placed.ids})`);
    assert(placed.map, 'the board carries the shared trail map picture');
  const [F, S, X, M] = placed.ids;
  eq(await g.ev(`__chain`), { msg: [3, 2], poles: 3, one: 1, upkeep: 6 }, 'a too-distant pole is refused, undo removes the last one, and the chain of three is one piece');
  assert(placed.flood, 'a new floodlight faces the nearest trail, lights well into it, and can be rotated');

  // A tap on the floodlight's tower (not the ground under it) selects it; so does a tap right beside the string.
  const pick = await g.ev(`(() => { const B = bldById(${F}), s = project(B.x, B.baseY + 3, B.z), S = bldById(${S}), w = toWorld(S, S.pts[1][0], S.pts[1][1]), t = project(w.x, S.baseY + 1.2, w.z);
    return [(pickBldAt(s.x, s.y) || {}).id === B.id, (pickBldAt(t.x + 6, t.y) || {}).id === S.id, !pickFeature(pickTerrain(s.x, s.y)) || pickFeature(pickTerrain(s.x, s.y)).obj !== B]; })()`);
  eq(pick, [true, true, true], 'tapping the tower or the string selects them, where the ground under the tap would not');

  // Placing a bench clears only the trees on its footprint, not a wide ring around it.
  const trees = await g.ev(`(() => { for (let x = -40; x < 40; x += 1) for (let z = -40; z < 40; z += 1) { if (countInBrush({ x, z }, 1.2) < 3) continue;
      const v = evalBuilding('bench', x, z, 0); if (v.problems.length) continue;
      return { n: v.treeSet.size, far: [...v.treeSet].filter((k) => Math.hypot(Math.max(Math.abs(trees.x[k] - x) - 0.4, 0), Math.max(Math.abs(trees.z[k] - z) - 0.25, 0)) > 0.16).length, ring: countInBrush({ x, z }, 1.5) }; }
    return null; })()`);
  assert(trees && trees.far === 0 && trees.n < trees.ring, `a bench in the forest clears only trees on its spot (${JSON.stringify(trees)})`);

  // The map redraws when the resort changes, and not otherwise.
  const redraw = await g.ev(`(() => { const a = TMAP.sig; drawTrailMap(); const same = TMAP.sig === a; state.resortName = 'Test Peaks'; drawTrailMap(); return [same, TMAP.sig !== a && TMAP.sig.startsWith('Test Peaks')]; })()`);
  eq(redraw, [true, true], 'the trail map redraws only when something on it changes');

  // Bulb colours: picked on the card, free, and new ones match the last pick.
  const hue = await g.ev(`(() => { select({ kind: 'bld', obj: bldById(${S}) }); renderSheet();
    const btn = document.querySelector('#sheet [data-action=bulbHue][data-v="1"]'); if (!btn) return 'no picker'; btn.click();
    return [bldById(${S}).hue, bulbPick, bldById(${X}).hue || 0]; })()`);
  eq(hue, [1, 1, 0], 'picking holiday colours changes this string only');

  // Night: floodlights and lights turn on, and a floodlight costs about 2.5 trail lights of power.
  const night = await g.ev(`(() => {
    setTool('explore'); openDay(); runOps.night = 1260; state.speed = 0; state.time = 1080;
    const lit = [${F}, ${S}, ${X}].map((id) => bldLitNow(bldById(id))), map = bldLitNow(bldById(${M}));
    const withF = nightCost({ cost: 1 }).lights, B = bldById(${F}); B.type = 'tlight'; const asT = nightCost({ cost: 1 }).lights; B.type = 'flood';
    return { lit, map, extra: Math.round((withF - asT) / (LIGHT_GAP * 1.5 * LIGHT_HOUR_UNIT * MOUNTAIN.costs * (nightEnd() - closeTime()) / 60) * 10) / 10, near: lightsNearVenues() };
  })()`);
  eq(night.lit, [true, true, true], 'floodlight, string lights and holiday tree are lit at night');
  eq(night.map, false, 'the board has no light of its own');
  assert(Math.abs(night.extra - 1) < 0.15, `a floodlight draws 1.5 more trail lights of power than a trail light (${night.extra})`);
  eq(night.near, 2, 'string lights and the holiday tree by the lodge count for après');

  // Saved and reloaded: the bulb colour stays, older pieces without one are warm white.
  await g.ev(`saveNow()`);
  await g.page.reload(); await g.reloaded();
  const back = await g.ev(`[${S}, ${X}, ${F}, ${M}].map((id) => { const b = bldById(id); return b && [b.type, b.hue || 0]; })`);
  eq(back, [['strlight', 1], ['xtree', 0], ['flood', 0], ['tmap', 0]], 'decor and bulb colours survive a reload');
  eq(g.errors, [], 'no page errors');
}
