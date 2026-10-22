// Signed-in visitors like a resort once from the visit bar; visits are counted; the owner gets $100k per
// new like (up to 10 a season) and $1M once for a staff pick, at the start of a day.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  // the owner, signed in, with a public resort online
  const g = await openGame(browser, url);
  await g.ev(`__fakeSwitch('own', 'own@example.com')`); await g.wait(1200);
  await g.click('#startBtn'); await g.wait(1500); await g.ev(`select(null)`);
  await g.ev(SETUPS.juniperStarter);
  await g.ev(`(() => { saveNow(); CLOUD.lastUp = 0; return cloudSave(false); })()`); await g.wait(600);
  const id = await g.ev(`slots.active`);
  // three visitors: two signed in like it, one guest can't
  let db = await g.ev(`localStorage.getItem('FAKE_DB')`);
  for (const [who, signed] of [['v1', true], ['v2', true], ['guest', false]]) {
    const v = await openGame(browser, url);
    await v.ev(`localStorage.setItem('FAKE_DB', ${JSON.stringify(db)})`);
    if (signed) { await v.ev(`__fakeSwitch('${who}', '${who}@example.com')`); await v.wait(1200); }
    await v.click('#startBtn'); await v.wait(1500);
    await v.ev(`(async () => { CLOUD.boardAt = 0; await loadBoard(true); await visitResort('${id}'); })()`); await v.wait(1500);
    eq(await v.ev(`!$('visitLike').hidden`), true, `${who}: the visit bar has a Like button`);
    await v.click('#visitLike'); await v.wait(500);
    eq(await v.ev(`visiting.liked`), signed, `${who}: ${signed ? 'liked' : 'guests are asked to sign in'}`);
    if (signed) { await v.click('#visitLike'); await v.wait(300); }
    db = await v.ev(`localStorage.getItem('FAKE_DB')`);
    eq(v.errors, [], `${who}: no page errors`);
    await v.page.close();
  }
  const d = JSON.parse(db);
  eq(d.likes.length, 2, 'two likes, one each');
  eq(d.visits.length, 3, 'three visits counted');
  // the owner: a staff pick too, then the next day pays out
  d.featured = [{ mountain_id: id, picked: true }];
  await g.ev(`localStorage.setItem('FAKE_DB', ${JSON.stringify(JSON.stringify(d))})`);
  const cash0 = await g.ev(`state.cash`);
  await g.ev(`(async () => { socialAt = 0; await socialBonus(); })()`); await g.wait(300);
  eq(await g.ev(`state.cash`) - cash0, 2 * 100000 + 1000000, 'two likes and a staff pick: +$1.2M');
  assert(/2 new likes/.test(await g.ev(`$('toast').textContent`)) && /Staff pick/.test(await g.ev(`$('toast').textContent`)), 'and says so');
  await g.ev(`(async () => { socialAt = 0; await socialBonus(); })()`); await g.wait(300);
  eq(await g.ev(`state.cash`) - cash0, 1200000, 'nothing is paid twice');
  // only ten likes are paid a season
  await g.ev(`(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); for (let i = 0; i < 12; i++) d.likes.push({ mountain_id: '${id}', user_id: 'x' + i }); localStorage.setItem('FAKE_DB', JSON.stringify(d)); })()`);
  await g.ev(`(async () => { socialAt = 0; await socialBonus(); })()`); await g.wait(300);
  eq(await g.ev(`state.cash`) - cash0, 1200000 + 8 * 100000, 'twelve more likes pay only up to ten a season');
  // the board and standing card show it
  await g.ev(`(async () => { CLOUD.boardAt = 0; await loadBoard(true); openCommunity(); })()`); await g.wait(400);
  assert(/14 likes · 3 visits/.test(await g.ev(`$('cmStanding').innerText`)), 'your standing shows likes and visits');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
