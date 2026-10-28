// Food and drink: a food truck at the top of the lift, a café and fine dining at the base. Each feeds
// guests in its own way, has its own price, and shows in the build menu and Prices panel.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  // the build menu lists the new places, and parking (on the Transport tab)
  await g.ev(`setTool('bld')`); await g.wait(100);
  const menu = await g.ev(`$('sheet').textContent`);
  for (const w of ['Food truck', 'Café', 'Casual restaurant', 'Fine dining', 'Parking']) assert(menu.includes(w), `build menu offers ${w}`);
  await g.ev(`setTool('explore')`);
  const placed = await g.ev(`(() => { const out = [], top = world.lifts[0].b, L = world.buildings[0];
    const put = (type, cx, cz, spots) => { for (const [dx, dz] of spots) for (const r of [0, 1, 2, 3]) {
      const b = evalBuilding(type, cx + dx, cz + dz, r);
      if (!b.problems.length) { commitBuilding(b, type, cx + dx, cz + dz, r); computeNetwork(); syncLabels(); out.push(type); return; } } };
    put('truck', top.x, top.z, [[0,-5],[1,-5],[-1,-5],[0,-6]]);
    const near = [[7,0],[-7,0],[0,7],[12,0],[-12,0],[7,7],[-7,7],[16,2],[-16,2],[0,12],[10,10],[-10,10]];
    put('cafe', L.x, L.z, near); put('fine', L.x, L.z, near);
    return out; })()`);
  eq(placed, ['truck', 'cafe', 'fine'], 'all three placed');
  // a full day
  await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
  const r = await g.ev(`(() => { const by = (t) => world.buildings.find((B) => B.type === t).yday; return { truck: by('truck'), cafe: by('cafe'), fine: by('fine'), rev: state.lastReport.rev }; })()`);
  assert(r.truck.visits > 20, `the truck sold snacks (${r.truck.visits})`);
  assert(r.cafe.visits > 20, `the café was busy (${r.cafe.visits})`);
  assert(r.fine.revenue > 0, `fine dining served meals (${r.fine.revenue})`);
  assert(r.rev.dining >= r.fine.revenue, 'fine dining counts as restaurant revenue');
  // each has its own price
  await g.click('#rpNext'); await g.wait(100);
  await g.ev(`openManage('prices'); $('pricesDetails').open = true; pricesOpen = true; renderSheet()`); await g.wait(100);
  const prices = await g.ev(`$('sheet').innerText`);
  assert(/Snack \(truck, café\)/i.test(prices) && /Fine dining meal/i.test(prices), 'snack and fine dining prices are set in the Prices panel');
  eq(await g.ev(`[svcRef('snack'), svcRef('finedine')]`), [11, 85], 'guests compare against $11 snacks and $85 fine dining');
  // food places can run lunch-only from an operations plan
  eq(await g.ev(`lunchOnlyOk(world.buildings.find((B) => B.type === 'truck'))`), true, 'a truck can open for lunch only');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
