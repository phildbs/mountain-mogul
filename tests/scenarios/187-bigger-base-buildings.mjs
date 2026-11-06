// Rental shops, ski schools and kids' camps come in three sizes, each its own card in the build menu, with
// models in every style. Lessons gently grow the crowd's ability; it fades by half each season and saves.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter);
  await g.ev(`state.cash = 1e7; updateCash(false)`);

  // the build menu: three cards each, priced and sized
  const menu = await g.ev(`(() => { setTool('bld'); const out = {};
    for (const tab of ['shops', 'services']) { state.bTab = tab; try { localStorage.setItem('mm.bTab', tab); } catch (e) {} }
    for (const k of ['rental', 'school', 'kids']) out[k] = [0, 1, 2].map((t) => [sizeCost(k, t), tierName(BTYPES[k], BTYPES[k].tiers[t])]);
    setTool('explore'); return out; })()`);
  eq(menu, {
    rental: [[60000, 'Rental shop'], [120000, 'Big rental shop'], [240000, 'Rental hall']],
    school: [[75000, 'Ski school'], [160000, 'Ski and ride school'], [300000, 'Snowsports center']],
    kids: [[140000, 'Kids’ camp'], [280000, 'Kids’ center'], [480000, 'Kids’ village']],
  }, 'three sizes each, with their prices and names');
  const html = await g.ev(`(() => { setTool('bld'); const h = BGROUPS.map((gr) => gr[0]); return h; })()`);
  assert(html.length > 0, 'build menu groups');

  // place a large one of each near the lodge
  const placed = await g.ev(`(() => { const L = world.buildings.find((b) => b.type === 'lodge'), out = {};
    for (const type of ['rental', 'school', 'kids']) {
      let done = false;
      for (let r = 6; r < 40 && !done; r += 0.5) for (let a = 0; a < 32 && !done; a++) {
        const x = L.x + Math.cos(a / 32 * 6.283) * r, z = L.z + Math.sin(a / 32 * 6.283) * r, i = evalBuilding(type, x, z, L.rot, false, null, null, 2);
        if (i && !(i.problems || []).length) { i.tier = 2; commitBuilding(i, type, x, z, L.rot, 'scandi'); computeNetwork(); done = true; }
      }
      const B = world.buildings.filter((b) => b.type === type).at(-1);
      out[type] = B ? [B.tier, B.style, bspec(B).stations || bspec(B).classes || bspec(B).campers] : null;
    }
    setTool('explore'); return out; })()`);
  eq(placed, { rental: [2, 'scandi', 36], school: [2, 'scandi', 28], kids: [2, 'scandi', 300] }, 'large ones placed, in the Scandinavian style, with their capacity');
  const sheet = await g.ev(`(() => { select({ kind: 'bld', obj: world.buildings.find((b) => b.type === 'school' && b.tier === 2) }); return $('sheet').innerText; })()`);
  assert(/28 instructors/.test(sheet) && /Beginners who take lessons/.test(sheet), 'the school card shows its size and what lessons do');

  // every size draws in every style without errors
  const models = await g.ev(`(() => { let n = 0; for (const type of ['rental', 'school', 'kids']) for (const st of [undefined, 'modern', 'scandi']) for (let t = 0; t < 3; t++) { const k = modelFor(type, st)(t); if (k.parts.length > 5) n++; } return n; })()`);
  eq(models, 27, 'all 27 models build');

  // lessons: a gentle nudge to the crowd, capped, saved, fading by half each season
  const nudge = await g.ev(`(() => { const mix = MOUNTAIN.skiers.slice(); state.grads = 0; const s0 = lessonShift();
    state.grads = 6000; const s1 = lessonShift(); state.grads = 1e7; const s2 = lessonShift();
    state.grads = 6000; let beg = 0; for (let i = 0; i < 40000; i++) if (drawAbility() === 0) beg++;
    return { s0, s1: +s1.toFixed(3), s2: +s2.toFixed(3), beg: +(beg / 40000).toFixed(2), want: +(mix[0] - s1).toFixed(2) }; })()`);
  eq(nudge.s0, 0, 'no lessons, no change');
  assert(nudge.s1 > 0.02 && nudge.s1 < 0.03, `a season of a busy school moves about 2.5% of the crowd (${nudge.s1})`);
  assert(nudge.s2 <= 0.05, `capped at 5% (${nudge.s2})`);
  assert(Math.abs(nudge.beg - nudge.want) <= 0.01, `fewer beginners turn up (${nudge.beg} vs ${nudge.want})`);
  const saved = await g.ev(`(() => { state.grads = 6000; const sv = JSON.parse(JSON.stringify(saveData(false))); state.grads = 0; applySave(sv); afterLoad(); return state.grads; })()`);
  eq(saved, 6000, 'lessons taught are saved');
  eq(await g.ev(`(() => { newSeason(); return state.grads; })()`), 3000, 'halved each new season');
  // lessons count up as they're taught
  await g.ev(SETUPS.midwinter); await g.ev(`state.grads = 0; openDay()`);
  await g.ev(`(() => { let k = 0; while (state.phase === 'open' && k < 90000) { simStep(1.5); k++; } })()`);
  const taught = await g.ev(`[state.grads, world.buildings.filter((B) => B.type === 'school').reduce((a, B) => a + ((B.yday || B.today || {}).visits || 0), 0)]`);
  assert(taught[0] > 0, `a day of lessons counts (${taught[0]})`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
