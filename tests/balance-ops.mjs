// One-off balance check (not a scenario): a season with everything open vs. sensible plans vs. over-cutting.
import { startServer, launch, openGame, SETUPS } from './harness.mjs';
const server = await startServer(), browser = await launch();
const PLANS = {
  open: `null`,
  smart: `{ plans: { weekday: { lifts: {}, bld: { [world.buildings[0].id]: 'lunch' }, lots: null, hours: 'full', staff: 'lean', patrol: 'full' },
    weekend: { lifts: {}, bld: {}, lots: null, hours: 'full', staff: 'normal', patrol: 'full' },
    quiet: { lifts: {}, bld: { [world.buildings[0].id]: 'lunch' }, lots: null, hours: 'short', staff: 'lean', patrol: 'full' } }, override: null }`,
  gutted: `(() => { const p = { lifts: { [world.lifts[0].id]: 'slow' }, bld: { [world.buildings[0].id]: 'lunch' }, lots: null, hours: 'short', staff: 'lean', patrol: 'skeleton' };
    return { plans: { weekday: p, weekend: p, quiet: p }, override: null }; })()`,
};
for (const [mt, setup] of [['juniper', SETUPS.juniperStarter], ['raven', SETUPS.ravenStarter]]) {
  const out = [];
  for (const [name, plan] of Object.entries(PLANS)) {
    const runs = [];
    for (let k = 0; k < 2; k++) {
      const g = await openGame(browser, server.url, { query: '?dev', mountain: mt });
      await g.click('#startBtn'); await g.wait(400);
      await g.ev(setup); await g.ev(`state.ops = ${plan}`);
      runs.push(await g.page.evaluate(async () => { const r = await window.mmDev.simulate({ seasons: 1 }); return { c: r.cashChange, rep: r.rep, sat: Math.round(r.log.reduce((a, x) => a + x.sat, 0) / r.log.length) }; }));
      await g.page.close();
    }
    out.push(`${name}: ${runs.map((r) => `${r.c} (sat ${r.sat}, rep ${r.rep.toFixed(2)})`).join(' / ')}`);
  }
  console.log(mt + '\n  ' + out.join('\n  '));
}
await browser.close(); server.close();
