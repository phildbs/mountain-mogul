// King of the Mountain balance (Snowy, Nov 5). On Ridgeline one resort drew 2.4 times another on opening day and,
// with the old split, got 3.8 times the skiers and 4.4 times the season passes. Now a better offer still wins more,
// but less steeply, and passes are shared in plain proportion. In a match, long trails count for more than short
// ones; in a game of your own every trail still counts as one.
import { openGame, eq, assert } from '../harness.mjs';
import { splitSkiers, PASS_SHARP } from '../../match/market.mjs';
export default async function ({ browser, url }) {
  const [a, b] = splitSkiers([232, 562]), [pa, pb] = splitSkiers([248, 662], undefined, PASS_SHARP);
  assert(b > a && b / a < 3, `the bigger draw wins more skiers, but not 3.8 times as many (${a}, ${b})`);
  assert(Math.abs(pb / pa - 662 / 248) < 0.05, `passes go in plain proportion to draw (${pa}, ${pb})`);
  // A match valley: one long run against six short ones of about the same total length.
  const p = await openGame(browser, url, { query: '?matchMap=ridge@1', mountain: 'fresh' });
  const counts = await p.ev(`(() => { const t = (len) => ({ an: { len } });
    return [trailsCount([t(150)]), trailsCount([t(60)]), trailsCount([t(10)]), trailsCount([1, 2, 3, 4, 5, 6].map(() => t(25)))]; })()`);
  eq(counts, [2, 1, 0.5, 3], 'in a match a long run counts up to two trails, a 600 m one as one, a short link half');
  eq(p.errors, [], 'no page errors (match)');
  await p.page.close();
  const g = await openGame(browser, url);
  eq(await g.ev(`trailsCount([{ an: { len: 150 } }, { an: { len: 10 } }])`), 2, 'in a game of your own every trail counts as one');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
