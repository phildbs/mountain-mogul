// Last call: venues close in stages, the bar stays open until last call, night owls go round again,
// security costs after 10, light security risks a rowdy reputation, and Skip to last call jumps ahead.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const ok = await g.ev(`(() => {
    state.cash = 5e6; state.passPrice = 0;
    const lodge = world.buildings.find((B) => B.type === 'lodge');
    for (let r = 6; r < 30; r += 1) for (let a = 0; a < 16; a++) { const x = Math.round((lodge.door.x + Math.cos(a / 16 * 6.283) * r) * 2) / 2, z = Math.round((lodge.door.z + Math.sin(a / 16 * 6.283) * r) * 2) / 2; const v = evalBuilding('bar', x, z, 0, false); if (!v.problems.length) { commitBuilding(v, 'bar', x, z, 0); computeNetwork(); return true; } }
    return false; })()`);
  assert(ok, 'bar built');
  eq(await g.ev(`clockLabel(1500)`), '1:00 AM', '1 AM reads as AM');
  await g.ev(`(() => { for (const k of ['weekday', 'weekend', 'quiet']) Object.assign(opsState().plans[k], { apres: 'on', lastCall: 1380, security: 'light' }); })()`);
  await g.ev(`(() => { opsEdit = 'weekend'; openManage('evenings'); })()`);
  assert(await g.ev(`!!document.querySelector('[data-action=opsLastCall][data-v="1380"][aria-pressed=true]') && !!document.querySelector('[data-action=opsSecurity]')`), 'Evenings shows last call and security');
  await g.ev(`select(null); openDay()`);
  await g.ev(`(() => { let n = 0; while (state.time < 1250 && n < 99999) { simStep(1.5); n++; } refreshTimebar(true); })()`);
  const mid = await g.ev(`(() => { const lodge = world.buildings.find((B) => B.type === 'lodge'), bar = world.buildings.find((B) => B.type === 'bar');
    return { phase: state.phase, lodge: bldOpenNow(lodge), bar: bldOpenNow(bar), skip: $('tbGo').textContent, enabled: !$('tbGo').disabled }; })()`);
  eq(mid, { phase: 'open', lodge: false, bar: true, skip: 'Skip to last call', enabled: true }, 'at 8:50 PM the lodge has closed, the bar is open, and you can skip');
  await g.click('#tbGo');
  const t = await g.ev(`state.phase === 'open' ? state.time : 9999`);
  assert(t >= 1380, `skipped to last call: ${t}`);
  await g.ev(SETUPS.finishDay);
  const r = await g.ev(`state.lastReport.apres`);
  assert(r.security > 0 && r.lastCall === 1380, `security paid: ${JSON.stringify({ s: r.security, lc: r.lastCall })}`);
  assert(Object.keys(r.hours).some((h) => +h >= 20), `guests late in the evening: ${JSON.stringify(r.hours)}`);
  assert(/Hour by hour/.test(await g.ev(`document.querySelector('.rp-page[data-page=apres]').textContent`)), 'hour-by-hour on the report');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
