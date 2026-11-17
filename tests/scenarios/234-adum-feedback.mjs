// From Adum888's feedback (Granite Ridge): a slow lift showed its full-speed capacity; Auto snow gun targets by difficulty;
// a trail's snow need follows its terrain, not its sign; guests who skied (trails from the base, a lesson) aren't refunded.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 1e8`);

  // Slow in the next day's plan: the Lifts list and the lift's card show the slower capacity before the day starts.
  const lift = await g.ev(`(() => {
    const L = world.lifts[0], full = L.stats.cap, slow = Math.round(full * SLOW.speed), f = (n) => n.toLocaleString('en-US') + '/hr';
    const before = liftsList().includes(f(full));
    opsState().plans[planFor(state.day)].lifts[L.id] = 'slow';
    const list = liftsList(), card = liftSheet(L);
    return { before, list: list.includes(f(slow)) && !list.includes(f(full)), card: card.includes(f(slow)) && card.includes('at full speed') };
  })()`);
  eq(lift, { before: true, list: true, card: true }, 'slow lift capacity shown in the list and on the card');
  const open = await g.ev(`(() => { openDay(); const L = world.lifts[0]; return liftsList().includes(Math.round(L.stats.cap * SLOW.speed).toLocaleString('en-US') + '/hr') && liftSheet(L).includes('at full speed'); })()`);
  eq(open, true, 'and while the day is open');
  await g.ev(SETUPS.finishDay);

  // Snow need follows the ground: re-signing a trail doesn't change it.
  const need = await g.ev(`(() => { const t = realTrails()[0], r = t.an.rating, a = needOf(t); t.sign = r === 3 ? 0 : 3; const b = needOf(t); t.sign = null; return [a === OPEN_NEED[r], a === b]; })()`);
  eq(need, [true, true], 'snow need by terrain, whatever the sign');

  // Auto targets for every trail of one difficulty.
  const sm = await g.ev(`(() => {
    const ts = realTrails(); ts.forEach((t, i) => { t.sign = 1; t.sm = { on: true, mode: 'auto', target: i ? 36 : 30 }; });
    const html = trailsList(), btn = (d) => { const b = document.createElement('button'); b.dataset.action = 'bulkSmTarget'; b.dataset.r = '1'; b.dataset.d = d; return b; };
    const shown = html.includes('data-action="bulkSmTarget" data-r="1"') && html.includes('mixed') && !html.includes('data-r="0"');
    sheetAct(btn('6'));
    const after = ts.map((t) => t.sm.target);
    ts.forEach((t) => { t.sign = null; });
    return { shown, after };
  })()`);
  eq(sm, { shown: true, after: [42, 42] }, 'one stepper per difficulty sets every trail in it');

  // Refunds: only guests who never skied at all.
  const ref = await g.ev(`(() => {
    openDay();
    const mk = (o) => ({ runs: 0, vert: 0, learnLaps: 0, sat: 60, th: [], paid: 50, ...o }), out = [];
    for (const o of [{}, { vert: 900 }, { learnLaps: 3 }, { runs: 1 }]) { const g = mk(o), was = today.refunded || 0; refundGuest(g); out.push((today.refunded || 0) > was); }
    return out;
  })()`);
  eq(ref, [true, false, false, false], 'a run from the base or a lesson keeps the ticket');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
