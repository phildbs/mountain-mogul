// A new resort's first lift: the lift tool starts on a double chair and marks a good bottom station at
// the top of the base area, then a good top station. Tapping the circles builds a working lift. The
// circles go once there's a lift from the base, and the Help bulb switch hides them.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(`setTool('lift')`); await g.wait(200);
  eq(await g.ev(`draft.liftType`), 'double', 'a first lift starts as a double chair');
  const h1 = await g.ev(`liftHint()`);
  assert(h1 && h1.label === 'Suggested bottom station', 'a circle for the bottom station');
  eq(await g.ev(`$('liftHint').hidden`), false, 'shown on the map');
  const away = await g.ev(`(() => { const lot = lotCenter() || roadEnd(); return Math.round(Math.hypot(${h1.p.x} - lot.x, ${h1.p.z} - lot.z)); })()`);
  assert(away >= 18, `well clear of the parking lot, leaving room for a village (${away})`);
  assert(/just a suggestion/.test(await g.ev(`$('sheet').innerText`)), 'the panel says it is only a suggestion');
  await g.ev(`$('liftHint').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);
  await g.wait(200);
  eq(await g.ev(`draft.pts.length`), 1, 'tapping it places the bottom station');
  const h2 = await g.ev(`liftHint()`);
  assert(h2 && h2.label === 'Suggested top station', 'then a circle for the top station');
  await g.ev(`$('liftHint').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`); await g.wait(300);
  const info = await g.ev(`(() => { const v = evalLift(draft.pts[0], draft.pts[1], draft.liftType); return { problems: v.problems, fromBase: v.fromBase, cost: v.cost, cash: state.cash, vert: v.stats.vertFt }; })()`);
  eq(info.problems, [], 'a lift with no problems');
  assert(info.fromBase, 'starting from the base area');
  assert(info.cost <= info.cash * 0.55, `affordable, leaving money for a trail and a lodge (${info.cost} of ${info.cash})`);
  assert(info.vert >= 300, `with real vertical (${info.vert} ft)`);
  eq(await g.ev(`$('liftHint').hidden`), true, 'no circle once both stations are placed');
  await g.ev(`buildDraft()`); await g.wait(200);
  eq(await g.ev(`world.lifts.filter((L) => L.fromBase).length`), 1, 'built');
  await g.ev(`setTool('explore'); setTool('lift')`);
  eq(await g.ev(`liftHint()`), null, 'no circles once there is a lift from the base');
  // a brand-new resort with the Help bulb off: no circles
  await g.ev(`(() => { setTool('explore'); for (const L of [...world.lifts]) removeLift(L); computeNetwork(); setTips(false); setTool('lift'); })()`); await g.wait(200);
  eq(await g.ev(`[liftHint(), $('liftHint').hidden]`), [null, true], 'the Help bulb switch hides them');
  await g.ev(`setTips(true)`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
