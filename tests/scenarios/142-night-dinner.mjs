// Casual restaurants (2.82): open for night skiers wherever they are, and hungry night skiers can sit down
// for dinner there; après is only for base and village restaurants. Stores and fine dining are unchanged.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const r = await g.ev(`(() => {
    setTool('explore'); openDay(); state.speed = 0;
    const base = { type: 'restaurant', id: -1, isBase: true }, mtn = { type: 'restaurant', id: -2, isBase: false };
    const store = { type: 'store', id: -3, isBase: true }, fine = { type: 'fine', id: -4, isBase: true };
    const at = (night, apres, t) => { runOps.night = night; runOps.apres = apres; state.time = t; return [base, mtn, store, fine].map(bldOpenNow); };
    const out = {
      nightOnly: at(1260, 'off', 1200), nightApres: at(1260, 'on', 1200), afterNight: at(1260, 'on', 1300),
      apresOnly: at(0, 'on', 1100), noEvening: at(0, 'off', 1100),
      apresType: [base, mtn].map(apresType),
    };
    runOps.night = 1260; state.time = 1100;
    out.svcNight = [svcFor(mtn, 'snack'), svcFor({ type: 'cafe' }, 'snack')];
    state.time = 700; out.svcDay = svcFor(mtn, 'snack');
    const gst = { snacked: false, ate: false, sat: 60, svc: 'dine', bid: -99, deck: -1, fat: 0, stam: 1, th: [] }; try { finishVisit(gst); } catch (e) { /* a stand-in guest can't walk on afterwards */ } out.dined = gst.snacked;
    return out;
  })()`);
  eq(r.nightOnly, [true, true, false, false], 'night skiing, no après: both casual restaurants open; store and fine dining shut');
  eq(r.nightApres, [true, true, false, true], 'night skiing with après: fine dining joins in');
  eq(r.afterNight, [true, false, false, true], 'after night skiing, only the base restaurant stays for après');
  eq(r.apresOnly, [true, false, false, true], 'après without night skiing: the mountain restaurant is closed');
  eq(r.noEvening, [false, false, false, false], 'no evening plans: everything shuts after the lifts close');
  eq(r.apresType, [true, false], 'only base and village restaurants are après venues');
  eq(r.svcNight, ['dine', 'snack'], 'a hungry night skier sits down for dinner at a restaurant, or snacks at a café');
  assert(r.svcDay === null, 'by day a restaurant is not a snack stop');
  assert(r.dined, 'dinner counts as the night snack');
  await g.close?.();
}
