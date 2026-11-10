// iPad: the title screen scrolls with a finger. It used to let touches fall through to the 3D view
// (pointer-events: none), which iPad Safari won't scroll, so players couldn't reach the lower cards.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  for (const [width, height] of [[768, 1024], [1024, 768], [1024, 600]]) {
    const g = await openGame(browser, url, { width, height, hasTouch: true });
    const t = await g.ev(`(() => { const t = $('title'); return { pe: getComputedStyle(t).pointerEvents, over: t.scrollHeight - t.clientHeight, hidden: t.hidden }; })()`);
    eq(t.hidden, false, `${width}×${height}: title showing`);
    eq(t.pe, 'auto', `${width}×${height}: the title takes touches itself`);
    // a finger in the gap beside the cards lands on the title, not the 3D view behind it
    const hit = await g.ev(`(() => { const e = document.elementFromPoint(innerWidth - 4, innerHeight / 2); return e && (e.id || e.tagName); })()`);
    assert(hit !== 'view' && hit !== 'CANVAS', `${width}×${height}: a touch beside the cards stays on the title screen (got ${hit})`);
    if (t.over > 20) {
      // swipe up with a real touch drag
      const cdp = await g.page.context().newCDPSession(g.page);
      const tp = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(width * 0.3), y }] });
      const y0 = Math.round(height * 0.7);
      await tp('touchStart', y0); for (let i = 1; i <= 15; i++) { await tp('touchMove', y0 - i * 20); await g.wait(16); } await tp('touchEnd');
      await g.wait(300);
      assert(await g.ev(`$('title').scrollTop`) > 20, `${width}×${height}: a swipe scrolls the title screen`);
      if (width > height) eq(await g.ev(`$('titleSlots').classList.contains('flow')`), true, `${width}×${height}: too short for it all, so the list isn't a scroller of its own`);
    }
    // once the game starts the title stops catching touches while it fades
    await g.click('#startBtn'); await g.wait(100);
    eq(await g.ev(`getComputedStyle($('title')).pointerEvents`), 'none', `${width}×${height}: the fading title lets touches through`);
    eq(g.errors, [], 'no page errors');
    await g.page.close();
  }
}
