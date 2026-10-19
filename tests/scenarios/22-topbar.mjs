// The resort badge never covers the time bar, at any width, even with a long resort name.
import { openGame, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { width: 1280, height: 800 });
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(`state.resortName = 'Phil’s Peak Mountain Resort and Spa'; $('resortName').textContent = state.resortName`);
  for (const w of [1400, 1180, 1024, 900, 800, 700, 390]) {
    await g.page.setViewportSize({ width: w, height: 800 }); await g.wait(700);
    const r = await g.ev(`(() => {
      const box = (id) => { const r = $(id).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
      const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
      const b = box('badge'), t = box('timebar'), c = box('cashBox'), d = box('tbDate');
      return { overBadge: hit(b, t), overCash: hit(c, t), dateShown: d.r - d.l > 20 && d.l >= 0 };
    })()`);
    assert(!r.overBadge && !r.overCash, `at ${w}px the time bar is clear of the badge and cash (${JSON.stringify(r)})`);
    assert(r.dateShown, `at ${w}px the date shows`);
  }
  await g.page.close();
}
