// After an update, a player in a resort sees what changed since the version they last played, once,
// and can react with a thumbs up or down. Brand-new players don't see it. The update bar names the update.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  // a brand-new player: no card, and the version counts as seen
  await g.click('#startBtn'); await g.wait(2400);
  eq(await g.ev(`$('updCard').hidden`), true, 'a brand-new player gets no update card');
  eq(await g.ev(`localStorage.getItem('mm.seenVersion')`), await g.ev(`VERSION`), 'and is marked up to date');
  // a player who last played 2.20 and has a resort
  await g.ev(SETUPS.juniperStarter);
  await g.ev(`(() => { localStorage.setItem('mm.seenVersion', '2.20'); localStorage.removeItem('mm.react.' + VERSION); maybeUpdateCard(); })()`);
  eq(await g.ev(`$('updCard').hidden`), false, 'a returning player sees the card');
  const card = await g.ev(`$('updCard').innerText`);
  const big = await g.ev(`latestBig()`);
  assert(card.toLowerCase().includes(big.title.toLowerCase()), `led by the latest big update (${big.title}), not the latest small one`);
  assert(/Plus small changes/.test(card), 'small changes only get a line');
  // NEW dots on where the new features live, until tapped
  assert(await g.ev(`$('manage').querySelector('[data-m=parking]').classList.contains('isnew')`), 'a NEW dot on Parking');
  // react: saved locally and online
  await g.ev(`(async () => { await __fakeSwitch('rx', 'rx@example.com'); })()`); await g.wait(1200);
  await g.click('#updCard [data-r="1"]'); await g.wait(300);
  eq(await g.ev(`$('updCard').querySelector('[data-r="1"]').getAttribute('aria-pressed')`), 'true', 'the thumbs up shows as chosen');
  const rx = await g.ev(`(JSON.parse(localStorage.getItem('FAKE_DB')).reactions || []).filter((r) => r.version === latestBig().v)`);
  eq(rx.length, 1, 'one reaction saved');
  eq(rx[0].reaction, 1, 'a thumbs up');
  await g.click('#updCard [data-r="-1"]'); await g.wait(300);
  eq(await g.ev(`(JSON.parse(localStorage.getItem('FAKE_DB')).reactions || []).filter((r) => r.version === latestBig().v).map((r) => r.reaction)`), [-1], 'changing it replaces it');
  // Show me: straight to the feature
  if (big.show) {
    await g.click('#updCard [data-show]'); await g.wait(200);
    eq(await g.ev(`[$('updCard').hidden, selected && selected.kind === 'manage' || state.tool !== 'explore']`), [true, true], 'Show me goes straight to it (its panel or its tool)');
    await g.ev(`(() => { select(null); localStorage.setItem('mm.seenVersion', '2.20'); maybeUpdateCard(); })()`);
  }
  // Got it: closed for good
  await g.click('#updOk'); await g.wait(100);
  eq(await g.ev(`[$('updCard').hidden, localStorage.getItem('mm.seenVersion') === VERSION]`), [true, true], 'Got it closes it and marks it seen');
  await g.ev(`maybeUpdateCard()`);
  eq(await g.ev(`$('updCard').hidden`), true, 'it doesn’t come back');
  await g.click('#manage [data-m=parking]'); await g.wait(100);
  eq(await g.ev(`$('manage').querySelector('[data-m=parking]').classList.contains('isnew')`), false, 'tapping Parking clears its dot');
  await g.ev(`select(null)`);
  // only small changes since last time: no card
  await g.ev(`(() => { const s = CHANGES.find((c) => !c.small); const i = CHANGES.indexOf(s); localStorage.setItem('mm.seenVersion', CHANGES[i].v); maybeUpdateCard(); })()`);
  eq(await g.ev(`[$('updCard').hidden, localStorage.getItem('mm.seenVersion') === VERSION]`), [true, true], 'small changes alone don’t interrupt');
  // the update bar names the new version's update
  await g.ev(`(async () => { window.fetch = async () => ({ ok: true, text: async () => "const CHANGES = [\\n  { v: '99.1', date: 'Jan 1, 2027', title: 'Night skiing', items: [" }); updateOffered = ''; await checkForUpdate(true); })()`);
  const bar = await g.ev(`[$('updateBar').hidden, $('updateBar').innerText]`);
  eq(bar[0], false, 'the update bar shows');
  assert(/99\.1 is ready: Night skiing/.test(bar[1]), `the update bar names the update (${bar[1]})`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
