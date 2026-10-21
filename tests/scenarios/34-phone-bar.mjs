// Phones: Trails, Lifts, Buildings and More open their lists in one tap; Build swaps in the build
// tools until Done; the More panel's tabs are the other four lists.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { width: 390, height: 844 });
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter);
  const vis = (sel) => g.ev(`(() => { const e = document.querySelector('${sel}'); return !!e && e.offsetParent !== null; })()`);
  for (const sel of ['.dock .ph[data-pm=trails]', '.dock .ph[data-pm=lifts]', '.dock .ph[data-pm=blds]', '.dock .ph[data-pm=more]', '#pBuild']) assert(await vis(sel), `${sel} shows`);
  for (const sel of ['#tTrail', '#tLift', '#tExplore', '#tManage']) assert(!(await vis(sel)), `${sel} is tucked away`);
  await g.click('.dock .ph[data-pm=lifts]'); await g.wait(200);
  eq(await g.ev(`selected && selected.obj`), 'lifts', 'Lifts opens the lift list');
  eq(await g.ev(`$('sheet').querySelectorAll('.mtabs button').length`), 0, 'no tabs on the lift list');
  await g.click('.dock .ph[data-pm=lifts]'); await g.wait(200);
  eq(await g.ev(`selected`), null, 'tapping it again closes it');
  await g.click('.dock .ph[data-pm=more]'); await g.wait(200);
  eq(await g.ev(`selected && selected.obj`), 'ops', 'More opens Operations');
  eq(await g.ev(`[...$('sheet').querySelectorAll('.mtabs button')].map((b) => b.textContent)`), ['Operations', 'Prices', 'Snow', 'Money'], 'with the other lists as tabs');
  await g.click('.mtabs [data-v=money]'); await g.wait(200);
  await g.click('.dock .ph[data-pm=trails]'); await g.wait(200);
  await g.click('.dock .ph[data-pm=more]'); await g.wait(200);
  eq(await g.ev(`selected && selected.obj`), 'money', 'More reopens the last of them');
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
