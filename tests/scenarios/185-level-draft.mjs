// Leveling is a draft: strokes show tinted with a running price, step back one at a time, compare before and after,
// put back exactly, or keep (one step for Undo). Leaving the tool asks; matches level straight away as before.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
const trees = `Array.from(trees.alive).reduce((a, b) => a + b, 0)`;
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(800);
  await g.ev(SETUPS.juniperStarter);
  await g.ev(`(() => { state.landMode = 'level'; setTool('clear'); sheetSize('min'); cam.target.set(-25, heightAt(-25, 30), 30); updateCamera(); })()`);
  const ht = `Array.from(HT)`, diff = (a, b) => a.reduce((m, v, k) => Math.max(m, Math.abs(v - b[k])), 0);
  const s0 = await g.ev(`({ cash: state.cash, trees: ${trees}, cleared: state.cleared, undo: undoStack.length })`), h0 = await g.ev(ht);

  // a real mouse stroke starts the draft
  const p = await g.ev(`(() => { const p = project(-25, heightAt(-25, 30), 30); return { x: p.x, y: p.y, canvas: document.elementFromPoint(p.x, p.y) === canvas }; })()`);
  assert(p.canvas, 'the leveling spot is on the real canvas');
  await g.page.mouse.move(p.x, p.y); await g.page.mouse.down(); await g.page.mouse.move(p.x + 60, p.y + 10, { steps: 10 }); await g.page.mouse.up();
  const d1 = await g.ev(`({ steps: levelDraft && levelDraft.steps.length, cost: levelDraft && levelDraft.cost, cash: state.cash, undo: undoStack.length, btn: !$('tUndo').disabled,
    keep: !!$('sheet').querySelector('[data-action=levelKeep]'), tinted: (() => { const c = terrainGeo.attributes.color.array; let n = 0;
      for (let k = 0; k < HT.length; k++) if (Math.abs(HT[k] - levelDraft.ht0[k]) > 0.2 && c[k * 3] > c[k * 3 + 2] + 0.15) n++; return n; })() })`);
  eq(d1.steps, 1, 'one stroke in the draft');
  assert(d1.cost > 0 && Math.abs(s0.cash - d1.cash - d1.cost) < 1, `the stroke's price shows and is held (${d1.cost})`);
  eq(d1.undo, s0.undo, 'no whole-resort snapshot per stroke');
  assert(d1.btn && d1.keep, 'Undo stroke and Keep are offered');
  assert(d1.tinted > 5, `changed ground is tinted (${d1.tinted} points)`);
  const h1 = await g.ev(ht);
  assert(diff(h1, h0) > 0.3, 'the ground moved');

  // a second stroke, higher, then step it back
  const stroke2 = `(() => { levelStep(); stroke.active = true; stroke.target = trueY(-25, 36) + 3;
    for (let x = -32; x <= -18; x++) strokeTo(new THREE.Vector3(x, heightAt(x, 36), 36)); endStroke(); })()`;
  await g.ev(stroke2);
  eq(await g.ev(`levelDraft.steps.length`), 2, 'second stroke');
  await g.click('[data-action=levelUndo]'); await g.wait(100);
  eq(diff(await g.ev(ht), h1) < 1e-4, true, 'Undo stroke puts back just the last stroke, exactly');
  eq(Math.round(await g.ev(`state.cash`)), Math.round(d1.cash), 'and refunds it');

  // before and after
  await g.click('[data-action=levelBefore][data-v="1"]'); await g.wait(50);
  eq(diff(await g.ev(ht), h0) < 1e-4, true, 'Before shows the ground as it was');
  await g.click('[data-action=levelBefore][data-v="0"]'); await g.wait(50);
  eq(diff(await g.ev(ht), h1) < 1e-4, true, 'After shows it again');

  // put it all back: ground, trees, money exactly as before
  await g.ev(stroke2);
  await g.click('[data-action=levelCancel]'); await g.wait(100);
  const c = await g.ev(`({ cash: state.cash, trees: ${trees}, cleared: state.cleared, undo: undoStack.length, draft: levelDraft })`);
  eq(diff(await g.ev(ht), h0) < 1e-4, true, 'Put it all back restores the ground exactly');
  eq([Math.round(c.cash), c.trees, c.cleared, c.undo, c.draft], [Math.round(s0.cash), s0.trees, s0.cleared, s0.undo, null], 'and the trees and money');

  // keep: one Undo step for the whole draft, tint gone
  await g.ev(stroke2); await g.ev(stroke2);
  const paid = await g.ev(`levelDraft.cost`), h2 = await g.ev(ht);
  await g.click('[data-action=levelKeep]'); await g.wait(100);
  eq(await g.ev(`[levelDraft, undoStack.length]`), [null, s0.undo + 1], 'Keep makes the draft one Undo step');
  assert(/Leveled ground/.test(await g.ev(`$('toast').textContent`)), 'says it was kept');
  eq(diff(await g.ev(ht), h2) < 1e-4, true, 'kept ground stays');
  eq(Math.round(await g.ev(`state.cash`)), Math.round(s0.cash - paid), 'paid once');
  await g.click('#tUndo'); await g.wait(200);
  eq(diff(await g.ev(ht), h0) < 1e-4, true, 'Undo after keeping puts it all back');

  // leaving the tool with a draft asks; Keep editing stays, Put it all back restores
  await g.ev(`(() => { state.landMode = 'level'; setTool('clear'); })()`);
  await g.ev(stroke2);
  await g.click('.sheet [data-action=exitTool]'); await g.wait(50);
  eq(await g.ev(`$('crisis').hidden`), false, 'closing with a draft asks first');
  await g.click('#crKeep'); eq(await g.ev(`[state.tool, !!levelDraft]`), ['clear', true], 'Keep editing stays in the tool');
  await g.click('.sheet [data-action=exitTool]'); await g.wait(50); await g.click('#crNo'); await g.wait(100);
  eq(await g.ev(`[state.tool, levelDraft]`), ['explore', null], 'Put it all back closes the tool');
  eq(diff(await g.ev(ht), h0) < 1e-4, true, 'with the ground back');

  // opening for the day keeps a draft left open
  await g.ev(`(() => { state.landMode = 'level'; setTool('clear'); })()`);
  await g.ev(stroke2);
  const h3 = await g.ev(ht);
  await g.ev(SETUPS.midwinter); await g.ev(`openDay()`);
  eq(await g.ev(`levelDraft`), null, 'opening for the day keeps the draft');
  eq(diff(await g.ev(ht), h3) < 1e-4, true, 'with its ground');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
