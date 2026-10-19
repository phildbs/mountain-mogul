// Balance guards: a starter resort's first season on each mountain lands in a sensible range,
// and the developer simulator leaves the resort untouched when not keeping results.
import { openGame, assert, SETUPS } from '../harness.mjs';
export const slow = true; // a whole simulated season on each mountain: run it when the economy changes
async function firstSeason(browser, url, mountain, setup) {
  const g = await openGame(browser, url, { query: '?dev', mountain });
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(setup);
  const before = await g.ev(`Math.round(state.cash) + '/' + state.day`);
  const r = await g.page.evaluate(async () => { const r = await window.mmDev.simulate({ seasons: 1 }); return { change: r.cashChange, open: r.log.length }; });
  assert(await g.ev(`Math.round(state.cash) + '/' + state.day`) === before, 'simulating on a copy restores the resort');
  // Weather varies from season to season, and low Maple Notch can lose weeks to a thin-snow winter.
  assert(r.open > (mountain === 'maple' ? 70 : 80), `${mountain}: season had open days (${r.open})`);
  await g.page.close();
  return r;
}
export default async function ({ browser, url }) {
  const j = await firstSeason(browser, url, 'juniper', SETUPS.juniperStarter);
  assert(j.change > -400000 && j.change < 800000, `Juniper starter season 1 cash change in range (${j.change})`);
  const r = await firstSeason(browser, url, 'raven', SETUPS.ravenStarter);
  assert(r.change > -600000 && r.change < 600000, `Raven starter season 1 cash change in range (${r.change})`);
  const m = await firstSeason(browser, url, 'maple', SETUPS.mapleStarter);
  assert(m.change > -300000 && m.change < 800000, `Maple starter season 1 cash change in range (${m.change})`);
  const fmt = (n) => `${n >= 0 ? '+' : '−'}$${Math.abs(n).toLocaleString('en-US')}`;
  return `season 1 before summer upkeep · Juniper starter ${fmt(j.change)}, Raven starter ${fmt(r.change)}, Maple starter ${fmt(m.change)}`;
}
