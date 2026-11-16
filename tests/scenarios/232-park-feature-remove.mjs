// Removing terrain park features (MisguidedSoul, Nov 16: cruisers complained about features, and there seemed to be no
// way to remove them). Tapping a feature on the map opens its card; overnight it moves or goes at once; while the resort
// is open, Remove it tonight marks it, it stays for the day, and it goes overnight with 25% back. Keep it undoes that.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 5e6`);
  // a small jump and a box on the first trail
  await g.ev(`(() => { const t = realTrails()[0]; t.feats.push({ id: world.nextId++, type: 'jump', at: 0.35, off: 0 }, { id: world.nextId++, type: 'box', at: 0.6, off: 0 }); buildFeats(t); })()`);
  // tap one on the map, the way a player would
  const tapFeat = (k) => g.ev(`(() => { setTool('explore'); select(null); const sp = realTrails()[0].fx[${k}], c = featPt(sp, 0, 0), y = heightAt(c.x, c.z);
    cam.target.x = c.x; cam.target.z = c.z; updateCamera(); camera.updateMatrixWorld(); const q = project(c.x, y, c.z); onTap(q.x, q.y, 'mouse');
    return { tool: state.tool, sel: parkDraft.sel && parkDraft.sel.f.type, text: $('sheet').innerText }; })()`);
  const night = await tapFeat(0);
  eq([night.tool, night.sel], ['tpark', 'jump'], 'tapping a feature on the map opens its card');
  assert(/Move/.test(night.text) && /Remove this small jump/i.test(night.text), `overnight it offers Move and Remove: ${night.text}`);
  // while open: Remove it tonight marks it; it stays for the day
  await g.ev(`openDay(); state.speed = 0`);
  const day = await tapFeat(1);
  eq(day.sel, 'box', 'during the day too');
  assert(/Remove it tonight/.test(day.text) && !/Move ·/.test(day.text), `during the day it offers Remove it tonight: ${day.text}`);
  const cash0 = await g.ev(`state.cash`);
  await g.click('#sheet [data-action="parkRemove"]');
  eq(await g.ev(`[realTrails()[0].feats.length, realTrails()[0].feats.filter((f) => f.rm).length, state.cash]`), [2, 1, cash0], 'marked, still there today, nothing paid yet');
  assert(/Removed tonight/.test(await g.ev(`$('sheet').innerText`)), 'its card says it goes tonight');
  // Keep it after all, then remove it again
  await g.click('#sheet [data-action="parkRemove"][data-v="keep"]');
  eq(await g.ev(`realTrails()[0].feats.filter((f) => f.rm).length`), 0, 'keep it after all');
  await g.click('#sheet [data-action="parkRemove"]');
  // the mark is saved with the resort
  eq(await g.ev(`saveData(true).world.trails[0].feats.filter((f) => f.rm).length`), 1, 'the mark is saved');
  assert(/1 removed tonight/.test(await g.ev(`(() => { setTool('explore'); select({ kind: 'trail', obj: realTrails()[0] }); return $('sheet').innerText; })()`)), 'the trail card says so');
  // overnight it goes, with 25% back
  await g.ev(SETUPS.finishDay); await g.ev(`nextDay()`); await g.wait(300);
  const after = await g.ev(`(() => { const t = realTrails()[0]; return { types: t.feats.map((f) => f.type), fx: t.fx.length, rm: t.feats.some((f) => f.rm) }; })()`);
  eq(after, { types: ['jump'], fx: 1, rm: false }, 'the box went overnight; the jump stays');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
