// A new player's first visit notes where they came from, once: the link's tag tidied off the address, the linking
// site's name only, and nothing sent again on later visits.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { query: '?src=Reddit&utm_campaign=launch' });
  await g.page.waitForFunction(() => localStorage.getItem('mm.source') === 'sent', null, { timeout: 15000 });
  const first = await g.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); return { rows: Object.values(d.sources || {}), search: location.search }; });
  eq(first.rows.map(({ src, campaign, host, invite }) => ({ src, campaign, host, invite })), [{ src: 'reddit', campaign: 'launch', host: '', invite: false }], 'tag and campaign recorded once');
  assert(!/src|utm_/.test(first.search), 'tag tidied off the address: ' + first.search);
  // A later visit from another site doesn't replace it or send again.
  await g.page.goto(url + '?src=youtube', { referer: 'https://www.youtube.com/watch?v=abc' });
  await g.page.waitForFunction(() => window.__dbg && !document.getElementById('loading'), null, { timeout: 60000 });
  await g.wait(1500);
  const later = await g.page.evaluate(() => ({ n: Object.keys(JSON.parse(localStorage.getItem('FAKE_DB')).sources || {}).length, mark: localStorage.getItem('mm.source') }));
  eq(later, { n: 1, mark: 'sent' }, 'only the first visit counts');
  // A first visit linked from another site keeps the site's name, never the full address.
  const p = await browser.newPage();
  await p.goto(url); await p.waitForFunction(() => localStorage.getItem('mm.source') === 'sent', null, { timeout: 60000 }); // let that visit settle
  await p.evaluate(() => localStorage.clear());
  await p.goto(url, { referer: 'https://www.youtube.com/watch?v=abc' });
  await p.waitForFunction(() => localStorage.getItem('mm.source') === 'sent', null, { timeout: 60000 });
  const row = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('FAKE_DB')).sources)[0]);
  eq({ host: row.host, src: row.src }, { host: 'youtube.com', src: '' }, 'linking site recorded by name');
  await p.close();
  eq(g.errors, [], 'no page errors');
}
