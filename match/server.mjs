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
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { startServer, launch, openGame, SETUPS } from '../tests/harness.mjs';
import { splitSkiers, nextCap, PAGE_ALONE, pagePlay, pageOrders, PAGE_SUMMARY } from './market.mjs';
import { restDb } from './db.mjs';

const COMPUTER_NAMES = ['Summit Ridge', 'Valley View', 'Pine Hollow', 'Snowcrest'], COMPUTER_PRICE = 65;
const MAX_DAYS_PER_TICK = 3; // catching up after the server was down: a few days a minute, not all at once
const log = (...a) => console.log(new Date().toISOString(), ...a);
const dollars = (v) => (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
// Match news in the lobby's chat. Never stops a match: if the chat isn't set up, it's skipped.
async function news(db, lobby, day, lines) {
  if (!lines.length) return;
  try { await db.insert('match_messages', lines.map((body) => ({ lobby_id: lobby.id, user_id: null, slot: null, name: lobby.name.slice(0, 40), body: body.slice(0, 200), kind: 'news', day }))); }
  catch (e) { log(`${lobby.name}: news skipped (${e.message.slice(0, 80)})`); }
}
const BUILT = { lift: 'a new lift', trail: 'a new trail', building: 'a new building' };

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
  // Empty slices get computer resorts, unless the lobby keeps them empty until someone joins.
  if (lobby.computers !== false) for (let s = 0; s < lobby.slots; s++) if (!taken.has(s)) extra.push({ lobby_id: lobby.id, slot: s, user_id: null, resort_name: COMPUTER_NAMES[s % COMPUTER_NAMES.length] });
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
  await news(db, lobby, 0, [`${lobby.name} has started: ${all.map((p) => p.resort_name).join(', ')}. Opening day is in ${lobby.day_minutes} minutes. Good luck!`]);
  log(`${lobby.name}: started with ${all.filter((p) => p.user_id).length} players and ${all.filter((p) => !p.user_id).length} computer resorts`);
}

async function playDay(db, game, lobby) {
  const day = lobby.day + 1, t0 = Date.now();
  const resorts = (await db.select('match_resorts', { lobby_id: lobby.id })).sort((a, b) => a.slot - b.slot);
  const players = await db.select('match_players', { lobby_id: lobby.id }), joins = [];
  // Late joiners on an empty slice start a fresh resort tonight.
  for (const p of players) if (p.user_id && !resorts.some((r) => r.slot === p.slot))
    resorts.push({ lobby_id: lobby.id, slot: p.slot, day: lobby.day, save: null, summary: { name: p.resort_name, computer: true, fresh: true, start: 0, profit: 0, guests: 0, passes: 0, turnedAway: 0, cap: null } });
  resorts.sort((a, b) => a.slot - b.slot);
  const pages = [];
  try {
    for (const r of resorts) pages.push(await openResort(game, r.save, r.summary.name));
    const ref = resorts.findIndex((r) => r.save);
    await setWeather(pages.filter((_, k) => k !== ref), await weatherOf(pages[ref]));
    // A player who joined late: they take over a computer resort (or the fresh one above) tonight, with a
    // catch-up investment in cash for the days they missed. Profit so far stays, unless the lobby says otherwise.
    for (const [k, r] of resorts.entries()) {
      const p = players.find((q) => q.slot === r.slot);
      if (!p || !p.user_id || !r.summary.computer) continue;
      if (r.summary.fresh) await pages[k].ev(`(() => { const ns = ${JSON.stringify(await pages[ref].ev('Array.from(NS)'))}; for (let i = 0; i < NS.length; i++) NS[i] = ns[i];
        state.day = ${await pages[ref].ev('state.day')}; refreshSnowState(todayWx()); })()`);
      const bonus = Math.min(lobby.late_bonus_cap ?? 1000000, (lobby.late_bonus ?? 15000) * (p.joined_day || 0));
      if (bonus) await pages[k].ev(`state.cash += ${bonus}`);
      const was = r.summary.name, fresh = r.summary.fresh;
      Object.assign(r.summary, { name: p.resort_name, computer: false, fresh: undefined, joinedDay: p.joined_day || 0, bonus });
      if (!fresh && lobby.keep_profit === false) Object.assign(r.summary, { profit: 0, guests: 0, passes: 0, turnedAway: 0 });
      await pages[k].ev(`state.resortName = ${JSON.stringify(p.resort_name)}`);
      joins.push(`${p.resort_name} ${fresh ? 'has joined on the empty slice' : `has taken over ${was}`} on day ${p.joined_day || 0}${bonus ? `, with a catch-up investment of ${dollars(bonus)}` : ''}. Welcome!`);
    }
    // Overnight: each player's orders, in the order they were sent.
    const orders = await db.select('match_orders', { lobby_id: lobby.id, applied_day: ['is', null] }, 'id.asc');
    const done = [];
    for (const [k, r] of resorts.entries()) {
      const mine = orders.filter((o) => o.slot === r.slot);
      if (mine.length) done.push(...await pages[k].ev(pageOrders(mine)));
    }
    for (const o of done) await db.update('match_orders', { id: o.id }, { applied_day: day, error: o.ok ? null : o.error });
    const said = [...joins];
    for (const o of orders) {
      const d = done.find((x) => x.id === o.id), who = resorts.find((r) => r.slot === o.slot)?.summary.name;
      if (!d || !d.ok || !who) continue;
      if (o.kind === 'build' && BUILT[o.payload.what]) said.push(`${who} opened ${BUILT[o.payload.what]}.`);
      if (o.kind === 'price' && o.payload.ticket != null) said.push(`${who} set its lift ticket at ${dollars(o.payload.ticket)}.`);
    }
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
    const snow = +(String(results[0].wx).match(/([\d.]+)in/) || [])[1] || 0;
    if (snow >= 6) said.unshift(`Powder day! ${snow} inches of new snow overnight.`);
    await news(db, lobby, day, [...new Set(said)]);
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
  await news(db, lobby, lobby.days, [`Final standings: ${ranked.map((r, i) => `${i + 1}. ${r.summary.name} ${dollars(r.summary.profit)}`).join(', ')}. Congratulations!`]);
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
  // Updates: when the branch on GitHub moves on, stop between ticks; the service restarts us and pulls it first.
  const branch = process.env.MM_BRANCH, git = (...a) => execFileSync('git', a, { cwd: dirname(fileURLToPath(import.meta.url)), encoding: 'utf8', timeout: 30000 }).trim();
  const here = branch ? git('rev-parse', 'HEAD') : null;
  for (let n = 0; ; n++) {
    await tick(db, game).catch((e) => log('tick failed:', e.stack || e));
    if (branch && n % 5 === 4) {
      try { const there = git('ls-remote', 'origin', branch).split(/\s/)[0]; if (there && there !== here) { log(`update found (${there.slice(0, 7)}), restarting`); await game.close(); process.exit(0); } }
      catch (e) { log('update check failed:', e.message); }
    }
    await new Promise((r) => setTimeout(r, 60000));
  }
}
