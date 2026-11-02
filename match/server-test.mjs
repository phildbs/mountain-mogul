// Plays a whole short match through the match server with the in-memory stand-in database: one player who
// sends orders, two computer resorts, three days, then the league table and badges.
//   cd tests && npm install && cd .. && node match/server-test.mjs
import { memoryDb } from './db.mjs';
import { startGame, tick } from './server.mjs';

const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };
const ok = (c, m) => (c ? console.log('ok   ' + m) : fail(m));
const db = memoryDb(), game = await startGame(), H = 3600000, T0 = Date.parse('2026-12-01T18:00:00Z'), U1 = 'u-1', U2 = 'u-2';
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
    order('remove', { what: 'lift', id: 1 })]);
  await tick(db, game, T0 + H + 60000);
  const O = db.tables.match_orders;
  ok(L().day === 1, 'day 1 plays one day length after the start');
  ok(O.every((o) => o.applied_day === 1), 'every order is handled overnight');
  ok(O.slice(0, 4).every((o) => !o.error), `prices, a lift, a trail and a lodge are built (${O.slice(0, 4).map((o) => o.error).join(' | ')})`);
  ok(O[4].error && O[5].error === 'not supported yet', `bad orders come back with a reason (${O[4].error}; ${O[5].error})`);
  ok(R(1).summary.lifts === 1 && R(1).summary.trails === 1 && R(1).summary.ticket === 55 && R(1).summary.pass === 349, 'the player\'s resort has what they ordered');
  ok(R(1).summary.guests > 0 && R(0).summary.guests > 0, `everyone had guests on day 1 (${[0, 1, 2].map((s) => R(s).summary.guests)})`);
  const d1 = db.tables.match_days.find((d) => d.day === 1);
  ok(d1 && d1.results.resorts.length === 3, 'day 1 is recorded');
  const wx = [0, 1, 2].map((s) => JSON.stringify(R(s).save.clock.wx));
  ok(wx[0] === wx[1] && wx[1] === wx[2], 'all three resorts share one forecast');

  await tick(db, game, T0 + 3 * H + 60000);
  ok(L().day === 3 && L().status === 'finished', 'days 2 and 3 play, then the match finishes');
  const b = db.tables.match_badges || [];
  ok(b.length === 1 && b[0].user_id === U1 && b[0].place >= 1, `the player gets a badge for their place (${b.map((x) => x.title)})`);
  ok(!b.some((x) => x.user_id === U2), 'nobody else gets one');
  ok(Math.abs(R(1).summary.profit) < 400000, `building a lift doesn't count as a loss (${R(1).summary.profit})`);
  const table = [0, 1, 2].map((s) => R(s).summary).sort((a, b) => b.profit - a.profit);
  console.log('League table:', table.map((s, i) => `${i + 1}. ${s.name} ${s.profit}`).join(', '));
  const said = (db.tables.match_messages || []).map((m) => m.body);
  ok(said.some((b) => /has started/.test(b)) && said.some((b) => /Aspen Bowl opened a new lift/.test(b)) && said.some((b) => /ticket at \$55/.test(b)) && said.some((b) => /^Final standings/.test(b)), `the match posts its news (${said.length} messages)`);
  await tick(db, game, T0 + 5 * H);
  ok(L().day === 3, 'a finished match plays no more');
} finally {
  await game.close();
}
console.log(process.exitCode ? 'SOME CHECKS FAILED' : 'ALL CHECKS PASSED');
