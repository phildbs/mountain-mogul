// Plays a whole short match through the match server with the in-memory stand-in database: one player who
// sends orders, two computer resorts, three days, then the league table and badges.
//   cd tests && npm install && cd .. && node match/server-test.mjs
import { memoryDb } from './db.mjs';
import { startGame, tick, SETTINGS, PARALLEL, HOOKS, busyCount, settle } from './server.mjs';
import { matchDays, seasonOf } from './market.mjs';

const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };
const ok = (c, m) => (c ? console.log('ok   ' + m) : fail(m));
const db = memoryDb(), game = await startGame(), H = 3600000, T0 = Date.parse('2026-12-01T18:00:00Z'), U1 = 'u-1', U2 = 'u-2';
SETTINGS.computers = true; // the older matches' computer resorts, still played and taken over (new ones get none)
try {
  await db.insert('match_lobbies', [
    { id: 'L1', name: 'Test Cup', map: 'match', slots: 3, starts_at: new Date(T0).toISOString(), days: 3, day_minutes: 60, status: 'open', day: 0, prize: 'Test Cup champion' },
    { id: 'L2', name: 'Empty Cup', map: 'match', slots: 3, starts_at: new Date(T0).toISOString(), days: 3, day_minutes: 60, status: 'open', day: 0, prize: null }]);
  await db.insert('match_players', [{ lobby_id: 'L1', slot: 1, user_id: U1, resort_name: 'Aspen Bowl' }]);

  await tick(db, game, T0 - 60000);
  ok(db.tables.match_lobbies[0].status === 'open', 'a lobby waits for its start time');
  await tick(db, game, T0 + 60000);
  const L = () => db.tables.match_lobbies.find((l) => l.id === 'L1'), R = (s) => db.tables.match_resorts.find((r) => r.lobby_id === 'L1' && r.slot === s);
  ok(L().status === 'running' && L().day === 0, 'it starts at its start time');
  ok(db.tables.match_lobbies.find((l) => l.id === 'L2').status === 'closed', 'a lobby nobody joined is closed');
  ok(db.tables.match_players.filter((p) => p.lobby_id === 'L1').length === 3 && db.tables.match_players.filter((p) => !p.user_id).length === 2, 'empty slices get computer resorts');
  ok([0, 1, 2].every((s) => R(s) && R(s).save), 'every resort is created');
  ok(R(1).summary.lifts === 0 && R(0).summary.lifts === 1, 'players start with an empty slice, computers with a starter resort');

  // Overnight orders from the player: prices, a lift, a trail, a lodge, then two that should fail.
  const order = (kind, payload) => ({ lobby_id: 'L1', slot: 1, user_id: U1, kind, payload, applied_day: null, error: null });
  await db.insert('match_orders', [
    order('price', { ticket: 55, pass: 349 }),
    order('build', { what: 'lift', type: 'double', a: { x: 14, z: 56 }, b: { x: 12, z: -10 } }),
    order('build', { what: 'trail', width: 'wide', pts: [{ x: 15, z: -8 }, { x: 22, z: 15 }, { x: 24, z: 40 }, { x: 22, z: 58 }] }),
    order('build', { what: 'building', type: 'lodge', x: 4, z: 60, rot: 0 }),
    order('build', { what: 'lift', type: 'double', a: { x: 0, z: 0 }, b: { x: 0, z: 1 } }),
    order('build', { what: 'lot', row: null, lot: 0 }),
    order('build', { what: 'trees', ks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49].map((k) => k * 997) }),
    order('remove', { what: 'lift', id: 1 }),
    order('other', { plan: { uid: 'bp1', kind: 'bld', type: 'cafe', x: 10, z: 64, rot: 0, tier: 0 } })]);
  await tick(db, game, T0 + H + 60000);
  const O = db.tables.match_orders;
  ok(L().day === 1, 'day 1 plays one day length after the start');
  { const bp = (R(1).save.world.plans || []).find((p) => p.uid === 'bp1'), built = (R(1).save.world.buildings || []).some((B) => B.type === 'cafe');
    ok(!O[O.length - 1].error && (built ? !bp : bp && bp.reason), `a blueprint is kept and tried overnight after the day (${built ? 'built' : bp && bp.reason})`); }
  ok(O.every((o) => o.applied_day === 1), 'every order is handled overnight');
  ok(O.slice(0, 4).every((o) => !o.error), `prices, a lift, a trail and a lodge are built (${O.slice(0, 4).map((o) => o.error).join(' | ')})`);
  ok(!O[5].error && R(1).save.clock.lotSections === 2, `a parking lot section is built (${O[5].error})`);
  ok(R(1).save.cleared > 0 || O[6].error === 'no trees to clear there', `trees cleared by number, on your own land only (${R(1).save.cleared}, ${O[6].error})`);
  ok(O[4].error && O[7].error === 'not supported yet', `bad orders come back with a reason (${O[4].error}; ${O[7].error})`);
  ok(R(1).summary.lifts === 1 && R(1).summary.trails === 1 && R(1).summary.ticket === 55 && R(1).summary.pass === 349, 'the player\'s resort has what they ordered');
  ok(R(1).summary.guests > 0 && R(0).summary.guests > 0, `everyone had guests on day 1 (${[0, 1, 2].map((s) => R(s).summary.guests)})`);
  const d1 = db.tables.match_days.find((d) => d.day === 1);
  ok(d1 && d1.results.resorts.length === 3, 'day 1 is recorded');
  // The morning's cash and loan, so the game can show the money moving while the day is watched.
  ok(d1.results.resorts.every((r, k) => Number.isFinite(r.cash0) && Number.isFinite(r.debt0) && Math.abs(Math.round(R(r.slot).save.cash) - Math.round(r.cash0) - (R(r.slot).save.clock.debt || 0) + r.debt0 - r.profit) <= 1),
    `each result has the morning's cash and loan, and they add up to the day's profit (${d1.results.resorts.map((r) => [r.cash0, r.profit, Math.round(R(r.slot).save.cash)].join('/'))})`);
  // And the money through the day, every 5 game minutes, so everyone watching sees the server's own figures.
  ok(d1.results.resorts.every((r) => !r.guests || Array.isArray(r.money) && r.money.length > 50 && r.money.every((p, k) => !k || p[0] > r.money[k - 1][0]) && r.money[r.money.length - 1][1] >= r.profit),
    `each played day has its money through the day, ending above the day's profit before wages and upkeep come off (${d1.results.resorts.map((r) => r.money && [r.money.length, r.money[r.money.length - 1].join('@'), r.profit].join('/'))})`);
  const wx = [0, 1, 2].map((s) => JSON.stringify(R(s).save.clock.wx));
  ok(wx[0] === wx[1] && wx[1] === wx[2], 'all three resorts share one forecast');

  // Day 2's orders: running the resort, money and removing things, done by the game's own panel code.
  const n0 = O.length, debt1 = R(1).save.clock.debt || 0;
  await db.insert('match_orders', [
    order('ops', { set: { T2: [false, false, null, null, false], ops: { plans: { weekday: { staff: 'lean' } }, override: null } } }),
    order('other', { ds: { action: 'borrow', v: '50000' }, sel: null, on: 'manage' }),
    order('remove', { ds: { action: 'removeYes' }, sel: { kind: 'bld', id: 3, x: 4, z: 60 }, on: 'bld' }),
    order('remove', { ds: { action: 'removeYes' }, sel: { kind: 'bld', id: 99, x: 90, z: 90 }, on: 'bld' }),
    order('other', { ds: { action: 'borrow', v: '999999999' }, sel: null, on: 'manage' }),
    order('build', { what: 'building', type: 'lodge', x: 4, z: 60, rot: 0, tier: 1, style: 'modern' })]);
  await tick(db, game, T0 + 2 * H + 60000);
  const O2 = db.tables.match_orders.slice(n0), s2 = R(1).save, t2 = (s2.world.trails || []).find((t) => t.id === 2);
  ok(L().day === 2 && O2.every((o) => o.applied_day === 2), 'day 2\'s orders are handled overnight');
  ok(!O2[0].error && t2 && t2.open === false && t2.groomed === false, `settings: a trail closed and left ungroomed (${O2[0].error}, ${t2 && [t2.open, t2.groomed]})`);
  ok(s2.clock.ops && s2.clock.ops.plans.weekday.staff === 'lean', 'settings: the operations plan is the player\'s');
  ok(!O2[1].error && (s2.clock.debt || 0) >= debt1 + 50000, `money: a $50,000 loan (${O2[1].error}, debt ${s2.clock.debt})`);
  ok(!O2[2].error && !(s2.world.buildings || []).some((B) => B.id === 3), `removing: the lodge is gone (${O2[2].error})`);
  ok(O2[3].error === 'it isn’t there any more', `removing something that isn't there says so (${O2[3].error})`);
  ok(!!O2[4].error || (s2.clock.debt || 0) < 999999999, `a loan past the bank's limit is capped or refused (${O2[4].error})`);
  const big = (s2.world.buildings || []).find((B) => B.type === 'lodge');
  ok(!O2[5].error && big && big.tier === 1 && big.style === 'modern', `a building comes in the size and style ordered (${O2[5].error}, ${big && [big.tier, big.style]})`);

  // Day 3: the player's plans keep the resort closed every kind of day, so it gets no skiers and doesn't open.
  const shut = { hours: 'closed' };
  await db.insert('match_orders', [order('ops', { set: { ops: { plans: { weekday: shut, weekend: shut, quiet: shut }, override: null } } })]);
  await tick(db, game, T0 + 3 * H + 60000);
  const d3 = db.tables.match_days.find((d) => d.day === 3), r3 = d3 && d3.results.resorts.find((r) => r.slot === 1), k3 = d3 && d3.results.resorts.findIndex((r) => r.slot === 1);
  ok(r3 && r3.guests === 0 && d3.results.share[k3] === 0 && d3.results.share.some((x) => x > 0), `a resort whose plan says stay closed gets no skiers that day; the others do (${d3 && d3.results.share})`);
  ok(L().day === 3 && L().status === 'finished', 'days 2 and 3 play, then the match finishes');
  const b = db.tables.match_badges || [];
  ok(b.length === 1 && b[0].user_id === U1 && b[0].place >= 1, `the player gets a badge for their place (${b.map((x) => x.title)})`);
  ok(!b.some((x) => x.user_id === U2), 'nobody else gets one');
  const places = db.tables.match_players.filter((p) => p.lobby_id === 'L1').map((p) => p.place).sort();
  ok(places.join() === '1,2,3', `every resort's place is noted, for played and won (${places})`);
  ok(Math.abs(R(1).summary.profit) < 400000, `building a lift doesn't count as a loss (${R(1).summary.profit})`);
  const table = [0, 1, 2].map((s) => R(s).summary).sort((a, b) => b.profit - a.profit);
  console.log('League table:', table.map((s, i) => `${i + 1}. ${s.name} ${s.profit}`).join(', '));
  const said = (db.tables.match_messages || []).map((m) => m.body);
  ok(said.some((b) => /has started/.test(b)) && said.some((b) => /Aspen Bowl opened a new lift/.test(b)) && said.some((b) => /ticket at \$55/.test(b)) && said.some((b) => /^Final standings/.test(b)), `the match posts its news (${said.length} messages)`);
  await tick(db, game, T0 + 5 * H);
  ok(L().day === 3, 'a finished match plays no more');

  // Late joiners. Late Cup has computers and resets profit on a takeover; Quiet Cup has no computers at all.
  const T1 = T0 + 10 * H;
  await db.insert('match_lobbies', [
    { id: 'L3', name: 'Late Cup', kind: 'custom', map: 'match', slots: 3, starts_at: new Date(T1).toISOString(), days: 4, day_minutes: 60, status: 'open', day: 0, prize: null, computers: true, keep_profit: false, late_bonus: 15000, late_bonus_cap: 1000000 },
    { id: 'L4', name: 'Quiet Cup', map: 'match', slots: 3, starts_at: new Date(T1).toISOString(), days: 4, day_minutes: 60, status: 'open', day: 0, prize: null, computers: false, keep_profit: true, late_bonus: 15000, late_bonus_cap: 1000000 }]);
  await db.insert('match_players', [{ lobby_id: 'L3', slot: 0, user_id: U1, resort_name: 'First Hill' }, { lobby_id: 'L4', slot: 0, user_id: U1, resort_name: 'Lonely Hill' }]);
  await tick(db, game, T1 + 60000);
  const rows = (l) => db.tables.match_resorts.filter((r) => r.lobby_id === l).sort((a, b) => a.slot - b.slot);
  ok(rows('L3').length === 3 && rows('L4').length === 1, 'computers fill Late Cup; Quiet Cup leaves its empty slices empty');
  await tick(db, game, T1 + 2 * H + 60000); // days 1 and 2
  const comp = rows('L3').find((r) => r.slot === 1), before = { profit: comp.summary.profit, cash: comp.summary.cash, name: comp.summary.name };
  ok(before.profit !== 0, `the computer resort has made some money by day 2 (${before.profit})`);
  // Two players join on day 2 (as match_join_late does): one takes over a computer resort, one an empty slice.
  Object.assign(db.tables.match_players.find((p) => p.lobby_id === 'L3' && p.slot === 1), { user_id: U2, resort_name: 'Powder Palace', joined_day: 2 });
  await db.insert('match_players', [{ lobby_id: 'L4', slot: 2, user_id: U2, resort_name: 'Quiet Bowl', joined_day: 2 }]);
  await tick(db, game, T1 + 3 * H + 60000); // day 3
  const took = rows('L3').find((r) => r.slot === 1).summary, fresh = rows('L4').find((r) => r.slot === 2);
  ok(took.name === 'Powder Palace' && !took.computer && took.joinedDay === 2, 'the late joiner takes over the computer resort under their own name');
  ok(took.bonus === 30000 && took.cash > before.cash, `with a catch-up investment of $15,000 a missed day (${took.bonus})`);
  ok(Math.abs(took.profit) < Math.abs(before.profit) + 20000 && took.profit === took.last.profit, `Late Cup resets their profit to the day they joined (${took.profit})`);
  ok(fresh && fresh.save && fresh.summary.name === 'Quiet Bowl' && fresh.summary.lifts === 0 && fresh.summary.bonus === 30000, 'in Quiet Cup the joiner gets the empty slice, fresh, with the investment');
  ok(fresh.save.clock.day === rows('L4')[0].save.clock.day && JSON.stringify(fresh.save.clock.wx) === JSON.stringify(rows('L4')[0].save.clock.wx), 'on the same day and forecast as everyone else');
  const lateSaid = db.tables.match_messages.filter((m) => m.lobby_id === 'L3' || m.lobby_id === 'L4').map((m) => m.body);
  ok(lateSaid.some((b) => /Powder Palace has taken over Valley View on day 2, with a catch-up investment of \$30,000/.test(b)) && lateSaid.some((b) => /Quiet Bowl has joined on the empty slice/.test(b)), 'the chat announces them');
  // Late Cup is a player's own match: when it ends, places are noted but nobody gets a badge.
  await tick(db, game, T1 + 4 * H + 60000);
  ok(db.tables.match_lobbies.find((l) => l.id === 'L3').status === 'finished' && !(db.tables.match_badges || []).some((x) => x.lobby_id === 'L3'), 'a player match gives no badges');
  ok(db.tables.match_players.filter((p) => p.lobby_id === 'L3').every((p) => p.place >= 1), 'but notes every place');
  // Since Nov 4, new matches get no computer players, even when the lobby asks for them.
  SETTINGS.computers = false;
  const T2 = T1 + 10 * H;
  await db.insert('match_lobbies', [{ id: 'L5', name: 'People Cup', map: 'match', slots: 3, starts_at: new Date(T2).toISOString(), days: 2, day_minutes: 60, status: 'open', day: 0, prize: null, computers: true, keep_profit: true, late_bonus: 15000, late_bonus_cap: 1000000 }]);
  await db.insert('match_players', [{ lobby_id: 'L5', slot: 0, user_id: U1, resort_name: 'Human Hill' }, { lobby_id: 'L5', slot: 2, user_id: U2, resort_name: 'Person Peak' }]);
  await tick(db, game, T2 + 60000);
  ok(db.tables.match_players.filter((p) => p.lobby_id === 'L5').every((p) => p.user_id) && rows('L5').length === 2, 'no computer players in a new match: just the two players');
  // Ridgeline: four valleys side by side. Each resort's game is the ridge slid to its own valley.
  const T3 = T2 + 10 * H;
  await db.insert('match_lobbies', [{ id: 'L6', name: 'Ridge Cup', map: 'ridge', slots: 4, starts_at: new Date(T3).toISOString(), days: 1, day_minutes: 60, status: 'open', day: 0, prize: null, computers: false, keep_profit: true }]);
  await db.insert('match_players', [{ lobby_id: 'L6', slot: 0, user_id: U1, resort_name: 'West Valley' }, { lobby_id: 'L6', slot: 3, user_id: U2, resort_name: 'East Valley' }]);
  await tick(db, game, T3 + 60000);
  ok(rows('L6').map((r) => r.save.mt).sort().join() === 'ridge@0,ridge@3', `on Ridgeline each resort is on its own valley (${rows('L6').map((r) => r.save.mt)})`);
  await db.insert('match_orders', [{ lobby_id: 'L6', slot: 3, user_id: U2, kind: 'build', payload: { what: 'lot', row: null, lot: 0 }, applied_day: null, error: null }]);
  await tick(db, game, T3 + H + 60000);
  const lot = db.tables.match_orders.find((o) => o.lobby_id === 'L6');
  ok(db.tables.match_lobbies.find((l) => l.id === 'L6').status === 'finished' && lot.applied_day === 1 && !lot.error, `a Ridgeline match plays, orders and all (${lot.error || 'ok'})`);
  // Willow Valley: two resorts each side of a valley. The far side's games are the valley turned round (valley@2, @3).
  const T3b = T3 + 4 * H;
  await db.insert('match_lobbies', [{ id: 'L6v', name: 'Valley Cup', map: 'valley', slots: 4, starts_at: new Date(T3b).toISOString(), days: 1, day_minutes: 60, status: 'open', day: 0, prize: null, computers: false, keep_profit: true }]);
  await db.insert('match_players', [{ lobby_id: 'L6v', slot: 1, user_id: U1, resort_name: 'North Side' }, { lobby_id: 'L6v', slot: 2, user_id: U2, resort_name: 'South Side' }]);
  await tick(db, game, T3b + 60000);
  ok(rows('L6v').map((r) => r.save.mt).sort().join() === 'valley@1,valley@2', `on Willow Valley each resort is on its own slice (${rows('L6v').map((r) => r.save.mt)})`);
  await db.insert('match_orders', [{ lobby_id: 'L6v', slot: 2, user_id: U2, kind: 'build', payload: { what: 'lot', row: null, lot: 0 }, applied_day: null, error: null }]);
  await tick(db, game, T3b + H + 60000);
  const vlot = db.tables.match_orders.find((o) => o.lobby_id === 'L6v');
  ok(db.tables.match_lobbies.find((l) => l.id === 'L6v').status === 'finished' && vlot.applied_day === 1 && !vlot.error, `a Willow Valley match plays, the far side's orders too (${vlot.error || 'ok'})`);
  // Leaving and claiming (match-abandon.sql). Six days: First Hill's owner leaves after day 1 with a pending order and
  // the resort deep in debt; it stays shut on day 2; U3 claims it and gets a fresh start; Second Hill is left and
  // claimed on day 4, too late in the season for its new owner to get a place.
  const T4 = T3 + 10 * H, U3 = 'u-3', U4 = 'u-4';
  await db.insert('match_lobbies', [{ id: 'L7', name: 'Leave Cup', map: 'match', slots: 2, starts_at: new Date(T4).toISOString(), days: 6, day_minutes: 60, status: 'open', day: 0, prize: null, computers: false, keep_profit: true }]);
  await db.insert('match_players', [{ lobby_id: 'L7', slot: 0, user_id: U1, resort_name: 'First Hill' }, { lobby_id: 'L7', slot: 1, user_id: U2, resort_name: 'Second Hill' }]);
  await tick(db, game, T4 + 60000);
  const P7 = (s) => db.tables.match_players.find((p) => p.lobby_id === 'L7' && p.slot === s), R7 = (s) => rows('L7').find((r) => r.slot === s);
  await db.insert('match_orders', [{ lobby_id: 'L7', slot: 0, user_id: U1, kind: 'build', payload: { what: 'lift', type: 'double', a: { x: 14, z: 56 }, b: { x: 12, z: -10 } }, applied_day: null, error: null }]);
  await tick(db, game, T4 + H + 60000);
  const lift = db.tables.match_orders.find((o) => o.lobby_id === 'L7');
  ok(lift.applied_day === 1 && !lift.error, `day 1: First Hill builds a lift (${lift.error || 'ok'})`);
  // In debt and losing money, then left (as match_abandon does), with one more order still waiting.
  Object.assign(R7(0).save, { cash: 1000 }); R7(0).save.clock.debt = 800000; R7(0).summary.profit = -250000;
  Object.assign(P7(0), { user_id: null, abandoned: true, left_by: [U1] });
  await db.insert('match_orders', [{ lobby_id: 'L7', slot: 0, user_id: U1, kind: 'price', payload: { ticket: 5 }, applied_day: null, error: null }]);
  await tick(db, game, T4 + 2 * H + 60000);
  const d2 = db.tables.match_days.find((d) => d.lobby_id === 'L7' && d.day === 2), late = db.tables.match_orders.filter((o) => o.lobby_id === 'L7').at(-1);
  ok(R7(0).summary.abandoned && d2.results.share[0] === 0 && d2.results.alone[0].day === 0 && R7(0).summary.last.guests === 0 && R7(0).summary.last.shut, `day 2: the left resort is shut, with no skiers (${d2.results.share})`);
  ok(Math.round(R7(0).save.cash) === 1000 && R7(0).save.clock.debt === 800000 && R7(0).summary.profit === -250000, `shut costs nothing: cash, debt and profit as they were (${Math.round(R7(0).save.cash)}, ${R7(0).save.clock.debt}, ${R7(0).summary.profit})`);
  ok(late.applied_day === 2 && /changed hands/.test(late.error) && R7(0).save.clock.ticket !== 5, `an order sent before leaving isn't applied (${late.error})`);
  ok(R7(0).save.clock.day === R7(1).save.clock.day, 'its days still go by with everyone else\'s');
  // Claimed (as match_claim does): a fresh start overnight.
  Object.assign(P7(0), { user_id: U3, resort_name: 'Rescue Ridge', joined_day: 2, abandoned: false, rescue_due: true, rescued: true });
  await tick(db, game, T4 + 3 * H + 60000);
  const c3 = R7(0).summary;
  ok(c3.name === 'Rescue Ridge' && !c3.abandoned && c3.rescued && c3.claimedDay === 2 && P7(0).rescue_due === false, 'day 3: claimed under its new name, fresh start given once');
  ok(R7(0).save.clock.debt === 0 && c3.debt === 0, `the debt is written off (${c3.debt})`);
  ok(c3.profit === c3.last.profit && c3.last.cash0 >= 500000, `season losses back to $0 and cash topped up to $500,000 that morning (profit ${c3.profit}, morning cash ${c3.last.cash0})`);
  ok(R7(0).save.clock.reputation >= 0.95, `reputation back to a new resort's (${R7(0).save.clock.reputation})`);
  const news7 = db.tables.match_messages.filter((m) => m.lobby_id === 'L7').map((m) => m.body);
  ok(news7.some((b) => /First Hill has been left by its owner and is shut. Anyone can claim it until day 4/.test(b)) && news7.some((b) => /Rescue Ridge has claimed First Hill on day 2, with a fresh start: \$800,000 of debt written off and \$499,000 to get going/.test(b)), `the chat announces both (${news7.filter((b) => /claim/.test(b)).join(' | ')})`);
  // Second Hill: left and claimed straight away on day 4, without a fresh start used up before.
  Object.assign(P7(1), { user_id: U4, resort_name: 'Latecomer', joined_day: 4, abandoned: false, rescue_due: true, rescued: true, left_by: [U2] });
  await tick(db, game, T4 + 6 * H + 60000);
  ok(R7(1).summary.name === 'Latecomer' && R7(1).summary.rescued, 'left and claimed in one turn: it still gets its fresh start');
  ok(db.tables.match_lobbies.find((l) => l.id === 'L7').status === 'finished', 'the match finishes');
  ok(P7(0).place >= 1 && P7(1).place == null, `a place only for a player who ran the resort at least half the season (${P7(0).place}, ${P7(1).place})`);
  ok(!(db.tables.match_badges || []).some((b) => b.lobby_id === 'L7' && b.user_id === U4) && (db.tables.match_badges || []).some((b) => b.lobby_id === 'L7' && b.user_id === U3), 'and a badge likewise');
  // Spring (3.1): a match started before the new spring rule keeps the old one; newer matches use the loop rule,
  // and a player's order to end the season shuts the resort that morning.
  ok(rows('L6').every((r) => r.save.clock.springRule == null), 'a newer match uses the spring loop rule');
  const T5 = Date.parse('2026-11-01T18:00:00Z');
  await db.insert('match_lobbies', [{ id: 'L8', name: 'Old Cup', map: 'match', slots: 2, starts_at: new Date(T5).toISOString(), days: 1, day_minutes: 60, status: 'open', day: 0, prize: null, computers: false, keep_profit: true }]);
  await db.insert('match_players', [{ lobby_id: 'L8', slot: 0, user_id: U1, resort_name: 'Old Hill' }]);
  await tick(db, game, T5 + 60000);
  ok(rows('L8')[0].save.clock.springRule === 'avg', `a match from before 3.1 keeps the average-base rule (${rows('L8')[0].save.clock.springRule})`);
  const T6 = T4 + 20 * H;
  await db.insert('match_lobbies', [{ id: 'L9', name: 'Spring Cup', map: 'match', slots: 2, starts_at: new Date(T6).toISOString(), days: 2, day_minutes: 60, status: 'open', day: 0, prize: null, computers: false, keep_profit: true }]);
  await db.insert('match_players', [{ lobby_id: 'L9', slot: 0, user_id: U1, resort_name: 'Spring Hill' }]);
  await tick(db, game, T6 + 60000);
  const r9 = rows('L9')[0]; r9.save.clock.day = 140;
  await db.insert('match_orders', [{ lobby_id: 'L9', slot: 0, user_id: U1, kind: 'other', payload: { seasonEnd: true }, applied_day: null, error: null }]);
  await tick(db, game, T6 + H + 60000);
  const o9 = db.tables.match_orders.find((o) => o.lobby_id === 'L9'), s9 = rows('L9')[0];
  ok(o9.applied_day === 1 && !o9.error && s9.save.clock.phase === 'season' && s9.summary.last.guests === 0, `ending the season shuts it from that morning (${o9.error || s9.save.clock.phase}, ${s9.summary.last.guests} guests)`);

  // Two seasons (Phil, Nov 5): jump to just before the end of season 1, then play into season 2. Day 168 is the last
  // of season 1, 169 the summer turn (everyone shuts; players build), 170 the summer night (Nov 15 of season 2).
  ok(matchDays(1) === 168 && matchDays(2) === 363 && matchDays(3) === 558, `match lengths: ${[1, 2, 3].map(matchDays)}`);
  const cal = (d) => seasonOf({ seasons: 3, days: 558 }, d);
  ok(cal(168).end && !cal(168).last && cal(169).summer && cal(169).season === 2 && cal(170).newSeason && !cal(171).newSeason && !cal(171).summer && cal(363).end && cal(364).summer && cal(365).newSeason && cal(365).season === 3 && cal(558).last && !cal(1).end,
    'the season calendar: day 168 ends season 1, 169 is summer, 170 starts season 2, 363 ends it, 364 and 365 start season 3, 558 is the last');
  ok(!seasonOf({ days: 168 }, 168).summer && seasonOf({ days: 168 }, 168).last, 'a one-season match is as before');
  const T7 = T6 + 10 * H;
  await db.insert('match_lobbies', [{ id: 'L10', name: 'Two Winters Cup', kind: 'custom', map: 'match', slots: 2, seasons: 2, starts_at: new Date(T7).toISOString(), days: matchDays(2), day_minutes: 60, status: 'open', day: 0, prize: null, computers: false, keep_profit: true }]);
  await db.insert('match_players', [{ lobby_id: 'L10', slot: 0, user_id: U1, resort_name: 'Winter One' }, { lobby_id: 'L10', slot: 1, user_id: U2, resort_name: 'Winter Two' }]);
  await tick(db, game, T7 + 60000);
  const L10 = () => db.tables.match_lobbies.find((l) => l.id === 'L10'), R10 = (s) => rows('L10').find((r) => r.slot === s);
  L10().day = 166; for (const r of rows('L10')) { r.save.clock.day = 175; r.summary.profit = 1000 * (r.slot + 1); }
  await tick(db, game, T7 + 168 * H + 60000); // days 167 and 168
  const sum = R10(0).summary;
  ok(L10().day === 168 && [0, 1].every((s) => !R10(s).save.clock.summer && R10(s).save.clock.season === 1), `day 168 is played as usual, so it can be watched (${[0, 1].map((s) => [R10(s).save.clock.phase, R10(s).save.clock.day])})`);
  ok(sum.seasons && sum.seasons.length === 1 && sum.seasons[0] === sum.profit, `season 1's profit is noted (${sum.seasons}, ${sum.profit})`);
  await db.insert('match_orders', [{ lobby_id: 'L10', slot: 0, user_id: U1, kind: 'build', payload: { what: 'lift', type: 'double', a: { x: 14, z: 56 }, b: { x: 12, z: -10 } }, applied_day: null, error: null }]);
  const profit168 = R10(0).summary.profit;
  await tick(db, game, T7 + 169 * H + 60000); // day 169, the summer turn
  const d169 = db.tables.match_days.find((d) => d.lobby_id === 'L10' && d.day === 169);
  ok([0, 1].every((s) => R10(s).save.clock.summer && R10(s).summary.summer && R10(s).save.clock.season === 1), `on the summer turn every resort is in summer (${[0, 1].map((s) => [R10(s).save.clock.phase, R10(s).save.clock.summer])})`);
  ok(d169 && d169.results.summer && d169.results.share.every((x) => x === 0) && R10(0).summary.profit === profit168, `nobody skis and it costs nothing (${d169 && d169.results.share}, ${R10(0).summary.profit - profit168})`);
  ok(R10(0).summary.lifts === 1, 'an order sent after the last day is built that night');
  await db.insert('match_orders', [{ lobby_id: 'L10', slot: 1, user_id: U2, kind: 'build', payload: { what: 'lift', type: 'double', a: { x: 14, z: 56 }, b: { x: 12, z: -10 } }, applied_day: null, error: null }]);
  const cashSummer = Math.round(R10(1).save.cash);
  await tick(db, game, T7 + 171 * H + 60000); // day 170, the summer night, and 171, Nov 15
  const o10 = db.tables.match_orders.filter((o) => o.lobby_id === 'L10').at(-1), d170 = db.tables.match_days.find((d) => d.lobby_id === 'L10' && d.day === 170);
  ok(o10.applied_day === 170 && !o10.error && R10(1).summary.lifts === 1, `a lift built in summer (${o10.error || 'ok'})`);
  ok(d170 && d170.results.newSeason && d170.results.season === 2 && d170.results.share.every((x) => x === 0) && d170.results.resorts.every((r) => r.profit < 0), `the summer night: nobody skis and summer upkeep is paid (${d170 && d170.results.resorts.map((r) => r.profit)})`);
  ok([0, 1].every((s) => R10(s).save.clock.season === 2 && !R10(s).save.clock.summer && R10(s).save.clock.day === -15 && R10(s).summary.season === 2), `season 2 began on Nov 15 for everyone (${[0, 1].map((s) => [R10(s).save.clock.season, R10(s).save.clock.day])})`);
  ok(JSON.stringify(R10(0).save.clock.wx) === JSON.stringify(R10(1).save.clock.wx), 'with one shared forecast');
  ok(Math.round(R10(1).save.cash) < cashSummer, `the summer cost money (${cashSummer} then ${Math.round(R10(1).save.cash)})`);
  const said10 = db.tables.match_messages.filter((m) => m.lobby_id === 'L10').map((m) => m.body);
  ok(said10.some((b) => /^Season 1 is over\. .*season 2 starts on Nov 15/.test(b)) && said10.some((b) => /^It's summer/.test(b)) && said10.some((b) => /^Season 2 has begun/.test(b)), 'the chat says when a season ends, summer comes and the next begins');
  // The end of the match: day 363 ends season 2. The total of both seasons wins.
  L10().day = 361; for (const r of rows('L10')) r.save.clock.day = 174;
  await tick(db, game, T7 + 363 * H + 60000);
  const f10 = [0, 1].map((s) => R10(s).summary);
  ok(L10().status === 'finished' && f10.every((x) => x.seasons.length === 2 && x.seasons[0] + x.seasons[1] === x.profit), `the match finishes with both seasons' profits adding up to the total (${f10.map((x) => x.seasons)})`);
  ok([0, 1].every((s) => !R10(s).save.clock.summer), 'the last season isn\'t followed by a summer');

  // Side by side (Nov 5): a slow match (a big resort's day can take 2 minutes) doesn't hold up another one's day,
  // isn't started twice while it's still playing, and no more than PARALLEL.max play at once.
  const T8 = T7 + 400 * H, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await db.insert('match_lobbies', [
    { id: 'L11', name: 'Slow Cup', map: 'match', slots: 2, starts_at: new Date(T8).toISOString(), days: 2, day_minutes: 5, status: 'open', day: 0, prize: null, computers: false, keep_profit: true },
    { id: 'L12', name: 'Quick Cup', map: 'match', slots: 2, starts_at: new Date(T8).toISOString(), days: 2, day_minutes: 5, status: 'open', day: 0, prize: null, computers: false, keep_profit: true }]);
  await db.insert('match_players', [{ lobby_id: 'L11', slot: 0, user_id: U1, resort_name: 'Slow Hill' }, { lobby_id: 'L12', slot: 0, user_id: U2, resort_name: 'Quick Hill' }]);
  await tick(db, game, T8 + 60000);
  const lob = (id) => db.tables.match_lobbies.find((l) => l.id === id), daysOf = (id) => db.tables.match_days.filter((d) => d.lobby_id === id).length;
  HOOKS.beforeDay = (l) => (l.id === 'L11' ? sleep(20000) : null);
  const at1 = T8 + 5 * 60000 + 60000, n1 = await tick(db, game, at1, { wait: false });
  for (let k = 0; k < 60 && lob('L12').day < 1; k++) await sleep(500);
  ok(n1 === 2 && lob('L12').day === 1 && lob('L11').day === 0 && busyCount() === 1, `the quick match's day is played while the slow one is still busy (${n1} started; days ${lob('L11').day}, ${lob('L12').day})`);
  const n2 = await tick(db, game, at1 + 1000, { wait: false });
  ok(n2 === 0, `a match still playing isn't started again (${n2} started)`);
  await settle(); HOOKS.beforeDay = null;
  ok(lob('L11').day === 1 && daysOf('L11') === 1, `the slow match plays its day once (${lob('L11').day}, ${daysOf('L11')} saved)`);
  PARALLEL.max = 1;
  const n3 = await tick(db, game, T8 + 10 * 60000 + 60000, { wait: false }); await settle();
  ok(n3 === 1 && [lob('L11').day, lob('L12').day].sort().join() === '1,2', `with room for one at a time, one starts and the other waits for the next check (${n3}; ${lob('L11').day}, ${lob('L12').day})`);
  await tick(db, game, T8 + 10 * 60000 + 120000); PARALLEL.max = 2;
  ok(lob('L11').status === 'finished' && lob('L12').status === 'finished', 'both finish');
} finally {
  await game.close();
}
console.log(process.exitCode ? 'SOME CHECKS FAILED' : 'ALL CHECKS PASSED');
