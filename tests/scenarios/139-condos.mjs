// Condos: a chalet, duplex and townhomes in four themes; base or slopeside (low on the mountain, beside a trail);
// homes sell for cash, owners pay dues, ski out of the door and back to it; empty homes rent by the night;
// owners' mood moves slowly and has real effects; saved and reloaded; the Lodging tab on a phone.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);

  // Models: every theme and size fits its footprint, has lit windows and no seats.
  const models = await g.ev(`(() => Object.entries(THEMES).flatMap(([key, T]) => [0, 1, 2].map((tier) => {
    const k = T.models.condo(tier), s = BTYPES.condo.tiers[tier], box = new THREE.Box3().setFromObject(k.build());
    return { key, tier, seats: k.seats.length, glow: k.parts.some(([, m]) => m === BM.glow),
      fits: box.min.x >= -s.w / 2 - 0.05 && box.max.x <= s.w / 2 + 0.05 && box.min.z >= -s.d / 2 - 0.05 && box.max.z <= s.d / 2 + 0.05 };
  })))()`);
  eq(models.length, 12, 'three sizes in each of the four themes');
  for (const m of models) assert(m.fits && m.glow && m.seats === 0, `${m.key} ${m.tier}: fits, lit windows, no seats`);
  eq(await g.ev(`[0, 1, 2].map((t) => sizeCost('condo', t))`), [220000, 360000, 800000], 'prices by size');
  eq(await g.ev(`BTYPES.condo.tiers.map((s) => s.units)`), [1, 2, 5], 'a chalet, a duplex, a row of five townhomes');

  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 1e7; state.reputation = 1`);
  // Where they can go: low slopes beside a trail, the base; not high up, not away from a trail.
  const spots = await g.ev(`(() => { const out = { slope: null, base: null, high: null, far: null };
    const door = (x, z, r, t) => toWorld({ x, z, rot: r }, 0, BTYPES.condo.tiers[t].d / 2 + 0.35);
    for (let z = 4; z <= 60; z += 1) for (let x = -14; x <= 40; x += 1) for (const r of [0, 1, 2, 3]) {
      const b = evalBuilding('condo', x, z, r, false, null, null, 0), d = door(x, z, r, 0);
      if (!out.slope && !b.problems.length && condoSlope(d) && z < 40) out.slope = [x, z, r];
      if (!out.far && condoSlope(d) && heightFrac(d) < 0.3 && b.problems.some((p) => /needs a trail/.test(p))) out.far = [x, z, r];
      const b1 = evalBuilding('condo', x, z, r, false, null, null, 1);
      if (!out.base && z > 56 && !b1.problems.length && !condoSlope(door(x, z, r, 1))) out.base = [x, z, r];
    }
    const saved = MOUNTAIN.summitH; MOUNTAIN.summitH = MOUNTAIN.baseH + 10; // squash the mountain: the same low spot is now high up
    if (out.slope) out.high = evalBuilding('condo', out.slope[0], out.slope[1], out.slope[2], false, null, null, 0).problems;
    MOUNTAIN.summitH = saved;
    return out; })()`);
  assert(spots.slope, 'a slopeside spot beside a trail');
  assert(spots.base, 'a duplex spot at the base');
  assert(spots.far, 'slopeside away from any trail is refused');
  assert(spots.high.some((p) => /lower third/.test(p)), 'too high up the mountain is refused: ' + spots.high);
  const ids = await g.ev(`(() => {
    const [x, z, r] = ${JSON.stringify(spots.slope)}, [bx2, bz, br] = ${JSON.stringify(spots.base)};
    const C = commitBuilding(evalBuilding('condo', x, z, r, false, null, null, 0), 'condo', x, z, r, 'scandi'); computeNetwork();
    const D = commitBuilding(evalBuilding('condo', bx2, bz, br, false, null, null, 1), 'condo', bx2, bz, br, 'modern'); computeNetwork(); syncLabels();
    return { C: C.id, D: D.id, slope: C.slope, home: !!C.home, lifts: C.homeLifts.size, dSlope: D.slope }; })()`);
  assert(ids.slope && ids.home && ids.lifts > 0, `the chalet is slopeside, with its trail and a lift up to it (${JSON.stringify(ids)})`);
  eq(ids.dSlope, false, 'the duplex is at the base');
  const card = await g.ev(`(() => { select({ kind: 'bld', obj: bldById(${ids.C}) }); renderSheet(); return sheet.textContent.replace(/\\s+/g, ' '); })()`);
  assert(/0 of 1 sold/.test(card) && /ski-in, ski-out adds 40%/.test(card) && /Slopeside: owners ski out of the door/.test(card) && /Sell homes/.test(card), 'the card: homes, price, slopeside trail, the sell switch');
  assert(/Move it/.test(card) && /Remove building/.test(card), 'an unsold condo can still be moved or removed');
  const price = await g.ev(`[condoValue(bldById(${ids.C})), condoValue(bldById(${ids.D}))]`);
  assert(price[0] >= 300000 * 1.3, `a slopeside chalet sells for more (${price})`);

  // A morning: listed homes sell, owners pay dues and head out; turning off selling keeps homes to rent.
  const morning = await g.ev(`(() => { const D = bldById(${ids.D}), C = bldById(${ids.C}), cash = state.cash, r = Math.random; state.day = 40; C.keep = true; // the chalet is kept to rent while (dateOf(state.day).getUTCDay() !== 6) state.day++;
    today = newToday(); for (const B of world.buildings) initBldSim(B); today.hotelOut = [];
    Math.random = () => 0.01; const n = condoMorning(1000, false); Math.random = r;
    const kept = C.sold || 0; C.keep = false;
    return { sold: D.sold, sales: D.sales, kept, gain: state.cash - cash, dues: today.rev.condo, n, trips: today.hotelOut.filter((e) => e.owner).length }; })()`);
  eq(morning.sold, 2, 'both duplex homes sold');
  assert(morning.sales >= 2 * 240000 * 0.9, `for the going price (${morning.sales})`);
  assert(morning.dues > 0 && morning.n > 0 && morning.trips > 0, `dues paid and owners heading out (${JSON.stringify(morning)})`);
  eq(morning.gain, morning.sales + morning.dues, 'sales and dues are in the cash');
  eq(morning.kept, 0, 'a condo kept to rent sells nothing');
  const card2 = await g.ev(`(() => { select({ kind: 'bld', obj: bldById(${ids.D}) }); renderSheet(); return sheet.textContent.replace(/\\s+/g, ' '); })()`);
  assert(/2 of 2 sold/.test(card2) && /can’t be moved or removed/.test(card2) && !/Move it/.test(card2) && !/Remove building/.test(card2), 'a sold condo stays put');

  // A Saturday: the slopeside chalet has an owner; owners ski out of their door and back to it.
  const day = await g.ev(`(() => { const C = bldById(${ids.C}); C.sold = 1; C.sales = 400000; select(null);
    openDay(); schedule.push({ t: DAY_OPEN, size: 3, hotel: C.id, owner: true }); schedule.sort((a, b) => b.t - a.t);
    const T = trailById(C.home.tid), seen = new Set(), outDoor = new Set();
    for (let n = 0; n < 90000 && state.phase === 'open'; n++) { simStep(1.5);
      for (const x of guests) if (x.hotel === C.id && x.owner) { seen.add(x.id); if (x.st === 'ski' && x.T === T && x.runs === 0) outDoor.add(x.id); } }
    const r = state.lastReport;
    return { owners: seen.size, outDoor: outDoor.size, phase: state.phase, condo: r.condo, dues: r.rev.condo, text: $('rpBody').textContent, mood: owners().mood, renters: r.condo && r.condo.renters, dRooms: bldById(${ids.D}).yday }; })()`);
  assert(day.owners >= 3, `owners came to ski (${day.owners})`);
  assert(day.outDoor >= 2, `owners skied out of the door onto their trail first thing (${day.outDoor} of ${day.owners})`);
  assert(day.phase !== 'open', 'the day ends: everyone got home');
  assert(day.condo && day.condo.skiHome >= 1, `owners skied back to their door (${JSON.stringify(day.condo)})`);
  assert(day.dues > 0 && /Condo dues and rentals/.test(day.text), 'dues on their own revenue line');
  assert(/skied from their own front doors/.test(day.text), 'the report mentions the owners');

  // Owners' mood: a few bad days barely move it; a bad month has real effects.
  const mood = await g.ev(`(() => { const o = owners(); o.mood = 70; const rep0 = state.reputation, C = bldById(${ids.C}), p0 = condoValue(C);
    const bad = (k) => { for (let i = 0; i < k; i++) { today = newToday(); today.ownerSat = 20; today.ownerN = 1; condoEvening({ changes: [] }); } return o.mood; };
    const three = bad(3), p3 = condoValue(C), month = bad(27), p30 = condoValue(C);
    today = newToday(); today.hotelOut = []; initBldSim(C); const r = Math.random; Math.random = () => 0.99; condoMorning(1000, false); Math.random = r;
    return { three, month, p0, p3, p30, dues: today.rev.condo, full: world.buildings.reduce((a, b) => a + (b.type === 'condo' ? (b.sold || 0) * bspec(b).dues : 0), 0), repDrop: rep0 - state.reputation }; })()`);
  assert(mood.three > 60, `three bad days: owners still content (${mood.three})`);
  assert(mood.month < 40, `a bad month: owners unhappy (${mood.month})`);
  assert(mood.p30 < mood.p0 * 0.85 && mood.p3 > mood.p0 * 0.95, `prices fall only after a run of bad days (${mood.p0} → ${mood.p3} → ${mood.p30})`);
  assert(mood.dues < mood.full, `unhappy owners hold back dues (${mood.dues} of ${mood.full})`);
  assert(mood.repDrop > 0, 'unhappy owners cost reputation');

  // Saved and reloaded.
  await g.ev(`bldById(${ids.D}).keep = true; owners().mood = 55; saveNow()`);
  await g.page.reload(); await g.reloaded();
  const back = await g.ev(`(() => { const C = world.buildings.find((b) => b.type === 'condo' && b.tier === 0), D = world.buildings.find((b) => b.type === 'condo' && b.tier === 1);
    return { c: [C.sold, C.style, C.slope, !!C.home], d: [D.sold, D.keep, D.style], mood: Math.round(owners().mood) }; })()`);
  eq(back, { c: [1, 'scandi', true, true], d: [2, true, 'modern'], mood: 55 }, 'condos and owners survive a reload');
  eq(g.errors, [], 'no page errors');
  await g.page.close();

  // The build menu on a phone: a Lodging tab with hotels and three condo sizes.
  const p = await openGame(browser, url, { width: 390, height: 844 });
  await p.click('#startBtn'); await p.wait(300);
  const menu = await p.ev(`(() => { setTool('bld'); draft.btype = null; setBTab('stay'); renderSheet(); const cards = [...document.querySelectorAll('[data-action=pickB][data-v=condo]')];
    return { n: cards.length, tab: document.querySelector('[data-action=bTab][data-v=stay]').textContent, text: cards.map((c) => c.textContent.replace(/\\s+/g, ' ').trim()), names: cards.map((c) => c.title), small: cards.map((c) => c.querySelector('small').textContent), one: cards.every((c) => c.closest('.bsized') === cards[0].closest('.bsized')) }; })()`);
  eq(menu.n, 3, 'three condo sizes in the menu');
  eq(menu.one, true, 'as buttons on one condo card');
  eq(menu.tab, 'Lodging', 'the tab is called Lodging');
  eq(menu.small, ['1 home', '2 homes', '5 homes'], 'each size shows its homes');
  assert(menu.text[0].includes('Chalet') && menu.text[2].includes('Townhomes') && menu.names[0] === 'Ski chalet' && menu.names[2] === 'Row of townhomes', 'sizes have their own names: ' + menu.text.join(' | '));
  assert(!menu.text.some((t) => /undefined/.test(t)), 'nothing reads undefined');
  eq(p.errors, [], 'no phone errors');
  await p.page.close();
}
