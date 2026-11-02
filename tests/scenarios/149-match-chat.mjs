// The match chat: from the match screen, Chat shows the match's messages and news and counts new ones; a player
// writes as their resort, too fast or rude is refused with the reason, reactions toggle, a muted player's
// messages hide (privately), a message can be reported, and a finished match's chat is read only.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter);
  const save = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();
  const g = await openGame(browser, url);
  const at = (min) => new Date(Date.now() + min * 60000).toISOString(), names = ['Summit Ridge', 'Phil’s Peak', 'Rival Run'];
  const lob = (id, name, status) => ({ id, name, map: 'match', slots: 3, starts_at: at(-60), days: 168, day_minutes: 30, status, day: 2, prize: null });
  const match = { lobbies: [lob('C1', 'Chat Cup', 'running'), lob('C2', 'Done Cup', 'finished')],
    players: ['C1', 'C2'].flatMap((l) => [0, 1, 2].map((s) => ({ lobby_id: l, slot: s, user_id: [null, 'user-B', 'u-rival'][s], resort_name: names[s] }))),
    resorts: ['C1', 'C2'].flatMap((l) => [0, 1, 2].map((s) => ({ lobby_id: l, slot: s, day: 2, save, summary: { name: names[s], profit: s * 100 } }))),
    messages: [{ id: 1, lobby_id: 'C1', user_id: null, slot: null, name: 'Chat Cup', body: 'Chat Cup has started. Good luck!', kind: 'news', day: 0, hidden: false, created_at: at(-50) },
      { id: 2, lobby_id: 'C1', user_id: 'u-rival', slot: 2, name: 'Rival Run', body: 'Nice lift, neighbour', kind: 'chat', day: 1, hidden: false, created_at: at(-40) },
      { id: 3, lobby_id: 'C1', user_id: 'u-rival', slot: 2, name: 'Rival Run', body: 'Hidden one', kind: 'chat', day: 1, hidden: true, created_at: at(-39) },
      { id: 4, lobby_id: 'C2', user_id: null, slot: null, name: 'Done Cup', body: 'Final standings: …', kind: 'news', day: 2, hidden: false, created_at: at(-30) }],
    reactions: [{ message_id: 2, user_id: 'u-x', emoji: '😂' }] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  const into = async (id) => {
    await g.click('#mpCard'); await g.page.waitForSelector(`[data-mp=open][data-id=${id}]`, { timeout: 10000 }); await g.page.click(`[data-mp=open][data-id=${id}]`);
    await g.reloaded(); await g.page.waitForFunction(() => window.__dbg('!!matchView && MC.lid'), null, { timeout: 20000 }); await g.wait(800);
  };
  await into('C1');
  assert(await g.page.isVisible('#visitChat'), 'the match bar has a Chat button');

  // A new message from a rival is counted on the button.
  await g.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.match.messages.push({ id: 5, lobby_id: 'C1', user_id: 'u-rival', slot: 2, name: 'Rival Run', body: 'Powder tomorrow!', kind: 'chat', day: 2, hidden: false, created_at: new Date().toISOString() }); localStorage.setItem('FAKE_DB', JSON.stringify(d)); });
  await g.ev('mcLoad()'); await g.wait(300);
  eq(await g.page.innerText('#visitChat'), 'Chat · 1', 'new messages are counted');
  await g.click('#visitChat'); await g.wait(400);
  let t = await g.page.innerText('#sheet');
  assert(/Match chat/i.test(t) && /Chat Cup has started/.test(t) && /Nice lift, neighbour/.test(t) && /Powder tomorrow/.test(t) && !/Hidden one/.test(t), `the chat shows news and messages, not hidden ones (${t.slice(0, 300)})`);
  assert(/😂 1/.test(t), 'with their reactions');
  eq(await g.page.innerText('#visitChat'), 'Chat', 'opening the chat clears the count');

  // Write a message; then too fast, then rude.
  const say = async (text) => { await g.page.fill('#mcText', text); await g.page.click('#mcForm button[type=submit]'); await g.wait(500); return g.page.innerText('#sheet'); };
  t = await say('Good luck everyone!');
  assert(/Phil’s Peak[\s\S]*Good luck everyone!/.test(t), 'you write as your resort');
  t = await say('again');
  assert(/Slow down a little/.test(t), 'one message every 10 seconds');
  await g.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); for (const x of d.match.messages) x.created_at = new Date(Date.now() - 60000).toISOString(); localStorage.setItem('FAKE_DB', JSON.stringify(d)); });
  t = await say('you are shit');
  assert(/Please keep it friendly/.test(t), 'rude messages are refused');
  // Sent with Enter, a message shows straight away with the cursor still in the box, and letters there aren't shortcuts.
  await g.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); for (const x of d.match.messages) x.created_at = new Date(Date.now() - 60000).toISOString(); localStorage.setItem('FAKE_DB', JSON.stringify(d)); });
  await g.page.click('#mcText'); await g.page.keyboard.type('see you 3 wasd'); await g.page.keyboard.press('Enter'); await g.wait(600);
  assert(/see you 3 wasd/.test(await g.page.innerText('#mcList')), 'a message sent with Enter shows straight away');
  eq(await g.ev(`[document.activeElement.id, document.getElementById('mcText').value, state.tool, selected && selected.kind]`), ['mcText', '', 'explore', 'mchat'], 'and you can keep typing');

  // React, take it back, mute, report.
  await g.page.click('[data-mc=menu][data-id="2"]'); await g.page.click('[data-mc=react][data-id="2"][data-e="🔥"]'); await g.wait(400);
  assert(/🔥 1/.test(await g.page.innerText('#sheet')), 'you can react');
  await g.page.click('.mc-reacts [data-e="🔥"]'); await g.wait(400);
  assert(!/🔥 1/.test(await g.page.innerText('#sheet')), 'and take it back');
  await g.page.click('[data-mc=menu][data-id="2"]'); await g.page.click('[data-mc=report][data-id="2"]'); await g.wait(300);
  assert(/take a look/.test(await g.page.innerText('#toast')), 'a message can be reported');
  await g.page.click('[data-mc=menu][data-id="5"]'); await g.page.click('[data-mc=mute]'); await g.wait(400);
  t = await g.page.innerText('#sheet');
  assert(!/Powder tomorrow/.test(t) && /2 messages from people you muted are hidden/.test(t), 'muting hides their messages');
  const db = await g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match);
  eq([db.mutes.map((x) => [x.user_id, x.muted]), db.reports.map((x) => x.message_id)], [[['user-B', 'u-rival']], [2]], 'the mute and the report are saved');
  await g.page.click('[data-mc=unmute]'); await g.wait(400);
  assert(/Powder tomorrow/.test(await g.page.innerText('#sheet')), 'and can be undone');

  // On a phone it fits.
  await g.page.setViewportSize({ width: 390, height: 844 }); await g.wait(400);
  const over = await g.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(over <= 1, `fits a phone (${over})`);
  if (process.env.SHOTS) { await g.ev("document.getElementById('updCard').hidden = true"); if (!(await g.page.isVisible('#mcList'))) await g.click('#visitChat'); await g.wait(400); await g.page.screenshot({ path: 'match-chat.png' }); }
  await g.page.setViewportSize({ width: 1280, height: 900 });

  // A finished match's chat stays as a record, closed to new messages.
  await g.click('#visitHome'); await g.reloaded();
  await into('C2');
  await g.click('#visitChat'); await g.wait(400);
  t = await g.page.innerText('#sheet');
  assert(/Final standings/.test(t) && /chat is closed/.test(t) && !(await g.page.$('#mcText')), 'a finished match’s chat is read only');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
