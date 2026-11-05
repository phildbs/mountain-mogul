// Spring skiing goes on while a lift from the base and trails with snow still loop back to it (James Rothman's idea),
// not on the average base. Old matches keep the average rule. Owners can end the season early.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  // Apr 20 (day 140): one trail deep with machine snow, the other bare, so the average base is under 18 inches
  const snow = (a, b) => g.ev(`(() => { NS.fill(0); const [A, B] = realTrails(); A.machine = ${a}; B.machine = ${b}; refreshSnowState(todayWx()); return { avg: avgBase(), ok: [A.snowOk, B.snowOk] }; })()`);
  await g.ev(`state.day = 140`);
  const r = await snow(30, 0);
  assert(r.avg < 18 && r.ok[0] && !r.ok[1], `one trail open, average ${r.avg.toFixed(1)} in`);
  eq(await g.ev(`springLoop()`), true, 'the deep trail still brings skiers back to the base');
  eq(await g.ev(`seasonOver()`), false, 'so the season goes on, under an 18-inch average');
  await g.ev(`state.springRule = 'avg'`);
  eq(await g.ev(`seasonOver()`), true, 'an old match keeps the average rule');
  eq(await g.ev(`saveData(false).clock.springRule`), 'avg', 'the old rule is saved');
  await g.ev(`state.springRule = null`);
  eq(await g.ev(`saveData(false).clock.springRule`), undefined, 'the new rule needs nothing in the save');
  await snow(0, 0);
  eq(await g.ev(`seasonOver()`), true, 'no trail with snow: the season ends');
  eq(await g.ev(`(() => { state.day = 100; return seasonOver(); })()`), false, 'before April the snow never ends the season');
  // snow on a trail that only gets home over a bare one doesn't count
  await g.ev(`state.day = 140`); await snow(30, 0);
  eq(await g.ev(`(() => { const [A, B] = realTrails(), to = A.to; A.to = { kind: 'trail', obj: B }; const r = springLoop(); A.to = to; return r; })()`), false, 'a bare trail on the way home breaks the loop');
  // the Snow panel explains the rule, and the owner can end the season overnight
  await snow(30, 0);
  await g.ev(`openManage('snow')`); await g.wait(200);
  const txt = await g.ev(`$('sheet').innerText`);
  assert(/bring skiers back to the base/.test(txt), 'Snow panel explains the spring rule');
  await g.ev(`$('sheet').querySelector('[data-action=seasonEnd]').click()`); await g.wait(100);
  assert(await g.ev(`!!$('sheet').querySelector('[data-action=seasonYes]')`), 'it asks first');
  await g.ev(`$('sheet').querySelector('[data-action=seasonNo]').click()`); await g.wait(100);
  eq(await g.ev(`state.phase`), 'closed', 'Keep going keeps the season');
  await g.ev(`$('sheet').querySelector('[data-action=seasonEnd]').click()`); await g.wait(100);
  await g.ev(`$('sheet').querySelector('[data-action=seasonYes]').click()`); await g.wait(300);
  eq(await g.ev(`state.phase`), 'season', 'the season is over');
  assert(/You ended the season in spring/.test(await g.ev(`$('rpBody').innerText`)), 'the season report says why');
  eq(await g.ev(`saveData(false).clock.seasonStats.shut`), true, 'and it is saved');
  // in a match the server does it from the order, before the day plays
  await g.ev(`(() => { state.phase = 'closed'; state.seasonStats = newSeasonStats(); state.day = 100; })()`);
  assert(await g.ev(`matchDo('other', { seasonEnd: true })`), 'not before April');
  await g.ev(`state.day = 140`);
  eq(await g.ev(`matchDo('other', { seasonEnd: true })`), '', 'the server ends it in spring');
  eq(await g.ev(`state.phase`), 'season', 'closed from this morning');
  // a match player's button only sends the order: their screen keeps playing until the server ends it
  await g.ev(`(() => { state.phase = 'closed'; state.seasonStats = newSeasonStats(); matchPlay = { lobby: 'x', slot: 0 }; matchView = { pending: 0, players: [], resorts: [], lobby: { name: 'Test', status: 'running', day: 140, days: 168 } }; openManage('snow'); })()`); await g.wait(200);
  await g.ev(`$('sheet').querySelector('[data-action=seasonEnd]').click()`); await g.wait(100);
  assert(/from tomorrow morning/.test(await g.ev(`$('sheet').innerText`)), 'a match asks about tomorrow morning');
  await g.ev(`$('sheet').querySelector('[data-action=seasonYes]').click()`); await g.wait(200);
  eq(await g.ev(`[state.phase, !!matchView.seasonEnd]`), ['closed', true], 'noted, not ended on the screen');
  assert(/Your season ends tomorrow morning/.test(await g.ev(`$('sheet').innerText`)), 'the panel says it ends tomorrow');
  await g.ev(`(() => { matchPlay = null; matchView = null; })()`);
  return 'spring loop rule, old-match average rule, ending the season early';
}
