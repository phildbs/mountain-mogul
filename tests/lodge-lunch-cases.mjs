// Shared deterministic checks, run against the actual game functions in Node and Chromium.
export function lodgeLunchCases() {
  const saved = { buildings: world.buildings, time: state.time, cash: state.cash, today, random: Math.random, resumeGuest };
  const check = (ok, msg) => { if (!ok) throw Error(msg); };
  const bld = (type, tier, x = 0) => {
    const B = { id: 90000 + world.buildings.length, type, tier, name: 'Test ' + type, rot: 0, door: { x, z: 0 }, seatsW: [], isBase: false };
    initBldSim(B); world.buildings.push(B); return B;
  };
  const guest = () => ({ id: 99999, x: 0, z: 0, spend: 1, qh: 0.3, pat: 6, fancy: true, ate: false, skipped: false, lunchAt: 700, sat: 70, bl: 1, th: [], seen: {} });
  try {
    state.time = 720; world.buildings = []; Math.random = () => 0.1; resumeGuest = () => {};
    today = { rev: { food: 0 }, exp: { cogs: 0 } };
    const tiers = [];
    for (const tier of [0, 1, 2]) {
      world.buildings = [];
      const L = bld('lodge', tier), p = guest();
      const pick = bestVisit(p, L.door, 14, false, world.buildings, ['lunch']);
      check(pick?.B === L && pick.svc === 'food', 'lodge selected for lunch at size ' + tier);
      Object.assign(p, { svc: pick.svc, bid: L.id }); joinBuildingQueue(p, L); bldStep(L);
      check(p.st === 'inside' && L.today.services.food === AGENT, 'meal served at size ' + tier);
      check(L.today.revenue === svcPrice('food') * AGENT && L.today.cogs > 0, 'meal revenue and cost at size ' + tier);
      finishVisit(p);
      check(p.ate && !p.skipped && p.bl === 0 && L.used.seat === 0, 'meal satisfies hunger and frees seat at size ' + tier);
      tiers.push(bspec(L).seats);
    }
    world.buildings = [];
    const L = bld('lodge', 2), R = bld('restaurant', 0, 2), p = guest();
    R.used.seat = poolSlots(R, 'seat'); R.q.seat = Array(40).fill({});
    check(bestVisit(p, L.door, 14, false, world.buildings, ['lunch'])?.B === L, 'restaurant overflow chooses large lodge');
    // A nearby lodge must remain an option when the only faster venue is beyond the search radius.
    R.q.seat = []; R.used.seat = 0; R.door.x = 30;
    L.used.seat = poolSlots(L, 'seat'); L.q.seat = Array(500).fill({});
    check(bestVisit(p, L.door, 14, false, world.buildings, ['lunch'])?.B === L, 'unreachable restaurant cannot disqualify lodge');
    R.door.x = 2; p.pricedOut = ['dine'];
    check(bestVisit(p, L.door, 14, false, world.buildings, ['lunch'])?.B === L, 'rejected dining price cannot disqualify lodge');
    check(otherEatery(p, L) === null, 'queue alternatives honor rejected prices too');
    p.pricedOut = []; R.door.x = 30; R.isBase = true;
    check(bestVisit(p, L.door, 14, true, world.buildings, ['lunch'])?.B === R, 'base-wide search still allows base alternatives');
    R.isBase = false; R.door.x = 2;
    check(bestVisit(p, L.door, 14, false, [L], ['lunch'])?.B === L, 'restricted venue list is honored');
    return { seats: tiers, meals: 'served at all sizes', overflow: 'large lodge selected', alternatives: 'eligible venues only' };
  } finally {
    world.buildings = saved.buildings; state.time = saved.time; state.cash = saved.cash; today = saved.today;
    Math.random = saved.random; resumeGuest = saved.resumeGuest;
  }
}
