// From player ideas (Adum888, Aspen Heights): "sort buildings by profit of last day, cluster by type" and
// "heat-map for buildings, from not profitable to very profitable, scaled by building type or overall".
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter);
  const made = await g.ev(`(() => {
    state.cash = 1e8; select(null);
    const put = (type) => { const L = world.lifts[0]; for (let r = 6; r < 40; r += 1.5) for (let a = 0; a < 6.28; a += 0.4) { const x = L.a.x + Math.cos(a) * r, z = L.a.z + Math.sin(a) * r, v = evalBuilding(type, x, z, 0); if (!v.problems.length) { commitBuilding(v, type, x, z, 0); computeNetwork(); return world.buildings[world.buildings.length - 1]; } } return null; };
    const add = [put('cafe'), put('cafe'), put('truck'), put('restroom')];
    // Last day's takings, made up so the order is known.
    const p = { cafe: [900, -300], truck: [150], restroom: [-120] }, seen = {};
    for (const B of realBlds()) { const k = seen[B.type] = (seen[B.type] || 0); seen[B.type]++; B.yday = { visits: 10, revenue: 0, profit: (p[B.type] || [])[k] ?? (B.type === 'lodge' ? 2000 : -50), services: {} }; }
    syncLabels();
    return { added: add.filter(Boolean).length, types: realBlds().map((B) => B.type) };
  })()`);
  eq(made.added, 4, 'two cafés, a food truck and a restroom built');
  // Buildings list: sorted by profit, then grouped by type with each group's total
  await g.ev(`openManage('blds')`); await g.wait(100);
  const names = () => g.ev(`[...document.querySelectorAll('#sheet .llist .lrow[data-k=bld]')].map((li) => bldById(+li.dataset.id).type + ':' + bldProfit(bldById(+li.dataset.id)))`);
  await g.click('[data-action=bldSort]'); await g.wait(50);
  assert(/Sort: Profit/.test(await g.ev(`$('sheet').innerText`)), 'the sort button says Profit');
  const byProfit = await names();
  eq(byProfit.slice(0, 3), ['lodge:2000', 'cafe:900', 'truck:150'], 'best earners first');
  eq(byProfit[byProfit.length - 1], 'restroom:null', 'buildings with no takings of their own go last');
  await g.click('[data-action=bldSort]'); await g.wait(50);
  const groups = await g.ev(`[...document.querySelectorAll('#sheet .lgroup')].map((li) => li.innerText.replace(/\\s+/g, ' ').trim())`);
  const byType = await names();
  eq(byType.indexOf('cafe:900') + 1, byType.indexOf('cafe:-300'), 'the two cafés sit together, the better one first');
  assert(groups.length >= 4 && /lodge/i.test(groups[0]) && groups.some((t) => /Café.*2.*\$600/.test(t)), `a heading per type, best type first, with its total: ${JSON.stringify(groups)}`);
  // Profit map: a disc per earning building; red to green over all buildings, or within each type
  await g.click('[data-action=profitMap]'); await g.wait(50);
  const all = await g.ev(`(() => { refreshProfitMap(); const c = (B) => { const m = profitMarks.children.find((m) => m.userData.B === B); return m && '#' + m.material.color.getHexString(); };
    const f = (t, k) => realBlds().filter((B) => B.type === t)[k];
    return { n: profitMarks.children.length, earning: realBlds().filter((B) => bldProfit(B) != null).length, lodge: c(f('lodge', 0)), badCafe: c(f('cafe', 1)), rr: c(f('restroom', 0)), label: f('cafe', 0).labelEl.innerText }; })()`);
  eq(all.n, all.earning, 'a disc for every building with takings, none for the restroom');
  eq([all.lodge, all.badCafe, all.rr], ['#2c9a55', '#b8402f', undefined], 'over all buildings: the top earner is green, the café that lost most is red');
  assert(/\$900 last day/.test(all.label), `labels show last day’s profit: ${all.label}`);
  await g.click('[data-action=profitMap]'); await g.wait(50);
  const type = await g.ev(`(() => { refreshProfitMap(); const B = realBlds().filter((B) => B.type === 'truck')[0], m = profitMarks.children.find((m) => m.userData.B === B); return '#' + m.material.color.getHexString(); })()`);
  eq(type, '#2c9a55', 'by type: the only food truck, in profit, is green against its own kind');
  await g.click('[data-action=profitMap]'); await g.wait(50);
  eq(await g.ev(`(refreshProfitMap(), profitMarks)`), null, 'a third tap turns the map off');
  // a new day keeps working with the map on
  await g.click('[data-action=profitMap]');
  await g.ev(SETUPS.midwinter); await g.ev(`(() => { openDay(); state.speed = 0; })()`);
  eq(await g.ev(SETUPS.finishDay), 'report', 'a day runs with the profit map on');
  eq(await g.ev(`(refreshProfitMap(), profitMarks.children.length > 0)`), true, 'and the map shows the new day');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
