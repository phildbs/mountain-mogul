// The shared rules of a match, used by the test runner and the match server alike.

// The town's market: rivals grow it a little (more resorts draw more people to the valley), then each resort's
// draw on its own, price included, decides its share. SHARP > 1 makes a better offer win more than its plain
// share, so undercutting a rival really takes skiers from them. Season pass buyers are shared the same way.
// A resort that was full last time is offered only what it held (cap); the skiers it can't take try the others.
export const GROW = 0.4, SHARP = 1.5;
export function splitSkiers(alone, cap = alone.map(() => Infinity)) {
  const sorted = [...alone].sort((a, b) => b - a), sum = sorted.reduce((a, b) => a + b, 0);
  if (!sum) return alone.map(() => 0);
  const town = sorted[0] + GROW * (sum - sorted[0]), w = alone.map((d) => Math.pow(d, SHARP));
  let out = alone.map(() => 0), left = town;
  const open = alone.map((d) => d > 0);
  for (let pass = 0; pass < alone.length && left > 1; pass++) {
    const W = w.reduce((a, x, k) => a + (open[k] ? x : 0), 0); if (!W) break;
    let spill = 0;
    out = out.map((o, k) => { if (!open[k]) return o; const want = o + left * w[k] / W; if (want > cap[k]) { spill += want - cap[k]; open[k] = false; return cap[k]; } return want; });
    left = spill;
  }
  return out.map(Math.round);
}
// After a day: full means next time it's offered only what it held; not full, it may have grown, so a little more.
export const nextCap = (cap, day) => (day.turnedAway > 0 ? day.guests : Math.min(1e6, (cap ?? 1e6) * 1.15));

// Code run inside a game page (through the test harness's __dbg).
// How many would come to this resort today, and buy its pass, if it were alone in the valley.
export const PAGE_ALONE = `state.phase === 'closed' ? { day: demandForDay(), passes: passesSoldThisSeason() ? 0 : passBuyers(state.passPrice) } : { day: 0, passes: 0 }`;
// Play today with this resort's share of the town's skiers and pass buyers, then go to the next morning.
export const pagePlay = (share, passShare) => `(() => {
  const t0 = performance.now(), before = state.cash - (state.debt || 0), own = demandForDay, ownPass = passBuyers;
  let played = false;
  if (${+share} > 0) { demandForDay = () => ${+share}; passBuyers = () => ${+passShare}; try { openDay(); } finally { demandForDay = own; passBuyers = ownPass; } played = state.phase === 'open'; }
  state.speed = 0; let n = 0;
  while (state.phase === 'open' && n++ < 200000) simStep(1.5);
  const r = played ? state.lastReport : null;
  if (played) nextDay(); else waitDay();
  return { ms: Math.round(performance.now() - t0), guests: r ? r.guests : 0, turnedAway: r ? r.turnedAway || 0 : 0, passes: r ? r.rev.passes || 0 : 0, sat: r ? r.sat : null,
    profit: Math.round(state.cash - (state.debt || 0) - before), wx: r ? r.wx.type + (r.wx.snow ? ' ' + r.wx.snow + 'in' : '') : 'closed' };
})()`;
// A player's orders, applied overnight in the order sent. Each comes back ok, or with the reason it failed.
// Prices: ticket, peak ticket (null for none) and season pass. Builds: a lift, a trail or a building, checked by
// the game's own rules and paid for from the resort's cash (no loans). Anything else isn't supported yet.
export const pageOrders = (orders) => `(() => {
  const out = [];
  for (const o of ${JSON.stringify(orders)}) {
    try {
      const p = o.payload || {};
      if (o.kind === 'price') {
        if (p.ticket != null) state.ticket = clamp(Math.round(+p.ticket) || 0, 0, 500);
        if (p.ticketPeak !== undefined) state.ticketPeak = p.ticketPeak == null ? null : clamp(Math.round(+p.ticketPeak) || 0, 0, 500);
        if (p.pass != null) state.passPrice = clamp(Math.round(+p.pass) || 0, 0, 5000);
        if (p.prices && typeof p.prices === 'object') for (const [k, v] of Object.entries(p.prices)) if (k in state.prices && Number.isFinite(+v)) state.prices[k] = clamp(Math.round(+v), 0, 1000);
      } else if (o.kind === 'build') {
        const pay = (i) => { if (i.cost > state.cash) throw new Error('not enough cash'); };
        if (p.what === 'lift') {
          const i = evalLift(p.a, p.b, p.type); if (i.problems.length) throw new Error(i.problems[0]); pay(i); commitLift(i, p.type);
        } else if (p.what === 'trail') {
          const pts = p.pts.map((q) => ({ x: q.x, z: q.z, y: heightAt(q.x, q.z) })), i = evalTrail(pts, p.width || 'medium');
          if (i.an.problems.length) throw new Error(i.an.problems[0]); pay(i); commitTrail(i, pts, p.width || 'medium');
        } else if (p.what === 'building') {
          const i = evalBuilding(p.type, p.x, p.z, p.rot || 0); if (!i || i.problems.length) throw new Error(i ? i.problems[0] : 'unknown building'); pay(i); commitBuilding(i, p.type, p.x, p.z, p.rot || 0);
        } else if (p.what === 'lot') {
          const n = state.lotSections; if (state.cash < LOT_EXPAND_COST) throw new Error('not enough cash');
          growLot(p.row ?? null, p.lot || 0); if (state.lotSections === n) throw new Error('the parking lot can’t grow there');
        } else throw new Error('unknown build');
        computeNetwork();
      } else throw new Error('not supported yet');
      out.push({ id: o.id, ok: true });
    } catch (e) { out.push({ id: o.id, ok: false, error: String(e.message || e).slice(0, 200) }); }
  }
  return out;
})()`;
// A small summary for the league table.
export const PAGE_SUMMARY = `({ cash: Math.round(state.cash), debt: Math.round(state.debt || 0), rep: +state.reputation.toFixed(3), ticket: state.ticket, pass: state.passPrice,
  lifts: world.lifts.length, trails: realTrails().length, buildings: world.buildings.length, day: state.day })`;
