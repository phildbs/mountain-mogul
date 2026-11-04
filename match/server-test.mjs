// Plays a whole short match through the match server with the in-memory stand-in database: one player who
// sends orders, two computer resorts, three days, then the league table and badges.
//   cd tests && npm install && cd .. && node match/server-test.mjs
import { memoryDb } from './db.mjs';
import { startGame, tick, SETTINGS } from './server.mjs';

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
} finally {
  await game.close();
}
console.log(process.exitCode ? 'SOME CHECKS FAILED' : 'ALL CHECKS PASSED');
