// Spring skiing runs into May while the snow lasts, and always ends by May 31.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const deep = `for (let k = 0; k < NV*NV; k++) NS[k] = 80; refreshSnowState(todayWx());`;
  // Tue May 4 (day 154) with a deep base: still a spring bonus day
  await g.ev(`(() => { state.day = 154; ${deep} refreshTimebar(true); })()`);
  eq(await g.ev(`seasonOver()`), false, 'deep snow keeps the season going in May');
  eq(await g.ev(`dateLabel(state.day)`), 'Tue, May 4', 'May 4');
  assert(/Spring bonus day/.test(await g.ev(`$('tbSub').innerText`)), 'top bar says spring bonus day');
  eq(await g.ev(`dayKind(154)`), 'quiet', 'May weekdays use the quiet season plan');
  // thin snow ends it, and May 31 is the last day whatever the snow
  await g.ev(`(() => { NS.fill(0); for (const t of world.trails) t.machine = 0; refreshSnowState(todayWx()); })()`);
  eq(await g.ev(`seasonOver()`), true, 'thin snow ends the season in May');
  await g.ev(`(() => { state.day = 181; ${deep} })()`);
  eq(await g.ev(`seasonOver()`), false, 'May 31 can still open');
  await g.ev(`state.day = 182`);
  eq(await g.ev(`seasonOver()`), true, 'June 1 is summer');
  // May is warmer than April, and a pond skim can be booked for a May weekend
  assert(await g.ev(`climate(175).hi > climate(150).hi + 4`), 'late May is warmer than late April');
  await g.ev(`(() => { state.day = 156; state.event = null; ${deep} })()`);
  eq(await g.ev(`eventSlot('pond').days`), [158], 'pond skim on Sat May 8');
  // snow guns run through April and are off from May 1
  const guns = (day) => g.ev(`(() => { state.day = ${day}; for (const t of world.trails) t.sm = { on: true, mode: 'always', target: 99 }; return runSnowmaking(0).trails; })()`);
  assert(await guns(140) > 0, 'snowmaking runs on a cold April night');
  eq(await guns(155), 0, 'snowmaking is off in May');
  return 'May bonus days, the May 31 cutoff, May weather and snowmaking off in May';
}
