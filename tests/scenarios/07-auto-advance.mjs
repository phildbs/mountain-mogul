// Auto-advance starts up to seven days in a row, then waits for you.
import { openGame, eq, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`setAuto(true); openDay()`);
  for (let k = 1; k <= 7; k++) {
    await g.ev(SETUPS.finishDay);
    // what the countdown does when it reaches zero
    await g.ev(`autoAdvance()`);
    eq(await g.ev(`state.phase + '/' + autoDays`), `open/${k}`, `day ${k} started and opened by itself`);
  }
  await g.ev(SETUPS.finishDay); await g.ev(`armAuto()`);
  eq(await g.ev(`autoTimer`), 0, 'no countdown after seven days');
  eq(await g.ev(`/paused after 7/.test($('rpAutoText').textContent)`), true, 'says it paused');
  await g.click('#rpNext'); await g.wait(200);
  eq(await g.ev(`state.phase + '/' + autoDays`), 'closed/0', 'manual start resets the count');
  await g.ev(`setAuto(false)`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
