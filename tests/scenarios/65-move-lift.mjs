// Move a lift: overnight, drag either station somewhere new. The lift keeps its id, name and type;
// it costs a quarter of the lift plus any extra length and trees; trails left behind are flagged;
// cancelling leaves it untouched, and Ctrl+Z puts it back.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 2e6`);
  const L0 = await g.ev(`(() => { const L = world.lifts[0]; return { id: L.id, name: L.name, type: L.type, a: { ...L.a }, b: { ...L.b }, cost: L.cost, len: L.stats.lenFt }; })()`);

  // the lift panel offers it overnight
  await g.ev(`select({ kind: 'lift', obj: world.lifts[0] })`); await g.wait(50);
  assert(await g.ev(`!!document.querySelector('#sheet [data-action=moveLift]')`), 'Move a station on the lift panel');
  await g.click('#sheet [data-action=moveLift]'); await g.wait(100);
  eq(await g.ev(`[state.tool, draft.movingLift === world.lifts[0], draft.pts.length, world.lifts[0].group.visible]`), ['lift', true, 2, false], 'the lift tool opens with both stations placed');
  assert(/Move /i.test(await g.ev(`$('sheet').innerText`)) && await g.ev(`$('sheet').querySelector('[data-action=build]').disabled`), 'nothing to pay until a station moves');
  eq(await g.ev(`$('undoFab').hidden`), true, 'no undo-point button while moving');

  // cancelling leaves it as it was
  await g.ev(`(() => { draft.pts[1] = { x: draft.pts[1].x, z: draft.pts[1].z - 8 }; draft.dirty = true; recomputeDraft(); })()`);
  await g.page.keyboard.press('Escape'); await g.wait(100);
  eq(await g.ev(`(() => { const L = world.lifts[0]; return [state.tool, L.b.x, L.b.z, L.group.visible, !!draft.movingLift]; })()`), ['explore', L0.b.x, L0.b.z, true, false], 'Esc cancels: the lift stays put and shows again');

  // dragging a station with the mouse: the handle goes with it
  await g.ev(`select({ kind: 'lift', obj: world.lifts[0] }); startLiftMove(world.lifts[0])`); await g.wait(200);
  const h = await g.ev(`(() => { const r = draft.pts[1].el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await g.page.mouse.move(h.x, h.y); await g.page.mouse.down();
  for (let i = 1; i <= 8; i++) { await g.page.mouse.move(h.x, h.y - i * 6); await g.wait(20); }
  await g.page.mouse.up(); await g.wait(200);
  const dragged = await g.ev(`(() => { const p = draft.pts[1], r = p.el && p.el.getBoundingClientRect(); return { moved: !!(draft.info && draft.info.moved), el: !!p.el, y: r ? Math.round(r.y + r.height / 2) : null }; })()`);
  assert(dragged.moved && dragged.el && dragged.y < h.y - 20, `the dragged station's handle follows it: ${JSON.stringify(dragged)} from ${JSON.stringify(h)}`);
  await g.click('#sheet [data-action=liftMoveReset]'); await g.wait(100);
  eq(await g.ev(`draft.info.moved`), false, 'Put it back returns both stations');

  // extend the top station further up the mountain: find a spot the lift accepts
  const info = await g.ev(`(() => { const L = world.lifts[0];
    for (let d = 6; d <= 30; d += 1) for (const sx of [0, 2, -2, 4, -4]) {
      draft.pts[1] = { x: L.b.x + sx, z: L.b.z - d }; draft.dirty = true; recomputeDraft();
      const i = draft.info; if (i.moved && !i.problems.length && i.extra > 0) return { fee: i.fee, extra: i.extra, trees: i.treeSet.size * TREE_COST, cost: i.cost, cut: i.cut.length, b: { x: draft.pts[1].x, z: draft.pts[1].z } };
    }
    return null; })()`);
  assert(info, 'found a longer line for the lift');
  eq(info.fee, Math.max(5000, Math.round(L0.cost * 0.25 / 1000) * 1000), 'the move fee is a quarter of what the lift cost');
  eq(info.cost, info.fee + info.extra + info.trees, 'cost is the fee, the extra length and the trees');
  assert(info.cut === 2, `both trails from the old top are flagged (${info.cut})`);
  assert(/no longer connect/.test(await g.ev(`$('sheet').innerText`)), 'the panel warns about the cut-off trails');
  const cash0 = await g.ev(`state.cash`);
  await g.click('#sheet [data-action=build]'); await g.wait(150);
  const after = await g.ev(`(() => { const L = world.lifts[0]; return { n: world.lifts.length, id: L.id, name: L.name, type: L.type, a: L.a, b: L.b, cost: L.cost, len: L.stats.lenFt, vis: L.group.visible, tool: state.tool, sel: selected && selected.obj === L }; })()`);
  eq([after.n, after.id, after.name, after.type], [1, L0.id, L0.name, L0.type], 'same lift: id, name and type kept');
  eq([after.a, after.b], [L0.a, info.b], 'the bottom stays, the top moves');
  assert(after.len > L0.len, `longer now (${L0.len} → ${after.len} ft)`);
  eq(after.cost, L0.cost + info.extra, 'the extra length adds to what the lift is worth');
  eq(await g.ev(`state.cash`), cash0 - info.cost, 'charged the move');
  eq([after.vis, after.tool, after.sel], [true, 'explore', true], 'back to the lift panel');
  eq(await g.ev(`saveData(false).world.lifts[0].b`), info.b, 'saved in its new spot');

  // Ctrl+Z puts it back, with the money
  await g.page.keyboard.press('Control+z'); await g.wait(200);
  eq(await g.ev(`[world.lifts[0].b, Math.round(state.cash)]`), [L0.b, Math.round(cash0)], 'undo moves it back and refunds');

  // not while the resort is open
  await g.ev(`(() => { openDay(); select({ kind: 'lift', obj: world.lifts[0] }); })()`); await g.wait(50);
  eq(await g.ev(`!!document.querySelector('#sheet [data-action=moveLift]')`), false, 'no moving while open');
  await g.ev(`startLiftMove(world.lifts[0])`);
  eq(await g.ev(`!!draft.movingLift`), false, 'and it can’t be started');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
