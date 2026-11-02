// Catch-up bench: how long does a whole game day take to play with nothing drawn? (multiplayer feasibility)
import { startServer, launch, openGame, SETUPS } from './harness.mjs';
import { bigBuild } from './big-resort.mjs';
const DAYS = +(process.env.DAYS || 5);
const server = await startServer(), browser = await launch();
const runDays = `(async () => { const out = [];
  for (let d = 0; d < ${DAYS}; d++) { const t0 = performance.now();
    if (state.phase !== 'open') openDay(); state.speed = 0; let n = 0;
    while (state.phase === 'open' && n++ < 200000) simStep(1.5);
    const t1 = performance.now(); nextDay(); const t2 = performance.now();
    out.push({ day: Math.round(t1 - t0), night: Math.round(t2 - t1), guests: state.lastReport?.guests ?? state.lastReport?.visitors ?? null, phase: state.phase });
  } return out; })()`;
for (const [name, build] of [['starter', SETUPS.juniperStarter], ['big (26 lifts, 110 trails)', bigBuild]]) for (const slow of [1, 4]) {
  const g = await openGame(browser, server.url); await g.click('#startBtn'); await g.ev(build); await g.ev(SETUPS.midwinter);
  if (slow > 1) { const c = await g.page.context().newCDPSession(g.page); await c.send('Emulation.setCPUThrottlingRate', { rate: slow }); }
  const r = await g.ev(runDays);
  console.log(name, slow > 1 ? `CPU ${slow}x slower (phone-ish)` : 'full speed', JSON.stringify(r), 'errors:', g.errors.length);
  await g.page.close();
}
await browser.close(); server.close();
