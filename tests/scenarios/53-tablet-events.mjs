// Narrow tablets: the top bar stays on screen and clear of the badge and cash. And an event booking
// left over from last season is cancelled and refunded instead of blocking new bookings.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  for (const w of [700, 768, 834]) {
    const g = await openGame(browser, url, { width: w, height: 1100 });
    await g.click('#startBtn'); await g.wait(400);
    await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
    for (const phase of ['closed', 'open']) {
      if (phase === 'open') await g.ev(`openDay()`);
      await g.ev(`(() => { state.debt = 3353850; updateCash(true); refreshTimebar(true); fitKey = ''; fitTopBar(); })()`); await g.wait(300);
      const r = await g.ev(`(() => { const box = (id) => $(id).getBoundingClientRect(), t = box('timebar'), b = box('badge'), k = box('cashBox'), tip = box('tipsBtn');
        const hit = (p, q) => p.left < q.right && p.right > q.left && p.top < q.bottom && p.bottom > q.top;
        return { inside: t.left >= 0 && t.right <= innerWidth, badge: hit(t, b), cash: hit(t, k), tip: hit(t, tip) && !$('tipsBtn').hidden }; })()`);
      eq(r, { inside: true, badge: false, cash: false, tip: false }, `top bar at ${w}px, ${phase}`);
    }
    eq(g.errors, [], 'no page errors');
    await g.page.close();
  }
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  // a pond skim booked for a spring weekend last season that never came
  const r = await g.ev(`(() => { state.day = 9; state.event = { type: 'pond', days: [131] }; state.eventsHeld = { season: state.season - 1, types: ['pond'] }; const c0 = state.cash; cancelStaleEvent(); return { event: state.event, refund: state.cash - c0 }; })()`);
  eq(r, { event: null, refund: 15000, }, 'leftover booking cancelled and refunded');
  eq(await g.ev(`(() => { state.day = 14; return eventSlot('torch').days; })()`), [18], 'a new event can be booked');
  // and at the end of a season, a booking that hasn't happened yet is refunded
  const s = await g.ev(`(() => { state.event = { type: 'race', days: [state.day + 3, state.day + 4] }; const c0 = state.cash; enterSummer(); return { event: state.event, refund: state.cash - c0 }; })()`);
  eq(s, { event: null, refund: 30000 }, 'season end refunds a booking that never happened');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
