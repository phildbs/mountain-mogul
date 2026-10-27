// Après-ski and night skiing: off by default; on, they run after the lifts close, get their own report pages,
// and every dollar shows up in the day's profit.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const bar = await g.ev(`(() => {
    state.cash = 5e6; state.passPrice = 0;
    for (let x = 30; x > -30; x -= 2) for (let z = 58; z < 72; z += 2) { const v = evalBuilding('bar', x, z, 0, false); if (!v.problems.length) { commitBuilding(v, 'bar', x, z, 0); computeNetwork(); return true; } }
    return false;
  })()`);
  assert(bar, 'a bar fits at the base');
  const run = (until) => g.ev(`(() => { let n = 0; while (state.phase === 'open' && state.time < ${until} && n < 200000) { simStep(1.5); n++; } return state.phase; })()`);
  const day = async () => {
    const cash0 = await g.ev(`state.cash`);
    await g.ev(`nextDay()`); await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
    const r = await g.ev(`state.lastReport`);
    assert(Math.abs(await g.ev(`state.cash`) - cash0 - r.profit) < 2, `cash matches the report: moved ${Math.round(await g.ev(`state.cash`) - cash0)}, profit ${r.profit}`);
    return r;
  };
  // Off by default: the day ends as it always has.
  let r = await day();
  eq([r.apres, r.night, r.rev.apres || 0, r.rev.night || 0], [null, null, 0, 0], 'no après or night by default');
  // Après on in every plan.
  await g.ev(`(() => { for (const k of ['weekday', 'weekend', 'quiet']) opsState().plans[k].apres = 'on'; })()`);
  await g.ev(`nextDay()`); await g.ev(`openDay()`);
  await run(1000);
  eq(await g.ev(`state.phase`), 'open', 'still open for après after the lifts close');
  const lift0 = await g.ev(`today.exp.lifts`);
  await run(1060);
  assert(await g.ev(`today.exp.lifts`) - lift0 < 1, 'lifts stop drawing power once nobody is riding');
  await g.ev(SETUPS.finishDay);
  r = await g.ev(`state.lastReport`);
  assert(r.apres && r.apres.guests > 0 && r.apres.rev > 0, `après guests came: ${JSON.stringify(r.apres)}`);
  eq(r.apres.rev, r.apres.venues.reduce((a, v) => a + v.rev, 0), 'venue revenue adds up');
  eq(r.rev.apres, r.apres.rev, 'après revenue on the day page');
  assert(r.apres.venues.some((v) => v.type === 'bar'), 'the bar got après guests');
  await g.click('[data-rptab=apres]'); await g.wait(100);
  assert(/Après profit/.test(await g.ev(`document.querySelector('.rp-page[data-page=apres]').textContent`)) && await g.ev(`document.querySelector('.rp-page[data-page=day]').hidden`), 'après tab shows its page');
  // Lights: a trail panel action, overnight.
  await g.ev(`nextDay()`);
  const lit = await g.ev(`(() => { const t = realTrails()[0], c0 = state.cash, cost = lightCost(t); select({ kind: 'trail', obj: t }); document.querySelector('[data-action=lightsInstall]').click(); return { lit: t.lit, paid: c0 - state.cash, cost, poles: lampSpots.length, saved: saveData().world.trails.find((x) => x.id === t.id).lit }; })()`);
  eq([lit.lit, lit.paid === lit.cost, lit.poles > 4, lit.saved], [true, true, true, true], 'lights bought, poles up, saved');
  await g.ev(`(() => { select(null); for (const k of ['weekday', 'weekend', 'quiet']) opsState().plans[k].night = 1200; })()`);
  await g.ev(`openDay()`);
  await run(1050);
  const night = await g.ev(`(() => { const [a, b] = realTrails(); const L = world.lifts[0]; return { phase: state.phase, lit: runnable(a), dark: runnable(b), load: canLoad(L), nightGuests: guests.filter((x) => x.night).length }; })()`);
  eq([night.phase, night.lit, night.dark, night.load], ['open', true, false, true], 'at night only the lit trail runs and its lift loads');
  assert(night.nightGuests > 0, 'night skiers on the mountain');
  await g.ev(SETUPS.finishDay);
  r = await g.ev(`state.lastReport`);
  assert(r.night && r.night.guests > 0 && r.night.rev > 0 && r.night.lights > 0, `night report: ${JSON.stringify(r.night)}`);
  eq(r.rev.night, r.night.rev, 'night tickets on the day page');
  eq(r.exp.night, r.night.lights + r.night.staff, 'night costs on the day page');
  assert(await g.ev(`!!document.querySelector('[data-rptab=night]')`), 'night tab');
  // and the cash still matches with both running
  await day();
  // cafés and food trucks: base ones serve après, mountain ones don't; night skiers get cold and peckish
  eq(await g.ev(`[apresType({ type: 'truck', isBase: true }), apresType({ type: 'cafe', isBase: true }), apresType({ type: 'truck', isBase: false }), apresType({ type: 'cafe', isBase: false }), apresSvc({ type: 'cafe' }), apresSvc({ type: 'truck' })]`),
    [true, true, false, false, 'warm', 'snack'], 'base cafés and trucks are après venues; mountain ones are not');
  eq(await g.ev(`(() => { const sv = [state.phase, state.time, runOps]; state.phase = 'open'; runOps = { ...(runOps || {}), night: 1260 }; state.time = closeTime() + 60;
    const n = needs({ night: true, leaving: false, warmed: false, fat: 50, stam: 100, bl: 0, ate: true, snackAt: closeTime() + 30, lunchAt: 720 });
    const done = needs({ night: true, leaving: false, warmed: true, fat: 50, stam: 100, bl: 0, ate: true, snacked: true, snackAt: closeTime() + 30, lunchAt: 720 });
    [state.phase, state.time, runOps] = sv; return [n, done].map((x) => x.filter((k) => k !== 'rest')); })()`), [['warm', 'snack'], []], 'night skiers want a warm-up and a snack, once each');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
