// Race weekend and pond skim: the course and pond appear on the day, racers and skimmers run, and the report has results.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const runTo = (t) => g.ev(`(() => { let n = 0; while (state.phase === 'open' && state.time < ${t} && n < 90000) { simStep(1.5); n++; } })()`);
  const drawn = (fn) => g.ev(`${fn}(0)`);
  // Race weekend needs a black diamond: mark one trail as black
  await g.ev(`(() => { world.trails[0].sign = 2; state.passPrice = 0; bookEvent('race'); while (state.day < state.event.days[0]) waitDay(); for (let k = 0; k < NV*NV; k++) NS[k] = 50; refreshSnowState(todayWx()); refreshTimebar(true); })()`);
  assert(/Race day/.test(await g.ev(`$('tbSub').innerText`)), 'top bar shows race day');
  await g.ev(`openDay()`); await runTo(700);
  eq(await g.ev(`raceTrail() && raceTrail().id`), await g.ev(`world.trails[0].id`), 'race on the black run');
  await g.ev(`syncRaceCourse()`);
  assert(await g.ev(`!!raceCourse && raceCourse.children.length > 0`), 'gates and finish built');
  assert(await drawn('drawRace') > 20, 'racers and a crowd are drawn');
  await g.ev(SETUPS.finishDay);
  const race = await g.ev(`state.lastReport.race`);
  assert(race && race.runs > 20 && race.best.secs > 0, `race results: ${JSON.stringify(race)}`);
  assert(/racers ran the gates/.test(await g.ev(`$('rpBody').innerText`)), 'report has the race');
  await g.click('#rpNext'); await g.wait(200);
  await g.ev(`syncRaceCourse()`);
  eq(await g.ev(`raceCourse`), null, 'course comes down after the race');
  // Pond skim in March
  await g.ev(`(() => { state.event = null; state.day = 94; refreshSnowState(todayWx()); bookEvent('pond'); while (state.day < state.event.days[0]) waitDay(); for (let k = 0; k < NV*NV; k++) NS[k] = 50; refreshSnowState(todayWx()); refreshTimebar(true); })()`);
  eq(await g.ev(`state.event.type`), 'pond', 'pond skim booked');
  assert(/Pond skim today/.test(await g.ev(`$('tbSub').innerText`)), 'top bar shows pond skim');
  await g.ev(`openDay()`); await runTo(700);
  await g.ev(`syncPond()`);
  assert(await g.ev(`!!pondMesh`), 'pond built');
  assert(await drawn('drawPond') > 20, 'skimmers and a crowd are drawn');
  await g.ev(SETUPS.finishDay);
  const pond = await g.ev(`state.lastReport.pond`);
  assert(pond && pond.runs > 20 && pond.dry > 0 && pond.dry < pond.runs, `pond results: ${JSON.stringify(pond)}`);
  assert(/skim the pond/.test(await g.ev(`$('rpBody').innerText`)), 'report has the pond skim');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
