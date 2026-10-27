// Skip to the day report: ⏭ (or K) plays out the rest of the day without drawing it and opens the
// report; Stop and watch drops back into the day; a parade night stops at dusk for the show.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
const waitFor = async (g, cond, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await g.ev(cond)) return true; await g.wait(200); } return false; };
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  eq(await g.ev(`$('tbSkip').hidden`), true, 'no skip button before the day opens');
  await g.ev(`(() => { openDay(); state.speed = 4; refreshTimebar(true); })()`);
  eq(await g.ev(`$('tbSkip').hidden`), false, 'the skip button shows while open');
  // skip to the report
  await g.click('#tbSkip'); await g.wait(100);
  eq(await g.ev(`$('skipCard').hidden`), false, 'the skipping card shows');
  assert(await waitFor(g, `state.phase === 'report'`), 'the day plays out to its report');
  eq(await g.ev(`[$('report').hidden, $('skipCard').hidden, state.speed, state.lastReport.guests > 0]`), [false, true, 4, true], 'the report opens, the card goes, speed is kept');
  // Stop and watch
  await g.ev(`(() => { $('report').hidden = true; nextDay(); openDay(); })()`);
  const t0 = await g.ev(`state.time`);
  await g.page.keyboard.press('k'); await g.wait(150);
  await g.click('#skipStop'); await g.wait(200);
  eq(await g.ev(`[state.phase, $('skipCard').hidden, state.speed]`), ['open', true, 4], 'Stop and watch drops back into the day at the same speed');
  assert(await g.ev(`state.time`) > t0, 'having skipped part of it');
  // a parade night stops at dusk
  await g.ev(`(() => { closeEarly(); })()`);
  await waitFor(g, `state.phase === 'report'`, 20000);
  await g.ev(`(() => { $('report').hidden = true; nextDay(); state.event = { type: 'torch', days: [state.day] }; openDay(); })()`);
  await g.click('#tbSkip');
  assert(await waitFor(g, `!skipRun`), 'the skip ends');
  eq(await g.ev(`[state.phase, Math.round(state.time) >= TORCH.parade[0] - 6 && state.time < TORCH.parade[0]]`), ['open', true], 'it stops just before the torchlight parade');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
