// The match server: plays every running multiplayer match, one game day at a time, and saves the results.
//   SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_KEY=... node match/server.mjs
// The service key lives only on the server (in /etc/mm-match.env there), never in this repo or the game.
// Each minute it checks the lobbies:
//   - an open lobby whose start time has passed starts: empty slices get computer-run resorts and every
//     resort is created on the match map (Crown Peak). A lobby nobody joined is closed instead.
//   - a running lobby plays the days that are due: day N at the start time plus N day lengths, so players
//     have the first day length to build before opening day. Each day it loads every resort, applies the
//     players' orders overnight, shares the town's skiers, plays the day for all resorts at once and saves.
//   - after the last day it ranks the resorts by season profit and gives badges to the top three players.
// The games run in an invisible browser on the match map, which never saves anything itself.
import { fileURLToPath } from 'node:url';
import { startServer, launch, openGame, SETUPS } from '../tests/harness.mjs';
import { splitSkiers, nextCap, PAGE_ALONE, pagePlay, pageOrders, PAGE_SUMMARY } from './market.mjs';
import { restDb } from './db.mjs';

const COMPUTER_NAMES = ['Summit Ridge', 'Valley View', 'Pine Hollow', 'Snowcrest'], COMPUTER_PRICE = 65;
const MAX_DAYS_PER_TICK = 3; // catching up after the server was down: a few days a minute, not all at once
const log = (...a) => console.log(new Date().toISOString(), ...a);

export async function startGame() {
  const server = await startServer(), browser = await launch();
  return { url: server.url, browser, close: async () => { await browser.close(); server.close(); } };
}
async function openResort(game, save, name) {
  const g = await openGame(game.browser, game.url, { query: '?matchMap=1', mountain: 'fresh' });
  if (save) await g.page.evaluate((s) => window.__dbg('applySave')(s), save);
  await g.ev(`state.resortName = ${JSON.stringify(name)}`);
  return g;
}
const saveOf = (g) => g.page.evaluate(() => window.__dbg('saveData')(false));
const weatherOf = (g) => g.ev('JSON.stringify(state.wx)');
const setWeather = (pages, wx) => Promise.all(pages.map((g) => g.ev(`state.wx = JSON.parse(${JSON.stringify(wx)})`)));

async function startLobby(db, game, lobby) {
  const players = await db.select('match_players', { lobby_id: lobby.id });
  if (!players.some((p) => p.user_id)) { await db.update('match_lobbies', { id: lobby.id }, { status: 'closed' }); log(`${lobby.name}: nobody joined, closed`); return; }
  const taken = new Set(players.map((p) => p.slot)), extra = [];
  for (let s = 0; s < lobby.slots; s++) if (!taken.has(s)) extra.push({ lobby_id: lobby.id, slot: s, user_id: null, resort_name: COMPUTER_NAMES[s % COMPUTER_NAMES.length] });
  if (extra.length) await db.insert('match_players', extra);
  const all = [...players, ...extra].sort((a, b) => a.slot - b.slot), rows = [];
  let wx = null;
  for (const p of all) {
    const g = await openResort(game, null, p.resort_name);
    // Opening day of the season with a good early base. Computer resorts start with a lift, two trails and a lodge.
    await g.ev(`(() => { for (let k = 0; k < NV * NV; k++) NS[k] = 50; refreshSnowState(todayWx()); })()`);
    if (!p.user_id) { await g.ev(SETUPS.juniperStarter); await g.ev(`state.ticket = ${COMPUTER_PRICE}`); }
    if (wx) await setWeather([g], wx); else wx = await weatherOf(g);
    const sum = await g.ev(PAGE_SUMMARY);
    rows.push({ lobby_id: lobby.id, slot: p.slot, day: 0, save: await saveOf(g), updated_at: new Date().toISOString(),
      summary: { ...sum, name: p.resort_name, computer: !p.user_id, start: sum.cash - sum.debt, profit: 0, guests: 0, passes: 0, turnedAway: 0, cap: null } });
    await g.page.close();
  }
  await db.upsert('match_resorts', rows);
  await db.update('match_lobbies', { id: lobby.id }, { status: 'running', day: 0 });
  log(`${lobby.name}: started with ${players.length} players and ${extra.length} computer resorts`);
}

async function playDay(db, game, lobby) {
  const day = lobby.day + 1, t0 = Date.now();
  const resorts = (await db.select('match_resorts', { lobby_id: lobby.id })).sort((a, b) => a.slot - b.slot);
  const pages = [];
  try {
    for (const r of resorts) pages.push(await openResort(game, r.save, r.summary.name));
    await setWeather(pages.slice(1), await weatherOf(pages[0]));
    // Overnight: each player's orders, in the order they were sent.
    const orders = await db.select('match_orders', { lobby_id: lobby.id, applied_day: ['is', null] }, 'id.asc');
    const done = [];
    for (const [k, r] of resorts.entries()) {
      const mine = orders.filter((o) => o.slot === r.slot);
      if (mine.length) done.push(...await pages[k].ev(pageOrders(mine)));
    }
    for (const o of done) await db.update('match_orders', { id: o.id }, { applied_day: day, error: o.ok ? null : o.error });
    // The town's skiers and pass buyers, shared; then every resort plays its day at once.
    const alone = await Promise.all(pages.map((g) => g.ev(PAGE_ALONE)));
    const share = splitSkiers(alone.map((a) => a.day), resorts.map((r) => r.summary.cap ?? Infinity)), passShare = splitSkiers(alone.map((a) => a.passes));
    const results = await Promise.all(pages.map((g, k) => g.ev(pagePlay(share[k], passShare[k]))));
    await setWeather(pages.slice(1), await weatherOf(pages[0]));
    const rows = [];
    for (const [k, r] of resorts.entries()) {
      const res = results[k], s = r.summary, now = await pages[k].ev(PAGE_SUMMARY);
      rows.push({ lobby_id: lobby.id, slot: r.slot, day, save: await saveOf(pages[k]), updated_at: new Date().toISOString(),
        summary: { ...s, ...now, profit: s.profit + res.profit, guests: s.guests + res.guests, passes: s.passes + res.passes, turnedAway: s.turnedAway + res.turnedAway, cap: nextCap(s.cap, res), last: res } });
    }
    await db.upsert('match_resorts', rows);
    await db.upsert('match_days', [{ lobby_id: lobby.id, day, results: { wx: results[0].wx, alone, share, passShare, resorts: results.map((x, k) => ({ slot: resorts[k].slot, ...x })) } }]);
    await db.update('match_lobbies', { id: lobby.id }, { day });
    log(`${lobby.name}: day ${day} of ${lobby.days} in ${((Date.now() - t0) / 1000).toFixed(1)} s, ${results.map((x, k) => `${resorts[k].summary.name} ${x.guests}`).join(', ')}`);
    if (day >= lobby.days) await finish(db, lobby, rows);
  } finally {
    for (const g of pages) await g.page.close().catch(() => {});
  }
  return day;
}

// The league table decides the badges: most season profit wins. Season profit is what the resort made running each
// day (tickets, food, passes, less running costs); what a player spends building comes out of cash, not profit,
// so building a bigger resort is never a loss in the table. Places count every resort, computers included;
// only players get badges.
async function finish(db, lobby, rows) {
  const players = await db.select('match_players', { lobby_id: lobby.id });
  const ranked = [...rows].sort((a, b) => b.summary.profit - a.summary.profit), badges = [];
  ranked.forEach((r, i) => {
    const p = players.find((q) => q.slot === r.slot);
    if (p && p.user_id && i < 3) badges.push({ user_id: p.user_id, lobby_id: lobby.id, place: i + 1, title: i === 0 ? lobby.prize || `${lobby.name} champion` : `${['', '1st', '2nd', '3rd'][i + 1]} in ${lobby.name}` });
  });
  if (badges.length) await db.upsert('match_badges', badges);
  await db.update('match_lobbies', { id: lobby.id }, { status: 'finished' });
  log(`${lobby.name}: finished. ${ranked.map((r, i) => `${i + 1}. ${r.summary.name} ${r.summary.profit}`).join(', ')}`);
}

// One check of every lobby. `now` can be set by tests.
export async function tick(db, game, now = Date.now()) {
  const lobbies = await db.select('match_lobbies', { status: ['in', ['open', 'running']] });
  for (const lobby of lobbies) {
    try {
      if (lobby.status === 'open') { if (Date.parse(lobby.starts_at) <= now) await startLobby(db, game, lobby); continue; }
      const due = Math.min(lobby.days, Math.floor((now - Date.parse(lobby.starts_at)) / (lobby.day_minutes * 60000)));
      for (let n = 0; lobby.day < due && n < MAX_DAYS_PER_TICK; n++) lobby.day = await playDay(db, game, lobby);
    } catch (e) { log(`${lobby.name}: ${e.stack || e}`); }
  }
}

// Run as a program: check every minute, forever.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_KEY: key } = process.env;
  if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY (see match/server-setup.yaml).'); process.exit(1); }
  const db = restDb(url, key), game = await startGame();
  log('match server running');
  for (;;) {
    await tick(db, game).catch((e) => log('tick failed:', e.stack || e));
    await new Promise((r) => setTimeout(r, 60000));
  }
}
