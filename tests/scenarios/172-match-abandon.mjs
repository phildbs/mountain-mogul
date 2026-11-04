// Leaving a running match and claiming a left resort (supabase/match-abandon.sql). In a match the menu's Start this
// mountain over is Leave this match; afterwards the resort shows on the live match's card as free to claim, with its
// numbers, to everyone but the player who left it. A claimer opens it with its fresh start already shown (no debt,
// cash topped up), as the server will give it that night.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter);
  const sv = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();
  const broke = { ...sv, cash: 1000, clock: { ...sv.clock, debt: 800000, reputation: 0.7 } };

  const g = await openGame(browser, url);
  const at = (min) => new Date(Date.now() + min * 60000).toISOString();
  const match = { lobbies: [{ id: 'M1', name: 'Leave Cup', map: 'match', slots: 3, starts_at: at(-50), days: 168, day_minutes: 15, status: 'running', day: 3 }],
    players: [{ lobby_id: 'M1', slot: 0, user_id: 'user-B', resort_name: 'Sinking Peak' }, { lobby_id: 'M1', slot: 1, user_id: 'u-x', resort_name: 'Lone Peak' }],
    resorts: [{ lobby_id: 'M1', slot: 0, day: 3, save: broke, summary: { name: 'Sinking Peak', profit: -90000, guests: 300, cash: 1000, debt: 800000, lifts: 1, trails: 2 } },
      { lobby_id: 'M1', slot: 1, day: 3, save: sv, summary: { name: 'Lone Peak', profit: 5000, guests: 400 } }], orders: [] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Bea', public: true }, 'user-C': { name: 'Cal', public: true }, 'u-x': { name: 'Lou', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  const db = () => g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match);
  const openWindow = async () => { await g.click('#mpCard'); await g.page.waitForSelector('#mpBody .mp-card', { timeout: 10000, state: 'attached' }); await g.wait(600); };

  // Bea plays the match: the menu offers Leave this match, with what it means.
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await openWindow();
  await g.page.evaluate(() => document.querySelector('[data-mp=open][data-id=M1]').click());
  await g.reloaded();
  await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView)'), null, { timeout: 20000 });
  eq(await g.ev(`$('mReset').textContent`), 'Leave this match', 'in a match the menu says Leave this match');
  await g.ev(`$('mReset').click()`);
  const sure = await g.ev(`[$('menuConfirm').hidden, $('mResetWhat').textContent, $('mResetYes').textContent, $('mResetNo').textContent]`);
  eq([sure[0], sure[2], sure[3]], [false, 'Leave the match', 'Stay'], 'it asks first');
  assert(/stays on the mountain, shut/.test(sure[1]) && /claim it with a fresh start/.test(sure[1]), `and says what happens to the resort (${sure[1]})`);
  await g.ev(`$('mResetNo').click()`);
  eq((await db()).players.find((p) => p.slot === 0).user_id, 'user-B', 'Stay keeps you in');
  await g.ev(`$('mReset').click()`); await g.ev(`$('mResetYes').click()`);
  await g.page.waitForEvent('framenavigated', { timeout: 10000 }); // back to the title, after a moment to read the message
  await g.reloaded();
  const left = (await db()).players.find((p) => p.slot === 0);
  eq([left.user_id, left.abandoned, left.left_by], [null, true, ['user-B']], 'Leave the match leaves it: the resort stays, abandoned');

  // Back on the title: it's no longer one of Bea's matches, and she can't claim it back.
  await g.wait(1500);
  await openWindow();
  const bea = await g.ev(`({ yours: [...document.querySelectorAll('#mpBody .mp-sec')].find((s) => /Your matches/.test(s.textContent)).textContent, claim: (document.querySelector('.mp-claims') || {}).textContent || '' })`);
  assert(!/Leave Cup/.test(bea.yours), 'it isn’t under Your matches any more');
  assert(/free to claim/.test(bea.claim) && /You left this match/.test(bea.claim) && !(await g.ev(`!!document.querySelector('[data-mp=claim]')`)), `she sees it free to claim, but not for her (${bea.claim})`);
  assert(/left/.test(await g.ev(`document.querySelector('.mp-claims').closest('.mp-card').querySelector('.mp-table').textContent`)), 'the standings mark it as left');
  await g.ev(`closeMp()`);

  // Cal claims it: its numbers first, then the fresh start explained.
  await g.ev(`__fakeSwitch('user-C', 'c@example.com')`); await g.wait(1500);
  await openWindow();
  const card = await g.ev(`document.querySelector('.mp-claim').textContent`);
  assert(/Sinking Peak/.test(card) && /1 lift, 2 trails/.test(card) && /owes \$800,000/.test(card) && /season profit \$-90,000/.test(card) && /Fresh start for whoever claims it/.test(card), `the card shows what you'd be taking on (${card})`);
  await g.ev(`document.querySelector('[data-mp=claim][data-id=M1]').click()`); await g.wait(300);
  const note = await g.ev(`document.querySelector('.mp-claim form .help').textContent`);
  assert(/debt written off/.test(note) && /\$500,000/.test(note) && /a win counts for you/.test(note), `the form explains the fresh start (${note})`);
  await g.ev(`$('mpName').value = 'Rescue Ridge'`);
  await g.ev(`document.querySelector('.mp-claim form').requestSubmit()`); await g.wait(1200);
  const took = (await db()).players.find((p) => p.slot === 0);
  eq([took.user_id, took.resort_name, took.joined_day, took.rescue_due, took.abandoned], ['user-C', 'Rescue Ridge', 3, true, false], 'Cal claims it, with a fresh start due tonight');

  // One name per player (supabase/profile-names.sql): Cal can't be called bea.
  eq(await g.ev(`saveProfile(' BEA ', true).then((e) => nameTaken(e))`), true, 'another player’s name is refused, whatever its capitals');
  // Tapping a name in the standings opens that player's profile, even with no public resorts.
  await g.ev(`document.querySelector('.mp-table [data-mp=who][data-uid="u-x"]').click()`); await g.wait(1500);
  const lou = await g.ev(`[$('community').hidden, $('cmCreatorTab').hidden, document.querySelector('#cmCreatorTab h3') && document.querySelector('#cmCreatorTab h3').textContent]`);
  eq(lou, [false, false, 'Lou'], 'tapping Lone Peak in the standings opens Lou’s profile');
  await g.ev(`$('community').hidden = true`);
  // Opening it: the fresh start is shown at once, as the server will give it tonight.
  await openWindow();
  await g.page.evaluate(() => document.querySelector('[data-mp=open][data-id=M1]').click());
  await g.reloaded();
  await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView)'), null, { timeout: 20000 });
  await g.wait(800);
  const c = await g.ev(`({ debt: state.debt || 0, cash: Math.round(state.cash), rep: state.reputation, slot: matchPlay.slot, toast: document.getElementById('toast').textContent })`);
  eq([c.debt, c.cash, c.rep, c.slot], [0, 500000, 1, 0], 'no debt, $500,000 and a fresh reputation');
  await g.ev(`select({ kind: 'match', obj: null })`); await g.wait(300);
  eq(await g.ev(`!!document.querySelector('.mp-table [data-action=matchWho][data-uid="u-x"]')`), true, 'in the match’s own standings, names open profiles too');
  assert(/fresh start comes tonight/.test(c.toast), `it says so (${c.toast})`);
  // Profiles: Cal's own page says he has rescued one resort; Bea's record says she left one match.
  await g.ev(`closeMp()`).catch(() => {});
  await g.ev(`openCreator(CLOUD.uid)`); await g.wait(1500);
  const t = await g.ev(`(document.querySelector('.cr-kotm') || {}).textContent || ''`);
  assert(/Resorts rescued: 1 · Abandoned: 0/.test(t), `Cal's page counts his rescue (${t})`);
  eq(await g.ev(`loadKotmRecord('user-B').then(() => KOTM_REC['user-B'].more)`), { rescued: 0, abandoned: 1 }, 'and Bea’s record counts the match she left');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
