// Phones: Trails, Lifts, Buildings and More open their lists in one tap; Build swaps in the build
// tools until Done; More opens a grid of everything else, each section with a way back to it.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { width: 390, height: 844 });
  await g.click('#startBtn'); await g.wait(2200); // past the welcome card
  await g.ev(SETUPS.juniperStarter); await g.ev(`select(null)`);
  const vis = (sel) => g.ev(`(() => { const e = document.querySelector('${sel}'); return !!e && e.offsetParent !== null; })()`);
  for (const sel of ['.dock .ph[data-pm=trails]', '.dock .ph[data-pm=lifts]', '.dock .ph[data-pm=blds]', '.dock .ph[data-pm=more]', '#pBuild']) assert(await vis(sel), `${sel} shows`);
  for (const sel of ['#tTrail', '#tLift', '#tExplore', '#tManage']) assert(!(await vis(sel)), `${sel} is tucked away`);
  await g.click('.dock .ph[data-pm=lifts]'); await g.wait(200);
  eq(await g.ev(`selected && selected.obj`), 'lifts', 'Lifts opens the lift list');
  eq(await g.ev(`$('sheet').querySelectorAll('.mtabs button').length`), 0, 'no tabs on the lift list');
  await g.click('.dock .ph[data-pm=lifts]'); await g.wait(200);
  eq(await g.ev(`selected`), null, 'tapping it again closes it');
  await g.click('.dock .ph[data-pm=more]'); await g.wait(200);
  eq(await g.ev(`selected && selected.obj`), 'more', 'More opens its grid');
  const tiles = await g.ev(`[...$('sheet').querySelectorAll('.mtile b')].map((b) => b.textContent)`);
  for (const t of ['Parking', 'Operations', 'Prices', 'Events', 'Snow', 'Money', 'Goals', 'Leaderboard']) assert(tiles.includes(t), `with a ${t} tile`);
  await g.click('.mtile[data-v=events]'); await g.wait(200);
  eq(await g.ev(`selected && selected.obj`), 'events', 'a tile opens its section');
  assert(await vis('.sheet .mtabs .back'), 'with a way back');
  await g.click('.sheet .mtabs .back'); await g.wait(200);
  eq(await g.ev(`selected && selected.obj`), 'more', 'back to the grid');
  await g.click('.dock .ph[data-pm=more]'); await g.wait(200);
  eq(await g.ev(`!!(selected && selected.kind === 'manage')`), false, 'tapping More again closes it');
  await g.click('#pBuild'); await g.wait(200);
  eq(await g.ev(`selected`), null, 'Build closes the list');
  assert(await vis('#tTrail') && await vis('#tLift') && await vis('#tBld') && await vis('#tClear'), 'and shows the build tools');
  assert(!(await vis('.dock .ph[data-pm=trails]')), 'in place of the lists');
  await g.click('#tLift'); await g.wait(200);
  eq(await g.ev(`state.tool`), 'lift', 'a build tool can be picked');
  await g.click('#pBuild'); await g.wait(200);
  eq(await g.ev(`state.tool`), 'explore', 'Done puts the tool away');
  assert(await vis('.dock .ph[data-pm=trails]'), 'and brings the lists back');
  await g.ev(`setTool('trail')`); await g.wait(200);
  assert(await vis('#tTrail'), 'a tool picked another way opens the tray');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
