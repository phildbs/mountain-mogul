// Friday defaults keep calendar demand intact; live refreshes cannot interrupt typing names.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const days = await g.ev(`(() => {
    const ds = Array.from({ length: 110 }, (_, i) => i);
    return [ds.find(d => dateOf(d).getUTCDay() === 5 && dayKind(d) === 'weekday'), ds.find(d => dateOf(d).getUTCDay() === 5 && dayKind(d) === 'quiet')];
  })()`);
  assert(days.every(Number.isInteger), 'found ordinary and quiet Fridays');
  const [fri, quiet] = days;
  await g.ev(`state.day = ${fri}; openManage('ops')`);
  eq(await g.ev(`planFor(${fri})`), 'weekday', 'older saves retain ordinary Friday default');
  const calendar = await g.ev(`[dayKind(${fri}), dayKind(${quiet}), ticketOn(${fri})]`);
  await g.click('[data-action=opsFriday]');
  eq(await g.ev(`[planFor(${fri}), planFor(${quiet}), planFor(${fri - 1}), planFor(${fri + 1})]`), ['weekend', 'weekend', 'weekday', 'weekend'], 'all Fridays opt in; Thursday and Saturday unchanged');
  eq(await g.ev(`[dayKind(${fri}), dayKind(${quiet}), ticketOn(${fri})]`), calendar, 'demand classification and prices unchanged');
  await g.click('[data-action=opsDay][data-v=weekday]');
  eq(await g.ev(`planFor(${fri})`), 'weekday', 'one-day choice overrides Friday default');
  await g.click('[data-action=opsDay][data-v=weekend]');
  eq(await g.ev(`state.ops.override`), null, 'choosing default clears the override');
  await g.ev(`state.event = { days: [${fri}] }; state.ops.override = { day: ${fri}, plan: 'quiet' }`);
  eq(await g.ev(`planFor(${fri})`), 'weekend', 'event takes priority over override');
  await g.ev(`state.event = null; state.ops.override = null; saveNow()`);
  await g.page.reload(); await g.reloaded(); await g.click('#startBtn'); await g.wait(300);
  eq(await g.ev(`[state.ops.fridayWeekend, planFor(${fri}), planFor(${quiet})]`), [true, 'weekend', 'weekend'], 'Friday setting survives reload');
  await g.ev(`openManage('ops')`); await g.click('[data-action=opsFriday]');
  eq(await g.ev(`[planFor(${fri}), planFor(${quiet})]`), ['weekday', 'quiet'], 'switching off restores calendar plans');
  await g.click('[data-action=opsFriday]');
  await g.ev(`state.day = ${fri}; select(null); openDay()`);
  eq(await g.ev(`runOps.kind`), 'weekend', 'Friday opens using the selected plan');
  await g.ev(`state.speed = 0; openManage('ops')`); await g.click('[data-action=opsFriday]');
  eq(await g.ev(`[runOps.kind, planFor(${fri + 7})]`), ['weekend', 'weekday'], 'midday change leaves today’s snapshot intact');

  // A real editor receives every shortcut letter, even when its card changes underneath it.
  await g.ev(`setLabelKinds({ trail: true, lift: true, bld: true, chip: true }); select({ kind: 'trail', obj: realTrails()[0] })`);
  const labels = await g.ev(`JSON.stringify(labelsOn)`);
  const input = g.page.locator('#nameInput');
  await input.fill(''); await input.pressSequentially('Lo');
  await g.ev(`realTrails()[0].open = !realTrails()[0].open; renderSheet()`);
  eq(await input.evaluate(el => el === document.activeElement), true, 'refresh retains focus');
  await input.pressSequentially('llipop qwerty');
  eq(await input.inputValue(), 'Lollipop qwerty', 'all shortcut letters remain in the name');
  eq(await g.ev(`JSON.stringify(labelsOn)`), labels, 'L in a name leaves labels alone');
  await input.press('Enter'); await g.wait(100);
  eq(await g.ev(`realTrails()[0].name`), 'Lollipop qwerty', 'Enter saves edited name');
  await g.ev(`select(null); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', isComposing: true, bubbles: true }))`);
  eq(await g.ev(`JSON.stringify(labelsOn)`), labels, 'composition never fires a hotkey');
  await g.page.keyboard.press('l');
  assert(await g.ev(`LABEL_KINDS.every(k => !labelsOn[k])`), 'L still works outside editors');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
