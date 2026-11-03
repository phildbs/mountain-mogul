// The match chat, during the live day, opens on its newest message and stays there after you send one, on a computer and on a phone,
// whether the message goes with the Send button or with Enter. Also: a match resort can't be started over.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter);
  const save = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();
  for (const phone of [false, 'tall', 'short']) {
    const g = await openGame(browser, url, phone ? { width: 390, height: phone === 'short' ? 600 : 844, hasTouch: true } : {});
    const at = (min) => new Date(Date.now() + min * 60000).toISOString(), names = ['Summit Ridge', 'Phil’s Peak', 'Rival Run'];
    const match = { lobbies: [{ id: 'C1', name: 'Chat Cup', map: 'match', slots: 3, starts_at: at(-65), days: 168, day_minutes: 30, status: 'running', day: 2, prize: null }],
      players: [0, 1, 2].map((s) => ({ lobby_id: 'C1', slot: s, user_id: [null, 'user-B', 'u-rival'][s], resort_name: names[s] })), orders: [],
      days: [{ lobby_id: 'C1', day: 2, results: { wx: 'sunny', share: [200, 250, 200], resorts: [0, 1, 2].map((s) => ({ slot: s, guests: 200, profit: 1000 })) } }],
      resorts: [0, 1, 2].map((s) => ({ lobby_id: 'C1', slot: s, day: 2, save, summary: { name: names[s], profit: s * 100 } })),
      messages: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, lobby_id: 'C1', user_id: 'u-rival', slot: 2, name: 'Rival Run', body: `Message number ${i + 1}`, kind: 'chat', day: 1, hidden: false, created_at: at(-50 + i) })) };
    await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
    await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
    await g.click('#mpCard'); await g.page.waitForSelector('[data-mp=open][data-id=C1]', { timeout: 10000 }); await g.page.click('[data-mp=open][data-id=C1]');
    await g.reloaded(); await g.page.waitForFunction(() => window.__dbg('!!matchView && MC.lid && MC.msgs.length'), null, { timeout: 20000 }); await g.wait(800);
    // during the live day, when the card is redrawn twice a second
    await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
    const who = phone ? `${phone} phone` : 'computer';
    const tap = async (s) => { try { await g.page.click(s, { timeout: 5000 }); } catch (e) { const m = String(e.message).match(/<[^\n]*intercepts pointer events/); throw new Error(`${who}: can't tap ${s}${m ? ': ' + m[0] : ''}`); } };
    // the newest message is in view: inside the list, and the list itself inside the card
    const newest = (text) => g.page.evaluate((t) => {
      const li = [...document.querySelectorAll('#mcList li')].find((x) => x.textContent.includes(t)); if (!li) return 'missing';
      const r = li.getBoundingClientRect(), l = document.getElementById('mcList').getBoundingClientRect(), s = document.getElementById('sheet').getBoundingClientRect();
      return r.bottom <= Math.min(l.bottom, s.bottom, innerHeight) + 2 && r.top >= Math.max(l.top, s.top, 0) - 2 ? 'in view' : `out of view (${Math.round(r.top)}-${Math.round(r.bottom)}, list ${Math.round(l.top)}-${Math.round(l.bottom)}, card ${Math.round(s.top)}-${Math.round(s.bottom)})`;
    }, text);
    await g.ev("document.getElementById('updCard').hidden = true");
    await tap('#mpFab'); await g.wait(200); await tap('#visitChat'); await g.wait(600);
    eq(await newest('Message number 40'), 'in view', `${who}: the chat opens on the newest message`);
    const clear = () => g.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); for (const x of d.match.messages) x.created_at = new Date(Date.now() - 60000).toISOString(); localStorage.setItem('FAKE_DB', JSON.stringify(d)); });
    await clear(); await g.page.fill('#mcText', 'Sent with the button'); await tap('#mcForm button[type=submit]'); await g.wait(800);
    eq(await newest('Sent with the button'), 'in view', `${who}: after Send, the newest message is in view`);
    await clear(); await tap('#mcText'); await g.page.keyboard.type('Sent with Enter'); await g.page.keyboard.press('Enter'); await g.wait(800);
    eq(await newest('Sent with Enter'), 'in view', `${who}: after Enter, the newest message is in view`);
    // A rival's message arrives while you're reading the newest: it comes into view too.
    await g.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.match.messages.push({ id: 99, lobby_id: 'C1', user_id: 'u-rival', slot: 2, name: 'Rival Run', body: 'A late one', kind: 'chat', day: 2, hidden: false, created_at: new Date().toISOString() }); localStorage.setItem('FAKE_DB', JSON.stringify(d)); });
    await g.ev('mcLoad()'); await g.wait(500);
    eq(await newest('A late one'), 'in view', `${who}: a new message comes into view`);
    // Closed and opened again, it's back at the newest.
    await g.ev('select(null)'); await g.wait(300);
    await tap('#mpFab'); await g.wait(150); await tap('#visitChat'); await g.wait(600);
    eq(await newest('A late one'), 'in view', `${who}: opened again, at the newest`);
    if (!phone) { // a match resort can't be started over from the menu
      const lifts = await g.ev('world.lifts.length');
      await g.ev(`$('mReset').onclick()`);
      eq([await g.ev(`$('menuConfirm').hidden`), await g.ev('world.lifts.length'), /can’t be started over/.test(await g.ev(`$('toast').textContent`))], [true, lifts, true], 'Start this mountain over is refused in a match');
    }
    eq(g.errors, [], `${who}: no page errors`);
    await g.page.close();
  }
}
