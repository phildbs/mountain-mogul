// Multiplayer step 1: a test match runner. Nothing here touches the live game or the real database.
// It opens one invisible game per player, plays the same days for all of them in step, shares one town's
// skiers between them each morning, and keeps a league table. Results go to match/out/ as a stand-in for
// the database the real server would write to.
//   cd tests && npm install && cd .. && node match/runner.mjs            # 4 players, 7 days
//   PLAYERS=2 DAYS=14 node match/runner.mjs
//   PRICES=45,65,85,105 node match/runner.mjs                              # each player's ticket price
// Each player's resort is a whole copy of the mountain with its own property line: that line is the
// player's boundary area, so nobody can build on anyone else's land. Everyone shares one weather forecast.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, launch, openGame, SETUPS } from '../tests/harness.mjs';

const N = +(process.env.PLAYERS || 4), DAYS = +(process.env.DAYS || 7);
const PRICES = (process.env.PRICES || '45,65,85,105').split(',').map(Number);
const NAMES = ['Aspen Bowl', 'Birch Hollow', 'Cedar Crest', 'Driftwood'];
// The town's market: rivals grow it a little (more resorts draw more people to the valley), then
// everyone's draw on their own, ticket price included, decides their share. SHARP > 1 makes a better
// offer win more than its plain share, so undercutting a rival really takes skiers from them.
const GROW = 0.4, SHARP = 1.5;
export function splitSkiers(alone) {
  const sorted = [...alone].sort((a, b) => b - a), sum = sorted.reduce((a, b) => a + b, 0);
  if (!sum) return alone.map(() => 0);
  const town = sorted[0] + GROW * (sum - sorted[0]), w = alone.map((d) => Math.pow(d, SHARP)), W = w.reduce((a, b) => a + b, 0);
  return w.map((x) => Math.round(town * x / W));
}

const out = join(dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(out, { recursive: true });
const server = await startServer(), browser = await launch();
const players = [];
for (let k = 0; k < N; k++) {
  const g = await openGame(browser, server.url);
  await g.click('#startBtn'); await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const price = PRICES[k % PRICES.length];
  const start = await g.ev(`(() => { state.ticket = ${price}; state.ticketPeak = null; return { cash: state.cash, debt: state.debt || 0 }; })()`);
  players.push({ g, name: NAMES[k], price, start, total: { guests: 0, profit: 0 } });
}
// One forecast for everyone: the first player's weather is copied to the rest every morning.
const syncWx = async () => { const wx = await players[0].g.ev('JSON.stringify(state.wx)'); await Promise.all(players.slice(1).map((p) => p.g.ev(`state.wx = JSON.parse(${JSON.stringify(wx)})`))); };
await syncWx();

const log = [];
console.log(`Match: ${N} players, ${DAYS} days. Ticket prices: ${players.map((p) => `${p.name} $${p.price}`).join(', ')}`);
for (let d = 0; d < DAYS; d++) {
  // 1. Morning: how many would come to each resort if it were alone in the valley.
  const alone = await Promise.all(players.map((p) => p.g.ev('state.phase === "closed" ? demandForDay() : 0')));
  const share = splitSkiers(alone);
  // 2. Every resort plays the day at once, with its share of the town's skiers.
  const t0 = Date.now();
  const days = await Promise.all(players.map((p, k) => p.g.ev(`(() => {
    const t0 = performance.now(), before = state.cash - (state.debt || 0), own = demandForDay;
    let played = false;
    if (${share[k]} > 0) { demandForDay = () => ${share[k]}; try { openDay(); } finally { demandForDay = own; } played = state.phase === 'open'; }
    state.speed = 0; let n = 0;
    while (state.phase === 'open' && n++ < 200000) simStep(1.5);
    const r = played ? state.lastReport : null;
    if (played) nextDay(); else waitDay();
    return { ms: Math.round(performance.now() - t0), guests: r ? r.guests : 0, sat: r ? r.sat : null, rep: +state.reputation.toFixed(3),
      profit: Math.round(state.cash - (state.debt || 0) - before), wx: r ? r.wx.type + (r.wx.snow ? ' ' + r.wx.snow + 'in' : '') : 'closed' };
  })()`)));
  await syncWx();
  const wall = Date.now() - t0;
  players.forEach((p, k) => { p.total.guests += days[k].guests; p.total.profit += days[k].profit; });
  log.push({ day: d + 1, wall, alone, share, results: days });
  console.log(`Day ${d + 1} (${days[0].wx}), all ${N} resorts played in ${(wall / 1000).toFixed(1)} s`);
  players.forEach((p, k) => console.log(`  ${p.name.padEnd(13)} $${String(p.price).padStart(3)}  alone ${String(alone[k]).padStart(5)}  got ${String(share[k]).padStart(5)}  came ${String(days[k].guests).padStart(5)}  day ${money(days[k].profit).padStart(10)}  sat ${days[k].sat ?? '-'}  ${days[k].ms} ms`));
}

// The league table: most season profit wins. Loans don't count, so profit is cash less debt, against the start.
const table = players.map((p) => ({ name: p.name, price: p.price, guests: p.total.guests, profit: p.total.profit })).sort((a, b) => b.profit - a.profit);
console.log('\nLeague table (season profit, loans not counted)');
table.forEach((r, i) => console.log(`  ${i + 1}. ${r.name.padEnd(13)} $${String(r.price).padStart(3)}  ${String(r.guests).padStart(6)} guests  ${money(r.profit).padStart(11)}`));
const errors = players.flatMap((p) => p.g.errors.map((e) => `${p.name}: ${e}`));
console.log(errors.length ? `\nPage errors:\n${errors.join('\n')}` : '\nNo page errors.');
const saves = await Promise.all(players.map((p) => p.g.ev('JSON.stringify(saveData(true))')));
writeFileSync(join(out, 'match.json'), JSON.stringify({ players: N, days: DAYS, model: { GROW, SHARP }, table, log, errors }, null, 1));
players.forEach((p, k) => writeFileSync(join(out, `resort-${k + 1}.json`), saves[k]));
console.log(`Wrote match/out/match.json and ${N} resort saves.`);
await browser.close(); server.close();
process.exit(errors.length ? 1 : 0);

function money(v) { return (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US'); }
