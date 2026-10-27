// Buying land: parcels round the property come up after the first week open. Buy or lease overnight,
// permits take three days, then the parcel is yours to build on (and its trees are yours to clear).
// Leases are paid nightly and reported; a lease can be handed back while nothing stands on it.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 5e6`);

  eq(await g.ev(`[PARCELS.length, PARCELS.filter((p) => p.corner).length]`), [24, 4], '24 parcels, four of them corners');
  eq(await g.ev(`['S0', 'S1', 'S2', 'SW'].map((id) => parcelInfo(PARCELS.find((p) => p.id === id)).kind)`), ['road', 'road', 'road', 'road'], 'the parcels along the road are road frontage');
  eq(await g.ev(`parcelInfo(PARCELS.find((p) => p.id === 'N2')).kind`), 'mountain', 'up top is mountain');

  // locked until the first week open
  await g.ev(`(() => { state.seasonStats.days = 2; openManage('land'); })()`); await g.wait(100);
  assert(/after your first week open: 5 more open days/.test(await g.ev(`$('sheet').innerText`)), 'locked, with days to go');
  eq(await g.ev(`(() => { landTake('S2', 'buy'); return state.land.length; })()`), 0, 'and no deals yet');
  await g.ev(`(() => { state.seasonStats.days = 7; renderSheet(); })()`); await g.wait(100);
  assert(/Road frontage/i.test(await g.ev(`$('sheet').innerText`)), 'then the parcels are listed');
  await g.wait(200);
  assert(await g.ev(`landTagEls.size`) === 24, 'with a tag for each on the map');

  // a spot on South 3 (S2) that isn't yours yet
  const spot = await g.ev(`(() => { const p = PARCELS.find((q) => q.id === 'S2'); return { x: (p.i0 + p.i1) / 2 - HALF, z: (p.j0 + p.j1) / 2 - HALF }; })()`);
  eq(await g.ev(`inProperty(${spot.x}, ${spot.z})`), false, 'not yours before');
  assert(/property/.test(await g.ev(`evalBuilding('cafe', ${spot.x}, ${spot.z}, 0, false).problems.join(' ')`)), 'so nothing can be built there');

  // buy it
  const price = await g.ev(`landPrice(PARCELS.find((p) => p.id === 'S2'))`);
  const cash0 = await g.ev(`state.cash`);
  await g.ev(`(() => { landSel = 'S2'; renderSheet(); })()`); await g.wait(50);
  await g.click('#sheet [data-action=landBuy]'); await g.wait(100);
  eq(await g.ev(`state.cash`), cash0 - price, 'paid the price');
  eq(await g.ev(`state.land`), [{ id: 'S2', own: 'buy', wait: 3, price, rent: 0 }], 'permits pending');
  eq(await g.ev(`inProperty(${spot.x}, ${spot.z})`), false, 'not yours until the permits come through');
  const next = await g.ev(`landPrice(PARCELS.find((p) => p.id === 'S1'))`);
  eq(next, Math.round(price * 1.15 / 10000) * 10000, 'the next parcel costs 15% more');

  // lease another
  const lp = await g.ev(`landPrice(PARCELS.find((p) => p.id === 'W2'))`);
  await g.ev(`landTake('W2', 'lease')`);
  eq(await g.ev(`state.land[1]`), { id: 'W2', own: 'lease', wait: 3, price: lp, rent: Math.round(lp * 0.0015 / 10) * 10 }, 'a lease: nothing up front');
  // a corner needs a neighbour first
  eq(await g.ev(`[landReachable(PARCELS.find((p) => p.id === 'NE')), landReachable(PARCELS.find((p) => p.id === 'SW'))]`), [false, false], 'corners wait for a neighbour');

  // three nights: permits through
  for (let i = 0; i < 3; i++) await g.ev(`nextDay()`);
  eq(await g.ev(`state.land.map((l) => l.wait)`), [0, 0], 'permits approved');
  eq(await g.ev(`[inProperty(${spot.x}, ${spot.z}), LAND.j1, ownedAcres() > 632]`), [true, 208, true], 'the land is yours, and the acres go up');
  eq(await g.ev(`landReachable(PARCELS.find((p) => p.id === 'SW'))`), false, 'SW still needs S0 or W4');
  eq(await g.ev(`(() => { const p = PARCELS.find((q) => q.id === 'S2'); let n = 0, on = 0; for (let k = 0; k < trees.n; k++) if (inRect(p, trees.x[k] + HALF, trees.z[k] + HALF)) { n++; on += trees.play[k]; } return n === on; })()`), true, 'its trees are yours to clear');
  const built = await g.ev(`(() => { for (let dz = 0; dz < 6; dz++) for (let dx = -10; dx <= 10; dx += 2) { const x = ${spot.x} + dx, z = ${spot.z} + dz - 3, v = evalBuilding('cafe', x, z, 0, false); if (!v.problems.length) { commitBuilding(v, 'cafe', x, z, 0); computeNetwork(); return world.buildings[world.buildings.length - 1].name; } } return null; })()`);
  assert(built, 'a café goes up on the new land');

  // the lease is paid nightly and shows on the report
  const rent = await g.ev(`state.land[1].rent`);
  await g.ev(`nextDay()`);
  eq(await g.ev(`state.leaseAcc`), rent, 'a night of rent');
  await g.ev(`(() => { openDay(); })()`); await g.ev(SETUPS.finishDay);
  eq(await g.ev(`state.lastReport.exp.lease`), rent, 'reported as land lease');
  assert(/Land lease/i.test(await g.ev(`document.querySelector('#report').innerText`)), 'on the report');
  await g.ev(`(() => { $('report').hidden = true; nextDay(); })()`);

  // handing back the lease, and saving
  eq(await g.ev(`(() => { landEndLease('W2'); return state.land.map((l) => l.id); })()`), ['S2'], 'an empty lease can be handed back');
  eq(await g.ev(`inProperty((PLAY0 - 8) - HALF, (PLAY0 + 80) - HALF)`), false, 'and it is no longer yours');
  eq(await g.ev(`(() => { const sv = JSON.parse(JSON.stringify(saveData(false))); applySave(sv); return [state.land.map((l) => l.id), inProperty(${spot.x}, ${spot.z}), world.buildings.some((B) => B.name === ${JSON.stringify(built)})]; })()`), [['S2'], true, true], 'saved and loaded, with the café still standing');
  // undo of a fresh deal gives the money back
  const c1 = await g.ev(`state.cash`);
  await g.ev(`landTake('S1', 'buy')`);
  await g.ev(`undoLast()`);
  eq(await g.ev(`[state.land.map((l) => l.id), Math.round(state.cash)]`), [['S2'], Math.round(c1)], 'undo calls it off');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
