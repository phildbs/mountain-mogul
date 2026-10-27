// Upgrading a lift: from its panel, overnight, pick a faster or bigger lift for the same line. The stations,
// id and trails stay; a name that says the type follows it; the price is the difference plus re-rigging;
// yesterday's line shows what it would have been; Ctrl+Z takes it back.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 5e6`);
  // a day open, so there's a line to compare
  await g.ev(`openDay()`); await g.ev(SETUPS.finishDay); await g.ev(`$('report').hidden = true`);
  const L0 = await g.ev(`(() => { const L = world.lifts[0]; return { id: L.id, name: L.name, type: L.type, a: L.a, b: L.b, cost: L.cost, cap: L.stats.cap, ride: L.stats.ride }; })()`);
  eq(L0.type, 'double', 'the starter lift is a double');

  // closed panel has the button
  await g.ev(`(() => { state.phase = 'closed'; select({ kind: 'lift', obj: world.lifts[0] }); })()`); await g.wait(50);
  assert(/Upgrade lift · from \$/.test(await g.ev(`$('sheet').innerText`)), 'Upgrade lift on the lift panel');
  await g.click('#sheet [data-action=liftUpOpen]'); await g.wait(50);
  const opts = await g.ev(`[...document.querySelectorAll('#sheet .upopt')].map((o) => o.querySelector('b').textContent)`);
  eq(opts, ['Triple chair', 'Quad chair', 'Express quad', 'Six-pack express', 'Gondola'], 'every bigger lift is offered');
  const text = await g.ev(`$('sheet').innerText`);
  assert(/riders\/hr/.test(text) && /ride /.test(text), 'with capacity and ride time');
  const ups = await g.ev(`liftUpgrades(world.lifts[0]).map((u) => ({ type: u.type, cost: u.cost, ok: !u.problems.length }))`);
  const hsq = ups.find((u) => u.type === 'hsq');
  const expect = await g.ev(`(() => { const L = world.lifts[0]; return Math.max(0, liftBuildCost('hsq', L.lay) - liftBuildCost('double', L.lay)) + liftMoveFee(L); })()`);
  eq(hsq.cost, expect, 'the difference in price plus re-rigging');
  assert(hsq.cost < await g.ev(`liftBuildCost('hsq', world.lifts[0].lay)`), 'cheaper than a new express quad');
  // yesterday's line, made long for the check, and about what it'd be
  const g2 = await g.ev(`(() => { state.lastReport.liftWaits[world.lifts[0].id] = 12; liftUpFor = null; liftUpFor = world.lifts[0].id; renderSheet(); return [liftWaitGuess(world.lifts[0], liftCapacity(LIFT_TYPES.hsq)), $('sheet').innerText]; })()`);
  assert(g2[0] && g2[0].now === 12 && g2[0].then < 12 && /Yesterday’s line: 12 min → about \d+ min/.test(g2[1]), `yesterday's line: ${JSON.stringify(g2[0])}`);
  eq(await g.ev(`(() => { const sv = JSON.parse(JSON.stringify(saveData(false))); applySave(sv); return !!liftWaitGuess(world.lifts[0], 9999); })()`), true, 'still there after a reload');
  await g.ev(`(() => { select({ kind: 'lift', obj: world.lifts[0] }); liftUpFor = world.lifts[0].id; renderSheet(); })()`);

  // upgrade to an express quad
  const cash0 = await g.ev(`state.cash`);
  await g.click('#sheet [data-action=liftUp][data-v=hsq]'); await g.wait(100);
  const L1 = await g.ev(`(() => { const L = world.lifts[0]; return { n: world.lifts.length, id: L.id, name: L.name, type: L.type, a: L.a, b: L.b, cost: L.cost, cap: L.stats.cap, ride: L.stats.ride, sel: selected && selected.obj === L, open: liftUpFor }; })()`);
  eq([L1.n, L1.id, L1.type, L1.a, L1.b], [1, L0.id, 'hsq', L0.a, L0.b], 'same lift and stations, now an express quad');
  eq(L1.name, L0.name.replace(/ Double$/, ' Express Quad'), 'its name follows');
  assert(L1.cap > L0.cap && L1.ride < L0.ride, 'more riders an hour, a quicker ride');
  eq([await g.ev(`state.cash`), L1.cost], [cash0 - hsq.cost, L0.cost + hsq.cost], 'paid, and the lift is worth more');
  eq([L1.sel, L1.open], [true, null], 'back on its panel');
  eq(await g.ev(`world.trails.filter((t) => t.reachable).length === world.trails.length`), true, 'its trails still connect');
  eq(await g.ev(`saveData(false).world.lifts[0].type`), 'hsq', 'saved');
  // only bigger from here; renamed lifts keep their name
  eq(await g.ev(`liftUpgrades(world.lifts[0]).map((u) => u.type)`), ['six', 'gondola'], 'only bigger lifts from here');
  await g.ev(`(() => { world.lifts[0].name = 'Big Bertha'; upgradeLift(world.lifts[0], 'six'); })()`);
  eq(await g.ev(`[world.lifts[0].type, world.lifts[0].name]`), ['six', 'Big Bertha'], 'a name of your own stays');

  // undo twice: back to the double, with the money
  await g.ev(`undoLast()`); await g.ev(`undoLast()`);
  eq(await g.ev(`[world.lifts[0].type, world.lifts[0].name, Math.round(state.cash)]`), ['double', L0.name, Math.round(cash0)], 'undo puts the double back and refunds');

  // not while open, and not on visits
  await g.ev(`(() => { openDay(); select({ kind: 'lift', obj: world.lifts[0] }); })()`); await g.wait(50);
  eq(await g.ev(`[!!document.querySelector('#sheet [data-action=liftUpOpen]'), /upgraded overnight/.test($('sheet').innerText)]`), [false, true], 'overnight only');
  await g.ev(`upgradeLift(world.lifts[0], 'triple')`);
  eq(await g.ev(`world.lifts[0].type`), 'double', 'and it can’t be done while open');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
