// The shared rules of a match, used by the test runner and the match server alike.

// The town's market: rivals grow it a little (more resorts draw more people to the valley), then each resort's
// draw on its own, price included, decides its share. SHARP > 1 makes a better offer win more than its plain
// share, so undercutting a rival really takes skiers from them. It was 1.5, which turned a resort with 2.4 times the
// draw into one with 3.8 times the skiers from day 1, with no way back (Snowy, Nov 5): 1.2 still rewards the better
// offer. Season passes are bought once, on opening day, for the whole season, so they're shared in plain proportion
// to each resort's draw (PASS_SHARP): a slow first day shouldn't cost a resort a whole season of passes.
// A resort that was full last time is offered only what it held (cap); the skiers it can't take try the others.
export const GROW = 0.4, SHARP = 1.2, PASS_SHARP = 1;
export function splitSkiers(alone, cap = alone.map(() => Infinity), sharp = SHARP) {
  const sorted = [...alone].sort((a, b) => b - a), sum = sorted.reduce((a, b) => a + b, 0);
  if (!sum) return alone.map(() => 0);
  const town = sorted[0] + GROW * (sum - sorted[0]), w = alone.map((d) => Math.pow(d, sharp));
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
// How many would come to this resort today, and buy its pass, if it were alone in the valley (none if its plan keeps it closed today).
export const PAGE_ALONE = `state.phase === 'closed' && !(typeof planShut === 'function' && planShut()) ? { day: demandForDay(), passes: passesSoldThisSeason() ? 0 : passBuyers(state.passPrice) } : { day: 0, passes: 0 }`;
// Play today with this resort's share of the town's skiers and pass buyers, then go to the next morning.
export const pagePlay = (share, passShare) => `(() => {
  const t0 = performance.now(), before = state.cash - (state.debt || 0), own = demandForDay, ownPass = passBuyers, cash0 = Math.round(state.cash), debt0 = Math.round(state.debt || 0);
  let played = false;
  if (${+share} > 0) { demandForDay = () => ${+share}; passBuyers = () => ${+passShare}; try { openDay(); } finally { demandForDay = own; passBuyers = ownPass; } played = state.phase === 'open'; }
  state.speed = 0; let n = 0, next = 0, last = null;
  // How the money moved through the day: [game minute, cash less the morning's] every 5 minutes, and the last moment
  // before the day's wages and upkeep come off. Players watching the day see these, so everyone sees the same figures.
  const money = [];
  while (state.phase === 'open' && n++ < 200000) {
    last = [Math.round(state.time * 10) / 10, Math.round(state.cash - cash0)];
    if (state.time >= next) { money.push(last); next = state.time + 5; }
    simStep(1.5);
  }
  if (last && money[money.length - 1] !== last) money.push(last);
  const r = played ? state.lastReport : null;
  if (played) nextDay(); else waitDay();
  return { ms: Math.round(performance.now() - t0), guests: r ? r.guests : 0, turnedAway: r ? r.turnedAway || 0 : 0, passes: r ? r.rev.passes || 0 : 0, sat: r ? r.sat : null,
    profit: Math.round(state.cash - (state.debt || 0) - before), cash0, debt0, ...(played ? { money } : {}), wx: r ? r.wx.type + (r.wx.snow ? ' ' + r.wx.snow + 'in' : '') : 'closed' };
})()`;
// A player's orders, applied overnight in the order sent. Each comes back ok, or with the reason it failed.
// Prices: ticket, peak ticket (null for none) and season pass. Builds: a lift, a trail or a building, checked by
// the game's own rules and paid for from the resort's cash. Settings, removals, loans, events and the like go
// through the game's matchDo, which presses the same panel button the player did. Anything else isn't supported yet.
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
          // string lights and mesh fences carry their poles or posts (offsets from the first) and their colour
          const chain = Array.isArray(p.pts) && p.pts.length > 1 && typeof isChain === 'function' && isChain(p.type);
          const i = chain ? evalChain(p.pts.map(([lx, lz]) => ({ x: p.x + lx, z: p.z + lz })), p.type) : evalBuilding(p.type, p.x, p.z, p.rot || 0, false, null, null, p.tier || 0);
          if (!i || i.problems.length) throw new Error(i ? i.problems[0] : 'unknown building');
          if (p.hue != null) i.hue = Math.max(0, Math.round(+p.hue) || 0);
          pay(i); commitBuilding(i, p.type, p.x, p.z, p.rot || 0, p.style || undefined);
        } else if (p.what === 'trees') {
          // Trees cleared by the brush or the bulldozer: only on your own land, as many as the cash covers.
          const set = new Set();
          for (const k of p.ks || []) { if (set.size * TREE_COST + TREE_COST > state.cash) break; if (Number.isInteger(k) && trees.alive[k] && inProperty(trees.x[k], trees.z[k])) set.add(k); }
          if (!set.size && (p.ks || []).length) throw new Error('no trees to clear there');
          state.cash -= set.size * TREE_COST; clearTreeSet(set);
        } else if (p.what === 'lot') {
          const n = state.lotSections; if (state.cash < LOT_EXPAND_COST) throw new Error('not enough cash');
          growLot(p.row ?? null, p.lot || 0); if (state.lotSections === n) throw new Error('the parking lot can’t grow there');
        } else throw new Error('unknown build');
        computeNetwork();
      } else if (['ops', 'other', 'remove', 'land'].includes(o.kind)) {
        // Running the resort, removing things, money and land: done by the game's own code (matchDo in index.html).
        const why = matchDo(o.kind, p); if (why) throw new Error(why);
      } else throw new Error('not supported yet');
      out.push({ id: o.id, ok: true });
    } catch (e) { out.push({ id: o.id, ok: false, error: String(e.message || e).slice(0, 200) }); }
  }
  return out;
})()`;
// Seasons (Phil, Nov 5). A match is 1, 2 or 3 seasons. The first is 168 match days (Dec 10 to May 26). Each later one
// starts with a summer turn (every resort shuts together, whatever its snow, and players have one turn to build), then
// the summer night (upkeep is paid and the new season starts on Nov 15, pre-season as in a game of your own), then 193
// days to May 26 again: 195 match days. The last day of a season is played and watched as usual; summer is its own
// turn so a day being watched never turns into summer under the player.
export const SEASON_ONE = 168, SEASON_MORE = 195;
export const matchDays = (seasons) => SEASON_ONE + (Math.max(1, seasons || 1) - 1) * SEASON_MORE;
// Where a match day falls: which season, whether it's that season's summer turn or summer night, and whether it ends one.
export function seasonOf(lobby, day) {
  const last = day >= lobby.days;
  if ((lobby.seasons || 1) < 2 || day <= SEASON_ONE) return { season: 1, summer: false, newSeason: false, end: day === SEASON_ONE || last, last };
  const k = day - SEASON_ONE - 1, n = k % SEASON_MORE;
  return { season: 2 + Math.floor(k / SEASON_MORE), summer: n === 0, newSeason: n === 1, end: n === SEASON_MORE - 1 || last, last };
}
// The summer turn: the season ends and the resort shuts for the summer (one whose spring already ended was waiting in
// its season report). Nobody skis and it costs nothing; summer upkeep is paid on the summer night.
export const PAGE_SUMMER = `(() => {
  const cash0 = Math.round(state.cash), debt0 = Math.round(state.debt || 0);
  if (!state.summer) { if (state.phase !== 'season') endSeason(); enterSummer(); }
  return { ms: 0, guests: 0, turnedAway: 0, passes: 0, sat: null, profit: 0, cash0, debt0, wx: 'summer', summer: true };
})()`;
// The summer night: summer upkeep and loan interest are paid, and the new season begins. Counts in season profit.
export const PAGE_NEW_SEASON = `(() => {
  const before = state.cash - (state.debt || 0), cash0 = Math.round(state.cash), debt0 = Math.round(state.debt || 0);
  if (!state.summer) { if (state.phase !== 'season') endSeason(); enterSummer(); }
  newSeason();
  return { ms: 0, guests: 0, turnedAway: 0, passes: 0, sat: null, profit: Math.round(state.cash - (state.debt || 0) - before), cash0, debt0, wx: 'summer', summer: true };
})()`;
// A small summary for the league table.
export const PAGE_SUMMARY = `({ cash: Math.round(state.cash), debt: Math.round(state.debt || 0), rep: +state.reputation.toFixed(3), ticket: state.ticket, pass: state.passPrice,
  lifts: world.lifts.length, trails: realTrails().length, buildings: world.buildings.length, day: state.day, season: state.season || 1, summer: !!state.summer })`;
