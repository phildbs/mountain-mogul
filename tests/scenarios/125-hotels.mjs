// Hotels: three sizes in three themes, rooms booked each morning, guests out of the door for the first chair
// and back in at the end of the day, room revenue on the report, and the card on a phone.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);

  // Models: every theme and size fits its footprint, has windows, no seats, and a door at the front.
  const models = await g.ev(`(() => Object.entries(THEMES).flatMap(([key, T]) => [0, 1, 2].map((tier) => {
    const k = T.models.hotel(tier), s = BTYPES.hotel.tiers[tier], box = new THREE.Box3().setFromObject(k.build());
    return { key, tier, seats: k.seats.length, glow: k.parts.some(([, m]) => m === BM.glow),
      fits: box.min.x >= -s.w / 2 - 0.05 && box.max.x <= s.w / 2 + 0.05 && box.min.z >= -s.d / 2 - 0.05 && box.max.z <= s.d / 2 + 0.05, h: Math.round(box.max.y * 10) / 10 };
  })))()`);
  eq(models.length, 9, 'three sizes in each of the three themes');
  for (const m of models) {
    assert(m.fits, `${m.key} ${m.tier} fits its footprint`);
    assert(m.glow && m.seats === 0, `${m.key} ${m.tier}: lit windows, no seats`);
  }
  for (const key of ['classic', 'modern', 'scandi']) {
    const h = models.filter((m) => m.key === key).map((m) => m.h);
    assert(h[0] < h[1] && h[1] < h[2], `${key}: bigger hotels are taller (${h})`);
  }
  eq(await g.ev(`[sizeCost('hotel', 0), sizeCost('hotel', 1), sizeCost('hotel', 2)]`), [300000, 900000, 2400000], 'prices by size');

  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 5e6; state.reputation = 1`);
  // A medium modern hotel by the lift: ski-in, ski-out.
  const placed = await g.ev(`(() => { const L = world.lifts[0].a;
    for (const [dx, dz] of [[-6,0],[6,0],[-7,3],[7,3],[-6,5],[6,5],[0,7],[-9,2],[9,2],[-8,6],[8,6],[0,9],[-6,-3],[6,-3],[-8,-2],[8,-2]]) for (const r of [0, 1, 2, 3]) {
      const b = evalBuilding('hotel', L.x + dx, L.z + dz, r, false, null, null, 1);
      if (b.problems.length) continue;
      const B = commitBuilding(b, 'hotel', L.x + dx, L.z + dz, r, 'modern'); computeNetwork(); syncLabels();
      if (skiInOut(B)) return true;
      removeBuilding(B); computeNetwork(); // the door faces away from the lift: try another spot
    }
    return false; })()`);
  assert(placed, 'a medium hotel fits beside the lift');
  const H = await g.ev(`(() => { const B = world.buildings.find((b) => b.type === 'hotel'); return { id: B.id, tier: B.tier, style: B.style, ski: skiInOut(B), base: B.isBase }; })()`);
  eq([H.tier, H.style], [1, 'modern'], 'built as a medium, modern hotel');
  assert(H.ski, 'ski-in, ski-out beside the lift');

  // What fills rooms: weekends over weekdays, a lower price over a higher one.
  const share = await g.ev(`(() => { const B = world.buildings.find((b) => b.type === 'hotel'), d0 = state.day, out = {};
    for (let d = 30; d < 37; d++) { state.day = d; out[dateOf(d).getUTCDay()] = hotelShare(B); }
    state.day = d0; const base = hotelShare(B); state.prices.room = 360; const dear = hotelShare(B); state.prices.room = 180;
    return { sat: out[6], wed: out[3], base, dear }; })()`);
  assert(share.sat > share.wed * 2, `Saturdays fill over twice as many rooms as Wednesdays (${share.sat}, ${share.wed})`);
  assert(share.dear < share.base * 0.4, `doubling the price empties most rooms (${share.dear}, ${share.base})`);

  // A day: rooms paid in the morning, guests out of the door before the day crowd, and back in at the end.
  const morning = await g.ev(`(() => { openDay(); const B = world.buildings.find((b) => b.type === 'hotel');
    for (let n = 0; n < 4000 && state.time < 560; n++) simStep(1.5);
    const hg = guests.filter((x) => x.hotel === B.id);
    return { rooms: B.today.rooms, rev: today.rev.lodging, price: state.prices.room, out: hg.length, noCar: hg.every((x) => x.car == null && !x.bus), cars: guests.filter((x) => !x.hotel).length, visits: B.today.visits }; })()`);
  assert(morning.rooms > 0 && morning.rooms <= 40, `rooms booked (${morning.rooms} of 40)`);
  eq(morning.rev, morning.rooms * morning.price, 'each booked room pays the room price');
  eq(morning.visits, morning.rooms * 2, 'two guests a room');
  assert(morning.out >= morning.visits * 0.8, `hotel guests are out by 9:20 (${morning.out} of ${morning.visits})`);
  assert(morning.noCar, 'hotel guests have no car');
  const live = await g.ev(`bldLive(world.buildings.find((b) => b.type === 'hotel'))`);
  assert(/rooms booked/.test(live) && /out on the mountain/.test(live), 'the card shows rooms and guests out');
  // Tired hotel guests go back to their room for a rest, then come out and ski again.
  const naps = await g.ev(`(() => { const rested = new Map(), back = new Set();
    for (let n = 0; n < 40000 && state.phase === 'open' && state.time < closeTime(); n++) { simStep(1.5);
      for (const x of guests) { if (x.st === 'room') rested.set(x.id, x.runs); else if (rested.has(x.id) && x.runs > rested.get(x.id)) back.add(x.id); } }
    return { rested: rested.size, back: back.size, naps: today.naps || 0, onlyHotel: [...rested.keys()].every((id) => { const x = gById.get(id); return !x || x.hotel; }) }; })()`);
  assert(naps.rested > 0, `some hotel guests went back to their rooms for a rest (${naps.rested})`);
  assert(naps.back > 0, `and came back out to ski more runs (${naps.back} of ${naps.rested})`);
  assert(naps.onlyHotel, 'only hotel guests rest in hotel rooms');
  assert(await g.ev(SETUPS.finishDay) !== 'open', 'the day ends: every hotel guest went back in');
  const rep = await g.ev(`(() => { const r = state.lastReport, B = world.buildings.find((b) => b.type === 'hotel'); return { hotel: r.hotel, lodging: r.rev.lodging, yday: B.yday, text: $('rpBody').textContent }; })()`);
  eq(rep.hotel.rooms, morning.rooms, 'the report counts the rooms');
  eq(rep.hotel.guests, morning.visits, 'and the hotel guests');
  eq(rep.yday.rooms, morning.rooms, 'the hotel remembers last night');
  assert(/Hotel rooms/.test(rep.text), 'room revenue has its own line');
  assert(/hotels were \d+% full/.test(rep.text), 'the report says how full the hotels were');
  assert(rep.hotel.naps >= naps.naps && /went back to their rooms for a rest/.test(rep.text), 'the report counts the rests');

  // A closed hotel books nothing; the room price is one of the resort's prices.
  const closed = await g.ev(`(() => { const B = world.buildings.find((b) => b.type === 'hotel'); today = newToday(); initBldSim(B);
    const saved = runOps; runOps = { bld: { [B.id]: 'closed' } }; const n = bookHotels(1000, false); runOps = saved; return n; })()`);
  eq(closed, 0, 'a closed hotel books no rooms');
  eq(await g.ev(`PRICE_KEY.hotel`), 'room', 'the card has a room price');

  // Saved and reloaded.
  await g.ev('saveNow()'); await g.page.reload(); await g.reloaded();
  const back = await g.ev(`(() => { const B = world.buildings.find((b) => b.type === 'hotel'); return B && { tier: B.tier, style: B.style, rooms: B.yday && B.yday.rooms, price: state.prices.room }; })()`);
  eq(back, { tier: 1, style: 'modern', rooms: morning.rooms, price: 180 }, 'the hotel survives a reload');
  eq(g.errors, [], 'no page errors');
  await g.page.close();

  // The build menu on a phone: a Hotels tab with three sizes.
  const p = await openGame(browser, url, { width: 390, height: 844 });
  await p.click('#startBtn'); await p.wait(300);
  const menu = await p.ev(`(() => { setTool('bld'); draft.btype = null; setBTab('stay'); renderSheet(); const cards = [...document.querySelectorAll('[data-action=pickB][data-v=hotel]')];
    return { n: cards.length, text: cards.map((c) => c.textContent.replace(/\\s+/g, ' ').trim()), rooms: cards.map((c) => c.querySelector('.bp small').textContent) }; })()`);
  eq(menu.n, 3, 'three hotel sizes in the menu');
  eq(menu.rooms, ['12 rooms', '40 rooms', '120 rooms'], 'each size shows its rooms, not seats');
  assert(!menu.text.some((t) => /undefined/.test(t)), 'nothing reads undefined');
  assert(menu.text.some((t) => /2\\.4M|2,400,000/.test(t)), 'the large hotel shows its price: ' + menu.text.join(' | '));
  eq(p.errors, [], 'no phone errors');
  await p.page.close();
}
