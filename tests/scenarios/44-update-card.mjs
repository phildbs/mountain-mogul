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
  assert(card.includes(await g.ev(`CHANGES[0].title`)) || card.toLowerCase().includes((await g.ev(`CHANGES[0].title`)).toLowerCase()), 'with the latest update’s title');
  assert(card.includes(await g.ev(`CHANGES[1].title`)) && card.includes(await g.ev(`CHANGES[2].title`)), 'and names the two before it');
  // react: saved locally and online
  await g.ev(`(async () => { await __fakeSwitch('rx', 'rx@example.com'); })()`); await g.wait(1200);
  await g.click('#updCard [data-r="1"]'); await g.wait(300);
  eq(await g.ev(`$('updCard').querySelector('[data-r="1"]').getAttribute('aria-pressed')`), 'true', 'the thumbs up shows as chosen');
  const rx = await g.ev(`(JSON.parse(localStorage.getItem('FAKE_DB')).reactions || []).filter((r) => r.version === VERSION)`);
  eq(rx.length, 1, 'one reaction saved');
  eq(rx[0].reaction, 1, 'a thumbs up');
  await g.click('#updCard [data-r="-1"]'); await g.wait(300);
  eq(await g.ev(`(JSON.parse(localStorage.getItem('FAKE_DB')).reactions || []).filter((r) => r.version === VERSION).map((r) => r.reaction)`), [-1], 'changing it replaces it');
  // Got it: closed for good
  await g.click('#updOk'); await g.wait(100);
  eq(await g.ev(`[$('updCard').hidden, localStorage.getItem('mm.seenVersion') === VERSION]`), [true, true], 'Got it closes it and marks it seen');
  await g.ev(`maybeUpdateCard()`);
  eq(await g.ev(`$('updCard').hidden`), true, 'it doesn’t come back');
  // the update bar names the new version's update
  await g.ev(`(async () => { window.fetch = async () => ({ ok: true, text: async () => "const CHANGES = [\\n  { v: '99.1', date: 'Jan 1, 2027', title: 'Night skiing', items: [" }); updateOffered = ''; await checkForUpdate(true); })()`);
  const bar = await g.ev(`[$('updateBar').hidden, $('updateBar').innerText]`);
  eq(bar[0], false, 'the update bar shows');
  assert(/99\.1 is ready: Night skiing/.test(bar[1]), `the update bar names the update (${bar[1]})`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
