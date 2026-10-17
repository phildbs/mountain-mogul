// Share links open a read-only visit with a way to start your own; feedback is sent with context.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  // the sharer: signed in, public resort
  const a = await openGame(browser, url);
  await a.ev(`__fakeSwitch('sharer', 's@example.com')`); await a.wait(600);
  await a.ev(`newMountain('juniper')`); await a.ev(SETUPS.juniperStarter);
  await a.ev(`(() => { state.resortName = "Sam's Summit"; saveNow(); })()`);
  await a.page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await a.ev(`startGame(); select({ kind: 'community', obj: null })`); await a.wait(400);
  await a.click('[data-action=share]'); await a.wait(800);
  const link = await a.page.evaluate(() => navigator.clipboard.readText());
  const id = await a.ev(`slots.active`);
  eq(link, `${url}?visit=${id}`, 'link copied');

  // a guest can't share
  await a.ev(`__fakeSwitch('sharer', 's@example.com'); CLOUD.guest = true; shareResort()`); await a.wait(300);
  assert(/Sign in/.test(await a.ev(`$('toast').textContent`)), 'guests are told to sign in');
  await a.ev(`CLOUD.guest = false`);

  // feedback from the sharer
  await a.click('#mFeedback'); await a.wait(200);
  await a.ev(`$('fbText').value = 'Love the chairlifts. The parking tip helped.'`);
  await a.click('#fbSend'); await a.wait(600);
  eq(await a.ev(`$('fbMsg').textContent`), 'Sent. Thank you!', 'feedback sent');
  const fb = await a.ev(`JSON.parse(localStorage.getItem('FAKE_DB')).feedback`);
  eq(fb.length, 1, 'one feedback row');
  eq(fb[0].context.resort, "Sam's Summit", 'context includes the resort');
  eq(fb[0].context.lifts, 1, 'context includes the resort size');
  await a.click('#fbSend'); await a.wait(200);
  assert(/Write a few words/.test(await a.ev(`$('fbMsg').textContent`)), 'empty note refused');
  const db = await a.ev(`localStorage.getItem('FAKE_DB')`);
  await a.page.close();

  // a new visitor opens the link on a fresh device
  const b = await openGame(browser, url);
  await b.ev(`(() => { localStorage.clear(); localStorage.setItem('FAKE_DB', ${JSON.stringify(db)}); })()`);
  await b.page.goto(link); await b.reloaded(); await b.wait(2000);
  eq(await b.ev(`visiting && visiting.name`), "Sam's Summit", 'visiting from the link');
  eq(await b.ev(`$('visitHome').textContent`), 'Build your own resort', 'invites them to build');
  eq(await b.ev(`location.search`), '', 'link removed from the address');
  await b.click('#visitHome'); await b.wait(1000);
  eq(await b.ev(`[!$('title').hidden, slots.list.length].join()`), 'true,0', 'back on the title, nothing of theirs saved');
  // a link to a resort that doesn't exist
  await b.page.goto(url + '?visit=00000000-0000-0000-0000-000000000000'); await b.reloaded(); await b.wait(1500);
  eq(await b.ev(`!!visiting`), false, 'no visit for a missing resort');
  assert(/private now, or it no longer exists/.test(await b.ev(`$('toast').textContent`)), 'explains the missing resort');
  eq(b.errors, [], 'no page errors');
  await b.page.close();
}
