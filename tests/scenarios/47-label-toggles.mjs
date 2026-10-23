// Map labels: hide trails, lifts or buildings from the tag button, remembered on the device; L hides them all.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  let g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(`(() => { select(null); camTween = null; cam.viewGoal = null; cam.viewH = 100; updateCamera(); })()`); await g.wait(300);
  const shown = (sel) => g.ev(`[...document.querySelectorAll('#labels ${sel}')].filter((el) => !el.hidden).length`);
  const lifts = () => shown('.flabel.lift'), blds = () => shown('.flabel.bld, .flabel.lot'), trails = () => shown('.flabel:not(.lift):not(.bld):not(.lot)');
  assert(await lifts() > 0 && await trails() > 0, 'labels show to start');
  eq(await g.ev(`$('tLabels').getAttribute('aria-pressed')`), 'false', 'button not lit');
  await g.click('#tLabels'); await g.wait(100);
  eq(await g.ev(`$('labelPop').hidden`), false, 'popover opens');
  await g.click('#labelPop [data-lk=lift]'); await g.wait(300);
  eq(await lifts(), 0, 'lift labels hidden');
  assert(await trails() > 0, 'trail labels still shown');
  eq(await g.ev(`$('tLabels').getAttribute('aria-pressed')`), 'true', 'button lit while some are hidden');
  // selecting a lift still shows its label
  await g.ev(`select({ kind: 'lift', obj: world.lifts[0] })`); await g.wait(300);
  eq(await lifts(), 1, 'selected lift label shows');
  await g.ev(`select(null)`); await g.wait(100);
  // hide all, then remembered after reload
  await g.click('#labelPop [data-lk=all]'); await g.wait(300);
  eq(await trails() + await blds() + await lifts(), 0, 'all hidden');
  eq(await g.ev(`localStorage.getItem('mm.labelsOff')`), 'trail,lift,bld', 'remembered');
  await g.page.keyboard.press('Escape'); await g.wait(100);
  eq(await g.ev(`$('labelPop').hidden`), true, 'escape closes the popover');
  await g.page.keyboard.press('l'); await g.wait(300);
  assert(await trails() > 0 && await lifts() > 0, 'L brings them back');
  await g.page.keyboard.press('l'); await g.wait(300);
  eq(await lifts(), 0, 'L hides them again');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
