// The roadmap page: each idea is a card anyone can vote up or down, once per idea (tap again to take
// it back), with totals for everyone and a Most wanted order. Suggest a feature opens the game's idea form.
import { eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ev = (c) => page.evaluate(c);
  const counts = (id) => ev(`[...document.querySelectorAll('[data-idea="${id}"] .vote')].map((b) => [+b.lastElementChild.textContent, b.getAttribute('aria-pressed')])`);
  await page.goto(url + 'roadmap.html'); await page.waitForTimeout(500);
  const ids = await ev(`[...document.querySelectorAll('.card')].map((c) => c.dataset.idea)`);
  assert(ids.length >= 12 && ids.includes('hotels') && ids.includes('multiplayer') && new Set(ids).size === ids.length, `a card per idea: ${ids}`);
  assert(ids.every((i) => /^[a-z0-9-]{1,40}$/.test(i)), 'ids the database accepts');
  eq(await counts('hotels'), [[0, 'false'], [0, 'false']], 'no votes yet');

  // vote: signs in as a guest, counts it, remembers it
  await page.click('[data-idea=hotels] .vote.up'); await page.waitForTimeout(200);
  eq(await counts('hotels'), [[1, 'true'], [0, 'false']], 'a vote up');
  eq(await ev(`!!JSON.parse(localStorage.getItem('FAKE_SESSION'))`), true, 'as a guest');
  await page.click('[data-idea=hotels] .vote.down'); await page.waitForTimeout(200);
  eq(await counts('hotels'), [[0, 'false'], [1, 'true']], 'changing your mind moves the vote');
  await page.click('[data-idea=hotels] .vote.down'); await page.waitForTimeout(200);
  eq(await counts('hotels'), [[0, 'false'], [0, 'false']], 'tapping again takes it back');
  await page.click('[data-idea=multiplayer] .vote.up'); await page.click('[data-idea=condos] .vote.down'); await page.waitForTimeout(300);

  // a finished idea keeps its votes but takes no more
  const done = await ev(`document.querySelectorAll('#done .card').length`);
  if (done) { const id = await ev(`document.querySelector('#done .card').dataset.idea`); const before = await counts(id);
    await ev(`document.querySelector('#done .vote.up').click()`); await page.waitForTimeout(200);
    eq(await counts(id), before, 'no voting on a finished idea'); }
  // a reload keeps your votes
  await page.reload(); await page.waitForTimeout(500);
  eq([await counts('multiplayer'), await counts('condos')], [[[1, 'true'], [0, 'false']], [[0, 'false'], [1, 'true']]], 'votes kept after a reload');
  eq(await ev(`JSON.parse(localStorage.getItem('FAKE_DB')).votes.length`), 2, 'one row per idea voted');

  // someone else sees the totals but not as theirs
  await ev(`localStorage.removeItem('FAKE_SESSION')`); await page.reload(); await page.waitForTimeout(500);
  eq(await counts('multiplayer'), [[1, 'false'], [0, 'false']], 'a visitor sees the totals');

  // Most wanted: one list, highest first, and back
  await page.click('.sort [data-sort=ranked]'); await page.waitForTimeout(100);
  const order = await ev(`[...document.querySelectorAll('#rankedCards .card')].map((c) => c.dataset.idea)`);
  eq([order.length, order[0], order[order.length - 1]], [ids.length - done, 'multiplayer', 'condos'], 'most wanted first, least last');
  eq(await ev(`getComputedStyle(document.getElementById('done')).display !== 'none'`), true, 'Done stays in view, on its own');
  eq(await ev(`[...document.querySelectorAll('section.topic')].every((s) => getComputedStyle(s).display === 'none')`), true, 'topics hidden meanwhile');
  await page.click('.sort [data-sort=topic]'); await page.waitForTimeout(100);
  eq(await ev(`document.querySelector('#stay .cards').children.length`), 3, 'back under their topics');
  eq(await ev(`document.documentElement.scrollWidth`), 390, 'fits a phone');

  // Suggest a feature opens the idea form in the game
  await page.click('#suggest a.btn'); await page.waitForTimeout(2500);
  eq(await ev(`[!document.getElementById('feedbackBox').hidden, location.hash]`), [true, ''], 'the idea form is open');
  eq(errors.filter((e) => !/gis is not defined/.test(e)), [], 'no page errors');
  await ctx.close();
}
