// New players start on Dec 10 with snow on the mountain and get a welcome that says what to build, and the lightbulb's "What next?" list walks them
// from an empty mountain to opening day, with a button for each step.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(2200);
  eq(await g.ev(`selected && selected.kind + ':' + selected.obj`), 'advice:welcome', 'a new mountain opens with the welcome');
  const w = await g.ev(`$('sheet').innerText`);
  assert(/Dec 10 and the snow is in/.test(w), 'it starts in December, with snow: ' + w.slice(0, 200));
  eq(await g.ev(`[state.day, state.treeSnow, avgBase() > 0 || NS.some((v) => v >= 20)]`), [9, 1, true], 'snow on the ground and on the trees');
  assert(/Build your first chairlift/.test(w), 'and the first step');
  eq(await g.ev(`$('tbSub').querySelector('.tb-st').textContent`), 'Not open yet · build a lift and a trail', 'the status line says what to do');
  // the step's button takes you there
  await g.click('#sheet [data-action=advice][data-v="0"]'); await g.wait(100);
  eq(await g.ev(`state.tool`), 'lift', 'Build a lift picks the lift tool');
  await g.ev(`setTool('explore')`);
  // built: ready to open straight away
  await g.ev(SETUPS.juniperStarter); await g.ev(`state.lastReport = null; refreshTimebar(true)`);
  eq(await g.ev(`$('tbSub').querySelector('.tb-st').textContent`), 'Ready for opening day!', 'a new resort can open as soon as it is built');
  // a pre-season start (as later seasons have): no snow yet
  await g.ev(`(() => { state.day = -10; seedPreseasonSnow(); for (const t of world.trails) t.base = 0; refreshSnowState(todayWx()); refreshTimebar(true); })()`);
  const ws = await g.ev(`$('tbSub').querySelector('.tb-st').textContent`); assert(/^Waiting for snow · trails [0-9]+″ of 12″$/.test(ws), 'waiting for snow, with the depths: ' + ws);
  const a = await g.ev(`advice().map((x) => x.label)`);
  eq(a[0], 'Stay closed for a week', 'the top step is to wait for snow');
  assert(a.includes('My trails'), 'and snowmaking is suggested');
  assert(await g.ev(`$('tipsBtn').classList.contains('nudge')`), 'the lightbulb pulses');
  await g.click('#tipsBtn'); await g.wait(100);
  assert(!(await g.ev(`$('tipsBtn').classList.contains('nudge')`)), 'and stops once looked at');
  await g.click('#tipsBtn'); await g.wait(100);
  eq(await g.ev(`selected`), null, 'tapping it again closes the list');
  // snow arrives: ready to open
  await g.ev(SETUPS.midwinter); await g.ev(`refreshTimebar(true)`);
  eq(await g.ev(`$('tbSub').querySelector('.tb-st').textContent`), 'Ready for opening day!', 'ready to open');
  await g.click('#tipsBtn'); await g.wait(100);
  const i = await g.ev(`adviceShown.findIndex((x) => x.label === 'Open for the day')`);
  assert(i >= 0, 'the list says to open');
  await g.click(`#sheet [data-action=advice][data-v="${i}"]`); await g.wait(100);
  eq(await g.ev(`state.phase`), 'open', 'and its button opens the day');
  // the welcome only shows once
  await g.ev(`(() => { closeEarly && 0; saveNow(); })()`);
  await g.page.reload(); await g.reloaded(); await g.click('#startBtn').catch(() => {}); await g.wait(2200);
  assert(!(await g.ev(`selected && selected.obj === 'welcome'`)), 'no second welcome');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
