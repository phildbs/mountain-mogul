// The top of the screen: the resort badge never covers the time bar, at any width, even with a
// long resort name, and the cash figure stays current.
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
      return { overBadge: hit(b, t), overCash: hit(c, t), dateShown: d.r - d.l > 20 && d.l >= 0, top: t.t };
    })()`);
    assert(!r.overBadge && !r.overCash, `at ${w}px the time bar is clear of the badge and cash (${JSON.stringify(r)})`);
    assert(r.dateShown, `at ${w}px the date shows`);
    if (w >= 900) assert(r.top < 40, `at ${w}px the time bar stays at the top; the badge shrinks instead (top ${Math.round(r.top)})`);
  }
  // the cash in the corner keeps up with every sale and cost, not just ticket sales
  await g.page.setViewportSize({ width: 1280, height: 800 });
  await g.ev(`state.cash += 12345`); await g.wait(300);
  const shown = await g.ev(`[$('cash').textContent, money(state.cash)]`);
  if (shown[0] !== shown[1]) throw new Error(`cash display is stale: shows ${shown[0]}, has ${shown[1]}`);
  await g.page.close();
}
