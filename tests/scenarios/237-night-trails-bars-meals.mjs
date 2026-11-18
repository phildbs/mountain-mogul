// From Adum888's feedback: the day report counted only the lit trails when the day ended under the lights; guests sitting
// in a bar or lodge with restrooms got desperate for one; and a guest who set out for lunch in time (a hotel restaurant
// across the mountain, say) was counted as eating late because of the trip.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 1e8`);

  // Bars and lodges have restrooms: nobody sitting inside one needs one.
  const rr = await g.ev(`(() => {
    openDay(); let n = 0; while (!guests.length && n++ < 4000) simStep(1.5);
    const B = world.buildings.find((b) => b.type === 'lodge'), x = guests[0], c0 = today.complaints.rr;
    Object.assign(x, { st: 'inside', bid: B.id, svc: 'drinks', bl: 1.6, rrComplained: false });
    updateNeeds(x, 30);
    const in0 = x.bl, c1 = today.complaints.rr;
    Object.assign(x, { st: 'ski', bid: null, svc: null, bl: 1.75, rrComplained: false }); updateNeeds(x, 30);
    return { inside: in0 === 0 && c1 === c0, outside: today.complaints.rr > c0 };
  })()`);
  eq(rr, { inside: true, outside: true }, 'a restroom inside the bar or lodge; still needed out on the slopes');

  // Lunch: set out before getting hungry, arrived 40 minutes later: on time. Set out late: a late lunch.
  const meal = await g.ev(`(() => {
    const out = [];
    for (const [set, at] of [[null, null], [0, 40], [0, 90], [80, 100]]) {
      const x = guests[0], h0 = hungryAt(x);
      Object.assign(x, { mealRecorded: false, hungry: false, ate: true, skipped: false, night: false, local: false, sight: false, sawView: false, homeAt: 2000,
        mealSet: set == null ? undefined : h0 - 30 + set, mealAt: at == null ? h0 - 10 : h0 - 30 + at });
      const m = today.meals, d0 = m.delayed; recordMealOutcome(x); out.push(m.delayed > d0 ? 'late' : 'on time');
    }
    return out;
  })()`);
  eq(meal, ['on time', 'on time', 'late', 'late'], 'a long trip to lunch that set out in time is on time');
  const trip = await g.ev(`(() => { const x = guests[0]; Object.assign(x, { ate: false, skipped: false, hungry: false, st: 'ride', svc: null, mealSet: hungryAt(x) - 5 });
    state.time = hungryAt(x) + 10; updateNeeds(x, 1.5); return x.hungry; })()`);
  eq(trip, false, 'not hungry while riding a lift to lunch');
  await g.ev(SETUPS.finishDay);

  // A day that ends while the night lights are on still reports the day's open trails.
  const night = await g.ev(`(() => {
    const t = realTrails()[0]; t.lit = true; for (const P of Object.values(opsState().plans)) P.night = closeTime() + 180;
    nextDay(); openDay(); let n = 0; while (!nightNow() && state.phase === 'open' && n++ < 90000) simStep(1.5);
    const lit = nightLightsOn(); endDay();
    return { dbg: [state.phase, nightEnd(), Math.round(state.time), closeTime(), runOps && runOps.night, n], lit, open: state.lastReport.trailsOpen, all: realTrails().filter((x) => x.open && x.snowOk !== false).length };
  })()`);
  assert(night.lit, 'the lights were on ' + JSON.stringify(night));
  eq(night.open, night.all, 'every open trail counted, not just the lit one');
  assert(night.all >= 2, 'both trails open');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
