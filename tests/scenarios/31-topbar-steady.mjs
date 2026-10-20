// The top bar settles on one layout: a growing cash figure or a ticking clock may tighten it, but it never
// flips back and forth between sizes while the window and the day's phase stay the same.
import { openGame, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { width: 1100, height: 800 });
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`openDay()`);
  for (const w of [900, 980, 1060, 1140, 1220, 1300]) {
    await g.page.setViewportSize({ width: w, height: 800 }); await g.wait(600);
    const seq = await g.ev(`(() => { const order = ['', 'badge-sm', 'badge-icon', 'tb-tight', 'tb-low'], level = () => Math.max(0, ...order.map((c, i) => (c && document.body.classList.contains(c) ? i : 0))), out = [];
      fitTopBar(); out.push(level());
      for (let k = 0; k < 12; k++) {
        state.cash = k % 2 ? 123456789 : 1234; updateCash(false);
        for (let n = 0; n < 200; n++) simStep(0.5);
        refreshTimebar(true); fitTopBar(); out.push(level());
      }
      return out; })()`);
    for (let i = 1; i < seq.length; i++) assert(seq[i] >= seq[i - 1], `at ${w}px the top bar never loosens back mid-day (${seq.join(',')})`);
    assert(new Set(seq).size <= 2, `at ${w}px the top bar settles (${seq.join(',')})`);
  }
  assert(g.errors.length === 0, `no page errors (${g.errors})`);
  await g.page.close();
}
