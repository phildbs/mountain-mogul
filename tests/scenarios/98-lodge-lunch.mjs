import { openGame, eq, SETUPS } from '../harness.mjs';
import { lodgeLunchCases } from '../lodge-lunch-cases.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`openDay(); state.speed = 0`);
  const result = await g.ev(`(${lodgeLunchCases.toString()})()`);
  eq(result.seats, [120, 360, 800], 'all lodge sizes serve and satisfy lunch');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
