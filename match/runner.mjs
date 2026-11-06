// Multiplayer: a test match runner. Nothing here touches the live game or the real database.
// It opens one invisible game per player on the match map (Crown Peak, ?matchMap=1, which never saves), plays
// the same days for all of them in step from opening day, shares one town's skiers and season pass buyers
// between them, and keeps a league table. Results go to match/out/ as a stand-in for the database.
//   cd tests && npm install && cd .. && node match/runner.mjs            # 3 players, 21 days
//   PLAYERS=2 DAYS=14 node match/runner.mjs
//   PRICES=45,65,85 PASSES=299,399,499 node match/runner.mjs              # each player's ticket and pass price
// Each player's land is their own slice of the mountain. Everyone shares one weather forecast.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, launch, openGame, SETUPS } from '../tests/harness.mjs';
import { splitSkiers, nextCap, GROW, SHARP, PASS_SHARP } from './market.mjs';

const N = +(process.env.PLAYERS || 3), DAYS = +(process.env.DAYS || 21);
const PRICES = (process.env.PRICES || '45,65,85').split(',').map(Number);
const PASSES = (process.env.PASSES || '399').split(',').map(Number);
const NAMES = ['Aspen Bowl', 'Birch Hollow', 'Cedar Crest', 'Driftwood'];

const out = join(dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(out, { recursive: true });
const server = await startServer(), browser = await launch();
const players = [];
for (let k = 0; k < N; k++) {
  const g = await openGame(browser, server.url, { query: '?matchMap=1', mountain: 'fresh' });
  await g.ev(SETUPS.juniperStarter);
  const price = PRICES[k % PRICES.length], pass = PASSES[k % PASSES.length];
  // Opening day of the season, with a good early-season base.
  const start = await g.ev(`(() => { for (let k = 0; k < NV * NV; k++) NS[k] = 50; refreshSnowState(todayWx());
    state.ticket = ${price}; state.ticketPeak = null; state.passPrice = ${pass}; return { cash: state.cash, debt: state.debt || 0, day: state.day, map: MOUNTAIN.name }; })()`);
  players.push({ g, name: NAMES[k], price, pass, start, cap: Infinity, total: { guests: 0, profit: 0, passes: 0, turnedAway: 0 } });
}
// One forecast for everyone: the first player's weather is copied to the rest every morning.
const syncWx = async () => { const wx = await players[0].g.ev('JSON.stringify(state.wx)'); await Promise.all(players.slice(1).map((p) => p.g.ev(`state.wx = JSON.parse(${JSON.stringify(wx)})`))); };
await syncWx();

const log = [];
console.log(`Match on ${players[0].start.map}: ${N} players, ${DAYS} days from day ${players[0].start.day}. ${players.map((p) => `${p.name} $${p.price} ticket, $${p.pass} pass`).join('; ')}`);
for (let d = 0; d < DAYS; d++) {
  // 1. Morning: how many would come to each resort, and buy its pass, if it were alone in the valley.
  const alone = await Promise.all(players.map((p) => p.g.ev(`state.phase === 'closed' ? { day: demandForDay(), passes: passesSoldThisSeason() ? 0 : passBuyers(state.passPrice) } : { day: 0, passes: 0 }`)));
  const share = splitSkiers(alone.map((a) => a.day), players.map((p) => p.cap)), passShare = splitSkiers(alone.map((a) => a.passes), undefined, PASS_SHARP);
  // 2. Every resort plays the day at once, with its share of the town's skiers (and pass buyers, on opening day).
  const t0 = Date.now();
  const days = await Promise.all(players.map((p, k) => p.g.ev(`(() => {
    const t0 = performance.now(), before = state.cash - (state.debt || 0), own = demandForDay, ownPass = passBuyers;
    let played = false;
    if (${share[k]} > 0) { demandForDay = () => ${share[k]}; passBuyers = () => ${passShare[k]}; try { openDay(); } finally { demandForDay = own; passBuyers = ownPass; } played = state.phase === 'open'; }
    state.speed = 0; let n = 0;
    while (state.phase === 'open' && n++ < 200000) simStep(1.5);
    const r = played ? state.lastReport : null;
    if (played) nextDay(); else waitDay();
    return { ms: Math.round(performance.now() - t0), guests: r ? r.guests : 0, turnedAway: r ? r.turnedAway || 0 : 0, passes: r ? r.rev.passes || 0 : 0, sat: r ? r.sat : null,
      profit: Math.round(state.cash - (state.debt || 0) - before), wx: r ? r.wx.type + (r.wx.snow ? ' ' + r.wx.snow + 'in' : '') : 'closed' };
  })()`)));
  await syncWx();
  const wall = Date.now() - t0;
  players.forEach((p, k) => {
    const r = days[k]; Object.keys(p.total).forEach((key) => { p.total[key] += r[key]; });
    // Full: next time it's offered only what it held. Not full: it may have grown, so offer a little more each day.
    p.cap = nextCap(p.cap, r);
  });
  log.push({ day: d + 1, wall, alone, share, passShare, results: days });
  console.log(`Day ${d + 1} (${days[0].wx}), all ${N} resorts played in ${(wall / 1000).toFixed(1)} s`);
  players.forEach((p, k) => console.log(`  ${p.name.padEnd(13)} $${String(p.price).padStart(3)}  alone ${String(alone[k].day).padStart(5)}  got ${String(share[k]).padStart(5)}  came ${String(days[k].guests).padStart(5)}${days[k].turnedAway ? `  full: ${days[k].turnedAway} turned away` : ''}${days[k].passes ? `  passes ${money(days[k].passes)}` : ''}  day ${money(days[k].profit)}`));
}

// The league table: most season profit wins. Loans don't count, so profit is cash less debt, against the start.
const table = players.map((p) => ({ name: p.name, price: p.price, pass: p.pass, ...p.total })).sort((a, b) => b.profit - a.profit);
console.log('\nLeague table (season profit, loans not counted)');
table.forEach((r, i) => console.log(`  ${i + 1}. ${r.name.padEnd(13)} $${String(r.price).padStart(3)}  ${String(r.guests).padStart(6)} guests  passes ${money(r.passes).padStart(9)}  profit ${money(r.profit).padStart(10)}${r.turnedAway ? `  (${r.turnedAway} turned away)` : ''}`));
const errors = players.flatMap((p) => p.g.errors.map((e) => `${p.name}: ${e}`));
console.log(errors.length ? `\nPage errors:\n${errors.join('\n')}` : '\nNo page errors.');
const saves = await Promise.all(players.map((p) => p.g.ev('JSON.stringify(saveData(true))')));
writeFileSync(join(out, 'match.json'), JSON.stringify({ map: players[0].start.map, players: N, days: DAYS, model: { GROW, SHARP, PASS_SHARP }, table, log, errors }, null, 1));
players.forEach((p, k) => writeFileSync(join(out, `resort-${k + 1}.json`), saves[k]));
console.log(`Wrote match/out/match.json and ${N} resort saves.`);
await browser.close(); server.close();
process.exit(errors.length ? 1 : 0);

function money(v) { return (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US'); }
