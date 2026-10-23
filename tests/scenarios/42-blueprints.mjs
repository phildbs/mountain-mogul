// Blueprints: anything can be saved for later, built overnight in the player's order. One that can't be
// afforded holds the line below it; paused ones stay on the map; Build now works overnight.
// Trail colour edges can be turned off for clean trails.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter);
  await g.ev(`state.cash = 60000`);
  // three cafés side by side near the base, saved as blueprints overnight
  const sites = await g.ev(`(() => { const out = []; const e = roadEnd();
    for (let dz = 6; dz < 40 && out.length < 3; dz += 2) for (let dx = -30; dx < 30 && out.length < 3; dx += 2) {
      const x = e.x + dx, z = e.z - dz; if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 7)) continue;
      const v = evalBuilding('cafe', x, z, 0, true); if (!v.problems.length && !v.lotWarn) out.push({ x, z }); }
    return out; })()`);
  eq(sites.length, 3, 'found three café sites');
  await g.ev(`(() => { setTool('bld'); draft.btype = 'cafe'; draft.bpos = ${JSON.stringify(sites[0])}; recomputeBldDraft(); renderSheet(); })()`);
  assert(/Save as a blueprint to build when there’s cash/.test(await g.ev(`$('sheet').innerText`)), 'short of cash, the panel offers a blueprint');
  for (const s of sites) { await g.ev(`(() => { draft.btype = 'cafe'; draft.bpos = ${JSON.stringify(s)}; recomputeBldDraft(); renderSheet(); })()`); await g.click('[data-action=saveBlueprint]'); await g.wait(50); }
  eq(await g.ev(`world.plans.length`), 3, 'three blueprints saved');
  eq(await g.ev(`world.buildings.filter((b) => b.type === 'cafe').length`), 0, 'nothing built yet');
  eq(await g.ev(`state.cash`), 60000, 'and nothing spent');
  await g.ev(`setTool('explore')`);
  assert(!(await g.ev(`$('manage').querySelector('[data-m=plans]').hidden`)), 'the Plans button shows');
  // the list: reorder, pause
  await g.ev(`openManage('plans')`); await g.wait(100);
  eq(await g.ev(`document.querySelectorAll('.plist li').length`), 3, 'the list shows all three');
  const ids = await g.ev(`world.plans.map((p) => p.id)`);
  await g.click(`[data-action=planMove][data-id="${ids[2]}"][data-d="-1"]`); await g.wait(50);
  eq(await g.ev(`world.plans.map((p) => p.id)`), [ids[0], ids[2], ids[1]], 'moving one up changes the order');
  await g.click(`[data-action=planPause][data-id="${ids[0]}"]`); await g.wait(50);
  assert(await g.ev(`world.plans[0].paused`), 'the first is paused');
  assert(/Paused/i.test(await g.ev(`$('sheet').innerText`)), 'and shown as paused');
  // overnight with cash for one café: the next in line (ids[2]) is built, the paused one isn't
  const cafe = await g.ev(`world.plans[1].cost`);
  await g.ev(`state.cash = ${cafe} + 1000; executePlans()`);
  eq(await g.ev(`world.plans.map((p) => p.id)`), [ids[0], ids[1]], 'the next unpaused blueprint was built');
  eq(await g.ev(`world.buildings.filter((b) => b.type === 'cafe').length`), 1, 'one café stands');
  eq(await g.ev(`world.plans[1].short`), true, 'the next one is saving up');
  // the top blueprint, when it can't be afforded, holds the ones below it
  await g.ev(`(() => { pausePlan(world.plans[0], false); state.cash = ${cafe} - 5000; executePlans(); })()`);
  const st = await g.ev(`world.plans.map((p) => ({ short: !!p.short, waiting: !!p.waiting }))`);
  assert(st[0].short && st[1].waiting, `the second waits behind the first being saved for (${JSON.stringify(st)})`);
  assert(/Waiting/i.test(await g.ev(`(openManage('plans'), $('sheet').innerText)`)), 'the list says so');
  eq(await g.ev(`world.buildings.filter((b) => b.type === 'cafe').length`), 1, 'so it isn’t built');
  // build now, overnight, skips the queue
  await g.ev(`state.cash = ${cafe} + 5000; renderSheet()`); await g.wait(100);
  await g.click(`[data-action=planNow][data-id="${ids[1]}"]`); await g.wait(100);
  eq(await g.ev(`world.buildings.filter((b) => b.type === 'cafe').length`), 2, 'Build now builds it');
  // saved and reloaded: order and pause kept
  await g.ev(`(() => { pausePlan(world.plans[0], true); saveNow(); })()`);
  await g.page.reload(); await g.reloaded();
  eq(await g.ev(`world.plans.length`), 1, 'the blueprint is saved');
  assert(await g.ev(`world.plans[0].paused`), 'still paused');
  // trail colour edges
  const colored = () => g.ev(`(() => { const t = realTrails()[0], c = t.mesh.geometry.attributes.color.array; let n = 0; for (let i = 0; i < c.length; i += 3) if (c[i] < 0.95 || c[i + 2] < 0.95) n++; return n; })()`);
  assert(await colored() > 0, 'trails have colour edges by default');
  await g.ev(`$('menuBtn') ? $('menuBtn').click() : 0`); await g.ev(`$('mEdges').click()`); await g.wait(100);
  eq(await colored(), 0, 'turned off, trails are clean');
  eq(await g.ev(`$('mEdgesV').textContent`), 'Off', 'the menu says Off');
  await g.page.reload(); await g.reloaded();
  eq(await colored(), 0, 'and it stays off after reloading');
  await g.ev(`$('mEdges').click()`); await g.wait(100);
  assert(await colored() > 0, 'turned back on');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
