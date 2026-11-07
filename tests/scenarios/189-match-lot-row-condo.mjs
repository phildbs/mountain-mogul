// From Snowy and mswoeb (Nov 6). 1) On the match maps the access road climbs to the main lot right where its second row goes, so
// "A row below" always said the road was in the way. The second row now sits a little further along, clear of the
// road, with its own drive. 2) Condo home sales no longer count as match profit (cash, yes; profit, no). 3) Fair Ridgeline valleys.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
import { pagePlay } from '../../match/market.mjs';
export default async function ({ browser, url }) {
  for (const q of ['?matchMap=1', '?matchMap=ridge', '?matchMap=valley']) {
    const m = await openGame(browser, url, { query: q, mountain: 'fresh' });
    await m.ev(SETUPS.juniperStarter);
    const r = await m.ev(`(() => { state.cash = 1e7; const before = lotGrowBlock(1);
      state.land = PARCELS.map((P) => ({ id: P.id, own: 'buy', wait: 0, price: 0, rent: 0 })); applyLand();
      const shift = rowShift(0), why = lotGrowBlock(1); growLot(1);
      const bb = slotBox(1, 0), fs = footprintStats(bb), row1 = stalls.filter((s) => s.row), p = carPath(row1[0]);
      return { before, shift, why, secs: state.lotSections, layout: state.lotLayout, road: fs.road, n: row1.length, toEntry: p.some((q) => q.x === row1[0].entry.x && q.z !== row1[0].entry.z) }; })()`);
    assert(/Buy the land/.test(r.before || ''), `${q}: before the land below is bought, it says to buy it (${r.before})`);
    assert(r.shift > 0, `${q}: the second row moves clear of the road (${r.shift})`);
    eq([r.why, r.secs, r.layout, r.road], [null, 2, [[0, 0], [1, 0]], false], `${q}: with the land bought, a second row is built, off the road`);
    assert(r.n === 96 && r.toEntry, `${q}: its 96 stalls are reached across the gap to their own drive`);
    eq(m.errors, [], `${q}: no page errors`);
    await m.page.close();
  }
  // From mswoeb (Nov 6): Ridgeline's first valley had 3% black ground and no expert ground, against 10 to 14% and 1 to
  // 5% in the others. Every valley now has a fair share of both.
  { const v = await openGame(browser, url, { query: '?mapView=ridge', mountain: 'fresh' }); await v.wait(3000);
    const mix = await v.ev(`viewStats().map((s) => [s.mix[2] / s.cells * 100, s.mix[3] / s.cells * 100].map((x) => +x.toFixed(1)))`);
    assert(mix.every(([b, x]) => b >= 7 && x >= 1), `every Ridgeline valley has black (7%+) and expert (1%+) ground (${JSON.stringify(mix)})`);
    eq(v.errors, [], 'map viewer: no page errors'); await v.page.close(); }
  // Single-player mountains keep their second row where it always was.
  const s = await openGame(browser, url, { mountain: 'juniper' });
  eq(await s.ev('rowShift(0)'), 0, 'Juniper Ridge: the second row is where it was');
  await s.page.close();
  // A match day with a condo home sold: the money is in cash, but not in the day's profit.
  const g = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const id = await g.ev(`(() => { state.cash = 1e7;
    for (let z = 57; z <= 75; z++) for (let x = -30; x <= 40; x++) for (const r of [0, 1, 2, 3]) {
      const b = evalBuilding('condo', x, z, r, false, null, null, 2); if (b.problems.length) continue;
      const C = commitBuilding(b, 'condo', x, z, r, 'modern'); computeNetwork(); return C.id; }
    return null; })()`);
  assert(id, 'a row of townhomes at the base');
  await g.ev(`(() => { const own = condoMorning; condoMorning = function (...a) { const C = bldById(${id}); if (!C.sold) { C.sold = 1; C.sales = 250000; state.cash += 250000; } return own.apply(this, a); }; window.__cash0 = state.cash - (state.debt || 0); })()`);
  const res = await g.ev(pagePlay(200, 0));
  const delta = await g.ev(`Math.round(state.cash - (state.debt || 0) - window.__cash0)`);
  eq(await g.ev(`bldById(${id}).sales`), 250000, 'a home sold during the match day');
  eq(res.condo, 250000, 'the day reports the condo sale');
  eq(res.profit, delta - 250000, 'and its profit leaves the sale out (the cash still has it)');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
