// From player feedback (Spruce Heights, Maple Notch, 7 cafés): "134 hungry skiers found nowhere to eat", every day. Their
// replayed day: nearly all were town bus riders arriving between 2:30 and 4 pm, long after the lunchtime they were given,
// so they counted as hungry the moment they got off the bus. Now the hungry clock starts on arrival, and from 1:30 pm
// guests have eaten on the way: they still look for food (sales unchanged), but going without isn't a missed lunch.
// What next? also says "at the base" when that's where they went hungry.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const r = await g.ev(`(() => { openDay(); state.speed = 0; const L = world.lifts[0], at = (t) => { state.time = t; const x = makeGuest({ id: null }, L.a.x, L.a.z); x.lunchAt = 700; return x; };
    const morning = at(540), noon = at(740), late = at(900);
    const out = { morning: hungryAt(morning), noon: hungryAt(noon), late: hungryAt(late) };
    // a late arrival who leaves without eating: not a missed lunch
    today.meals = { onTime: 0, delayed: 0, missed: 0 }; const food0 = today.complaints.food;
    state.time = 1000; late.homeAt = 1000; recordMealOutcome(late); noon.homeAt = 1000; recordMealOutcome(noon);
    out.missed = today.meals.missed; out.complaints = today.complaints.food - food0;
    // still wants food on arrival, as before
    state.time = 900; out.wants = wantsMeal(late);
    // an old mid-day save's guest has no arrival time: as before
    const old = at(540); delete old.arrT; out.old = hungryAt(old);
    const said = []; hungerAdvice({ hungry: { price: 0, lineN: 0, line: [], late: 0, nowhereN: 9, nowhere: [{ id: 'base', name: null, n: 9 }] }, complaints: { food: 9 } }, (u, text) => said.push(text));
    out.advice = said[0]; return out; })()`);
  eq([r.morning, r.noon, r.late, r.old], [775, 815, Infinity, 775], 'hungry 75 minutes after lunchtime, or after arriving if later; arriving from 1:30, never');
  eq([r.missed, r.complaints], [1, 1], 'only the guest who arrived at lunchtime and never ate missed lunch');
  eq(r.wants, true, 'a late arrival still looks for something to eat');
  assert(/mostly at the base/.test(r.advice) && /beside the base lifts/.test(r.advice), `What next? names the base: ${r.advice}`);
  eq(g.errors, [], 'no page errors');
}
