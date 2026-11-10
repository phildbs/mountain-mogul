// Summer weddings and events (hidden until 4.0 behind ?summer=1): an event pavilion takes bookings between summer days.
// A wedding's guests drive up or come out of the hotel, sit on the pavilion's chairs, and the fee is paid as the day ends.
// A booking on a day you stay closed is lost. A summer concert brings more sightseers, some of whom stop to listen.
// Hotels stay open in summer; the pavilion is shut in winter.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
const toSummer = `(() => { state.day = 150; state.phase = 'season'; nextDay(); })()`;
const toDay = (d) => `(() => { while (state.day < ${d} && state.phase === 'closed') waitDay(); state.sum.wx = { type: 'sumsun', hi: 78, lo: 55, snow: 0, wind: 5 }; return state.day; })()`;
// near the base lift: the first spot with no problems
const put = (type, tier) => `(() => { state.cash = 1e8; const L = world.lifts[0];
  for (let r = 6; r < 40; r += 1.5) for (let a = 0; a < 24; a++) { const x = L.a.x + Math.cos(a / 24 * Math.PI * 2) * r, z = L.a.z + Math.sin(a / 24 * Math.PI * 2) * r;
    const i = evalBuilding('${type}', x, z, 0, false, null, null, ${tier}); if (!i.problems.length && isBase({ x, z })) return commitBuilding(i, '${type}', x, z, 0).id; } return null; })()`;
export default async function ({ browser, url }) {
  // without the switch there's no Summer tab
  let g = await openGame(browser, url);
  eq(await g.ev(`[BGROUPS.some((x) => x[0] === 'summer'), SUMMER_ON]`), [false, false], 'no summer buildings without the switch');
  await g.page.close();

  g = await openGame(browser, url, { query: '?summer=1' });
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const pid = await g.ev(put('pavilion', 1)), hid = await g.ev(put('hotel', 0));
  assert(pid && hid, 'a pavilion and a hotel by the base');
  eq(await g.ev(`[bldModeIn(opsState().plans.weekend, bldById(${pid})), BGROUPS.find((x) => x[0] === 'summer')[2]]`), ['closed', ['pavilion']], 'the pavilion is shut in winter, and sits under Build › Summer');
  eq(await g.ev(`[bldById(${pid}).packedLook, bldById(${pid}).seatsW.length, planCosts(opsState().plans.weekend).upkeep === planCosts(opsState().plans.weekend).upkeep]`), [true, 0, true], 'built in winter, it is packed away: no chairs out');
  eq(await g.ev(`(() => { const B = bldById(${pid}), u = (P) => world.buildings.filter((x) => x !== B).reduce((a, x) => a + bldUpkeep(x, bldModeIn(P, x), P), 0); return Math.round(planCosts(opsState().plans.weekend).upkeep) <= Math.round(u(opsState().plans.weekend)) + 1; })()`), true, 'and costs nothing to store');
  // the build menu's Summer tab, and the pavilion's own card
  const ui = await g.ev(`(() => { setTool('bld'); draft.btype = null; setBTab('summer'); renderSheet(); const menu = document.querySelector('#sheet .bpick:not([hidden])').innerText;
    setTool('explore'); select({ kind: 'bld', obj: bldById(${pid}) }); const card = $('sheet').innerText; select(null); return [menu, card]; })()`);
  assert(/Event pavilion/.test(ui[0]) && /80 guests/.test(ui[0]) && /300 guests/.test(ui[0]) && !/undefined/.test(ui[0]), `the Summer tab lists the three sizes (${JSON.stringify(ui[0])})`);
  assert(/160 guests/.test(ui[1]), `the pavilion's card says how many it holds (${ui[1].slice(0, 200)})`);
  await g.ev(toSummer);
  eq(await g.ev(`[bldById(${pid}).packedLook, bldById(${pid}).seatsW.length]`), [false, 40], 'in summer it is set up with its 40 chairs');
  eq(await g.ev(`[bldModeIn(opsState().plans.summer, bldById(${pid})), bldModeIn(opsState().plans.summer, bldById(${hid})), !!pavReach(bldById(${pid})), !!(pavReach(bldById(${pid})) || {}).base]`), ['open', 'open', true, true], 'in summer the pavilion and the hotel are open; guests reach it at the base');

  // an offer, accepted in the Summer panel
  const sat = await g.ev(`state.sum.days.slice(state.sum.k + 1).find((d) => dateOf(d).getUTCDay() === 6)`);
  await g.ev(`(() => { state.sum.offers = []; const o = sevOffer(bldById(${pid}), ${sat}, 'wedding'); o.guests = 120; o.pay = 30000; openManage('snow'); })()`); await g.wait(150);
  const txt = await g.ev(`$('sheet').innerText`);
  assert(/Wedding · Sat/.test(txt) && /120 guests/.test(txt) && /Pays \$30,000/.test(txt), 'the Summer panel shows the offer');
  await g.ev(`$('sheet').querySelector('[data-action=sevYes]').click()`); await g.wait(100);
  eq(await g.ev(`[state.sum.offers.length, state.sum.booked.length, state.sum.booked[0].day === ${sat}]`), [0, 1, true], 'accepting books it');
  // saved and loaded, the booking stays
  eq(await g.ev(`(() => { applySave(JSON.parse(JSON.stringify(saveData(false)))); return state.sum.booked.length; })()`), 1, 'the booking is saved');

  // the wedding day: guests arrive, sit on the chairs, and stay for the afternoon
  eq(await g.ev(toDay(sat)), sat, 'on to the Saturday');
  await g.ev(`(() => { openDay(); let n = 0; while (state.phase === 'open' && state.time < 860 && n++ < 80000) simStep(1.5); })()`);
  const mid = await g.ev(`(() => { const ev = guests.filter((x) => x.evt); return { n: ev.length, at: ev.filter((x) => x.st === 'evt').length, seated: ev.filter((x) => x.st === 'evt' && x.evSeat >= 0).length, hotel: ev.filter((x) => x.hotel).length, paid: ev.reduce((a, x) => a + x.paid, 0) }; })()`);
  assert(mid.n >= 100 && mid.at >= 90 && mid.seated === 40 && mid.hotel > 0 && mid.paid === 0, `wedding guests are at the pavilion, 40 on chairs, some from the hotel, no tickets (${JSON.stringify(mid)})`);
  // a save in the middle keeps them in their chairs
  eq(await g.ev(`(() => { applySave(JSON.parse(JSON.stringify(saveData(true)))); const B = bldById(${pid}); return [state.phase, guests.filter((x) => x.st === 'evt' && x.evSeat >= 0).length, (B.evUse || []).filter(Boolean).length]; })()`), ['open', 40, 40], 'a mid-day save keeps the wedding going');
  await g.ev(`(() => { let n = 0; while (state.phase === 'open' && n++ < 80000) simStep(1.5); })()`);
  const r = await g.ev(`(() => { const r = state.lastReport; return { phase: state.phase, sev: r.sev, ev: r.rev.events, left: guests.length, booked: state.sum.booked.length, txt: $('rpBody').innerText }; })()`);
  eq([r.phase, r.left, r.booked, r.sev.length, r.sev[0].kind], ['report', 0, 0, 1, 'wedding'], 'the day ends with everyone home and the wedding held');
  const w = r.sev[0];
  assert(w.came >= 115 && w.rooms > 0 && w.mood !== 'poor', `most guests came, some took hotel rooms, it went well (${JSON.stringify(w)})`);
  eq(w.cut, Math.round(Math.round(w.pay * Math.min(1, w.came / w.guests)) * 0.25), 'with no restaurant close by, a caterer takes a quarter');
  eq(w.paid, Math.round(w.pay * Math.min(1, w.came / w.guests)) - w.cut - w.refund, 'the rest is paid');
  eq(r.ev, w.paid, 'the fee is in the day’s revenue');
  assert(/Weddings and events/.test(r.txt) && /Wedding/.test(r.txt) && /caterer/.test(r.txt), 'the day report tells the story');
  eq(g.errors, [], 'no page errors on a wedding day');

  // a booking on a day you stay closed is lost, and people talk
  await g.ev(`nextDay()`);
  const sat2 = await g.ev(`state.sum.days.slice(state.sum.k + 1).find((d) => dateOf(d).getUTCDay() === 6)`);
  const miss = await g.ev(`(() => { state.sum.offers = []; sevAnswer(sevOffer(bldById(${pid}), ${sat2}, 'wedding').id, true); while (state.day < ${sat2}) waitDay(); const rep = state.reputation; waitDay(); return [state.sum.booked.length, state.reputation < rep]; })()`);
  eq(miss, [0, true], 'staying closed on the day calls it off and costs reputation');

  // a summer concert: more sightseers, some stop on the lawn to listen
  const c = await g.ev(`(() => { const s = sevSlot('concert'); if (!s.day) return s.why; const cash = state.cash; sevBook('concert'); return [cash - state.cash, state.sum.booked[0].kind, state.sum.booked[0].day === s.day]; })()`);
  eq(c, [25000, 'concert', true], 'a concert books for the next Saturday');
  const cday = await g.ev(`state.sum.booked[0].day`);
  await g.ev(toDay(cday));
  const boost = await g.ev(`sevBoost()`);
  eq(boost, 1.5, 'the concert draws more sightseers');
  await g.ev(`(() => { openDay(); let n = 0; while (state.phase === 'open' && n++ < 80000) simStep(1.5); })()`);
  const cr = await g.ev(`state.lastReport.sev`);
  assert(cr && cr[0].kind === 'concert' && cr[0].listened > 0, `sightseers stopped to listen (${JSON.stringify(cr)})`);
  // a wedding lawn by the top of the lift: guests ride up and down; rain on an open lawn spoils it
  await g.ev(`nextDay()`);
  const top = await g.ev(`(() => { const L = world.lifts[0];
    for (let r = 3; r < 12; r++) for (let a = 0; a < 24; a++) { const x = L.b.x + Math.cos(a / 24 * Math.PI * 2) * r, z = L.b.z + Math.sin(a / 24 * Math.PI * 2) * r;
      const i = evalBuilding('pavilion', x, z, 0, false, null, null, 0); if (!i.problems.length) { const B = commitBuilding(i, 'pavilion', x, z, 0); return [B.id, !!(pavReach(B) || {}).lift]; } } return null; })()`);
  assert(top && top[1], 'a lawn by the top of the lift is reached by the lift');
  const sat3 = await g.ev(`state.sum.days.slice(state.sum.k + 1).find((d) => dateOf(d).getUTCDay() === 6)`);
  await g.ev(`(() => { state.sum.offers = []; sevAnswer(sevOffer(bldById(${top[0]}), ${sat3}, 'wedding').id, true); while (state.day < ${sat3}) waitDay(); })()`);
  await g.ev(`(() => { state.sum.wx = { type: 'sumrain', hi: 66, lo: 50, snow: 0, wind: 5 }; openDay(); let n = 0; while (state.phase === 'open' && n++ < 80000) simStep(1.5); })()`);
  const wet = await g.ev(`(() => { const r = state.lastReport, w = r.sev.find((x) => x.kind === 'wedding'); return { mood: w.mood, came: w.came, guests: w.guests, refund: w.refund, rode: r.liftRides[world.lifts[0].id], left: guests.length }; })()`);
  assert(wet.mood === 'poor' && wet.refund > 0 && wet.came === wet.guests && wet.rode >= wet.guests && wet.left === 0, `a rained-out mountaintop wedding (${JSON.stringify(wet)})`);
  // back to winter: packed away again, and a summer save loads set up
  eq(await g.ev(`(() => { nextDay(); const sv = JSON.parse(JSON.stringify(saveData(false))); summerEnd(); const w = [bldById(${pid}).packedLook, bldById(${pid}).seatsW.length]; applySave(sv); return [...w, bldById(${pid}).packedLook, bldById(${pid}).seatsW.length]; })()`), [true, 0, false, 40], 'packed away for winter, put up again for summer');
  eq(g.errors, [], 'no page errors');
  await g.page.close();

  // the preview's Wedding offer builds a pavilion and makes an offer
  g = await openGame(browser, url, { query: '?summerDemo=1', mountain: 'fresh' });
  await g.click('#sumDemo [data-d=wed]');
  eq(await g.ev(`[pavilions().length, state.sum.offers.length, state.sum.offers[0].kind]`), [1, 1, 'wedding'], 'the summer preview can offer a wedding');
  eq(g.errors, [], 'no page errors in the summer preview');
  return 'summer events: pavilion shut in winter, an offer accepted and saved, a wedding day with seated guests and hotel rooms, a mid-day save, the fee and caterer cut, a missed booking, a concert, a rained-out mountaintop wedding, the preview button';
}
