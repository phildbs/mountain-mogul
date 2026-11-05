// The owner's King of the Mountain tools on stats.html: make a lobby (start rounded to the half hour, with the
// late-joining and title-screen flag switches; no computer players since Nov 4), switch a setting and the flag, close a lobby, and hide or ban from the chat reports.
// Nobody else can use them.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  const at = (min) => new Date(Date.now() + min * 60000).toISOString();
  const match = { lobbies: [{ id: 'S1', name: 'Old Cup', map: 'match', slots: 3, starts_at: at(-90), days: 168, day_minutes: 30, status: 'running', day: 3, prize: null, computers: true, keep_profit: true, late_days: null, late_bonus: 15000, late_bonus_cap: 1000000, late: true }],
    players: [{ lobby_id: 'S1', slot: 0, user_id: 'u-1', resort_name: 'Aspen Bowl', joined_day: 0 }, { lobby_id: 'S1', slot: 1, user_id: null, resort_name: 'Valley View', joined_day: 0 }],
    messages: [{ id: 7, lobby_id: 'S1', user_id: 'u-1', name: 'Aspen Bowl', body: 'spam spam', kind: 'chat', day: 3, hidden: false, created_at: at(-5) }],
    reports: [{ message_id: 7, user_id: 'u-2' }],
    stats: { signed_in: 20, players: 5, new_7d: 2, active_24h: 3, active_7d: 4, in_running: 2, sent_order: 4, two_days: 3, five_days: 1, two_matches: 1,
      lobbies: { open: 1, running: 1, finished: 0, official: 2, custom: 0, makers: 0, crown: 2, ridge: 0 }, seats: { filled: 2, total: 3 }, left: 0, rescued: 0, chat_7d: 6, chatters_7d: 2,
      per_day: Array.from({ length: 14 }, (_, i) => ({ day: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString('en-CA'), active: i % 3, joined: 0, new: 0 })),
      matches: [{ id: 'S1', name: 'Old Cup', status: 'running', kind: 'official', map: 'match', slots: 3, day: 3, days: 168, players: [
        { slot: 0, resort: 'Aspen Bowl', player: 'Ann', real: true, left: false, joined_day: 0, orders: 12, orders_24h: 4, chats: 1, last_seen: at(-30), cash: 500000, profit: 125000, guests: 800, lifts: 3, trails: 7 }] }] } };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  // Not the owner: nothing.
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(800);
  await g.page.goto(url + 'stats.html'); await g.wait(1500);
  assert(/only for the game’s owner/.test(await g.page.innerText('#out')), 'the page is only for the owner');
  // The owner.
  await g.page.evaluate(() => localStorage.setItem('FAKE_SESSION', JSON.stringify({ user: { id: 'owner', is_anonymous: false, email: 'phildbs@gmail.com' } })));
  await g.page.goto(url + 'stats.html?owner#kotm'); // a new address, so the page loads again
  await g.page.waitForSelector('#kNew', { timeout: 10000 });
  eq(await g.page.innerText('#kBadge'), '1', 'the tab counts unhandled chat reports');
  let t = await g.page.innerText('#kotm');
  assert(/Old Cup[\s\S]*running[\s\S]*day 3 of 168[\s\S]*Aspen Bowl · Valley View \(computer\)/i.test(t), `lobbies list their players (${t.slice(0, 400)})`);
  assert(/How multiplayer is doing|Tried it/i.test(t) && /Tried it\s*5\s*joined a match · 25% of 20 signed-in players/i.test(t) && /Came back\s*60%/i.test(t) && /Seats filled\s*67%/i.test(t), `multiplayer numbers at the top (${t.slice(0, 500)})`);
  assert(/Old Cup[\s\S]*Aspen Bowl\s*Ann\s*12 · 4\s*1\s*30 min ago\s*\$125,000\s*800\s*3 · 7/i.test(t), `each match's players, with their changes and numbers (${t.slice(0, 1500)})`);
  assert(/reported 1 time[\s\S]*spam spam/.test(t), `chat reports are listed (${t.slice(-300)})`);

  // Make a lobby, without late joining.
  await g.page.fill('#kNew [name=name]', 'Winter Cup');
  const start = new Date(Date.now() + 3 * 3600000); start.setMinutes(10, 0, 0);
  const p = (n) => String(n).padStart(2, '0');
  await g.page.fill('#kNew [name=starts]', `${start.getFullYear()}-${p(start.getMonth() + 1)}-${p(start.getDate())}T${p(start.getHours())}:10`);
  await g.page.selectOption('#kNew [name=days]', '336');
  await g.page.uncheck('#kNew [name=latejoin]');
  eq(await g.page.$('#kNew [name=computers]'), null, 'no computer players to choose');
  await g.page.click('#kNew button[type=submit]');
  await g.page.waitForFunction(() => /Made “Winter Cup”/.test(document.getElementById('kotm').innerText), null, { timeout: 10000 });
  const made = await g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.lobbies.find((l) => l.name === 'Winter Cup'));
  eq([made.days, made.slots, made.computers, made.late, made.flag, new Date(made.starts_at).getMinutes()], [336, 3, false, false, true, 30], 'the lobby is made with its settings (flagged on the title screen by default), starting on the half hour');
  // The title screen flag can be switched off and on again from the lobby list.
  const flagOf = () => g.page.evaluate((id) => JSON.parse(localStorage.getItem('FAKE_DB')).match.lobbies.find((l) => l.id === id).flag, made.id);
  await g.page.waitForSelector(`[data-kflag=${made.id}]`, { timeout: 5000 });
  eq(await g.page.innerText(`[data-kflag=${made.id}]`), 'Title screen flag: on', 'its chip says the flag is on');
  await g.page.click(`[data-kflag=${made.id}]`);
  await g.page.waitForFunction((id) => JSON.parse(localStorage.getItem('FAKE_DB')).match.lobbies.find((l) => l.id === id).flag === false, made.id, { timeout: 5000 });
  await g.page.waitForFunction((id) => /off/.test(document.querySelector(`[data-kflag=${id}]`).innerText), made.id, { timeout: 5000 });
  await g.page.click(`[data-kflag=${made.id}]`);
  await g.page.waitForFunction((id) => JSON.parse(localStorage.getItem('FAKE_DB')).match.lobbies.find((l) => l.id === id).flag === true, made.id, { timeout: 5000 });
  eq(await flagOf(), true, 'off and on again');
  eq(await g.page.$('[data-kflag=S1]'), null, 'a running match has no flag chip');

  // Switch a setting, close the old lobby.
  await g.page.click('[data-kset=late][data-id=S1]');
  await g.page.waitForFunction(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.lobbies.find((l) => l.id === 'S1').late === false, null, { timeout: 5000 });
  g.page.once('dialog', (d) => d.accept());
  await g.page.click('[data-kclose=S1]');
  await g.page.waitForFunction(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.lobbies.find((l) => l.id === 'S1').status === 'closed', null, { timeout: 5000 });

  // Hide the reported message, and ban its author from chat.
  await g.page.click('[data-khide="7"]');
  await g.page.waitForFunction(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.messages[0].hidden === true, null, { timeout: 5000 });
  g.page.once('dialog', (d) => d.accept());
  await g.page.click('[data-kban="u-1"]');
  await g.page.waitForFunction(() => (JSON.parse(localStorage.getItem('FAKE_DB')).match.bans || []).length === 1, null, { timeout: 5000 });
  // A phone: no sideways scrolling.
  await g.page.setViewportSize({ width: 390, height: 844 }); await g.wait(300);
  eq(await g.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth <= 1), true, 'fits a phone');
  if (process.env.SHOTS) await g.page.screenshot({ path: 'stats-kotm.png', fullPage: true });
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
