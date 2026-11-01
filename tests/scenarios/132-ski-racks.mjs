// Ski racks: skiers leave their skis on the rack by a building's door (or a placed rack nearby) and walk in
// boots; with every rack full the skis go in the snow, which stings once a day after a new resort's first days.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  // A placed rack beside the lodge door, built overnight.
  const placed = await g.ev(`(() => {
    state.cash = 1e7;
    const L = world.buildings.find((b) => b.type === 'lodge');
    for (let r = 0.8; r < 2.8; r += 0.2) for (let a = 0; a < 24; a++) {
      const x = L.door.x + Math.cos(a / 24 * 6.283) * r, z = L.door.z + Math.sin(a / 24 * 6.283) * r, i = evalBuilding('rack', x, z, L.rot);
      if (i && !(i.problems || []).length) { commitBuilding(i, 'rack', x, z, L.rot); computeNetwork(); const R = world.buildings.find((b) => b.type === 'rack'); return { cap: rackCap(R), lodge: rackCap(L), menu: BGROUPS.find((t) => t[0] === 'decor')[2].includes('rack'), near: distXZ(R, L.door) < RACK_R }; }
    }
    return 'no spot';
  })()`);
  eq(placed, { cap: 12, lodge: 95, menu: true, near: true }, 'a 12-pair rack in the Decor tab; a small lodge racks about three quarters of its seats and stalls');

  const steps = await g.ev(`(() => {
    state.seasonStats.days = 10; state.day = 45; openDay(); state.speed = 0;
    const L = world.buildings.find((b) => b.type === 'lodge'), R = world.buildings.find((b) => b.type === 'rack'), out = {};
    const guest = () => { const k = { ...makeGuestLike(), id: nextGid++ }; guests.push(k); gById.set(k.id, k); return k; };
    function makeGuestLike() { return { ...makeGuest({ id: -1, members: [] }, L.door.x + 4, L.door.z + 4), st: 'walk', onSkis: true, needsRental: false, sight: false, then: null }; }
    const go = (k) => { k.x = k.tx; k.z = k.tz; arrive(k); };
    // 1. Room by the door: skis on the lodge's own rack, a walk to the door in boots, back for them afterwards.
    const a = guest(), sat0 = a.sat;
    startVisit(a, L, 'warm', { k: 'base' });
    out.toOwnRack = a.then.rid === L.id && a.tx === L.rackP.x && a.tz === L.rackP.z;
    go(a); out.dropped = [a.rack === L.id, a.onSkis, a.then && a.then.k];
    go(a); out.inLine = a.st;
    L.q.seat = L.q.seat.filter((x) => x !== a); leaveBuilding(a, L);
    out.backForSkis = a.then && a.then.k === 'skis' && a.tx === L.rackP.x;
    go(a); out.pickedUp = [a.rack, a.onSkis, a.sat === sat0];
    // 2. The lodge's rack is full: the placed rack nearby instead.
    rackCount(); rackUse.set(L.id, 1000);
    const b = guest(); startVisit(b, L, 'warm', { k: 'base' });
    out.toPlaced = b.then.rid === R.id; go(b); out.onPlaced = b.rack === R.id && rackCount().get(R.id) >= 1;
    // 3. Every rack full: skis in the snow by the door. It stings once, and only once a day.
    rackUse.set(R.id, 12);
    const c = guest(), csat = c.sat, n0 = today.complaints.rack || 0; startVisit(c, L, 'warm', { k: 'base' });
    out.toDoor = c.then.rid === undefined && c.tx === L.door.x; go(c);
    out.snow = [c.rack === -L.id, csat - c.sat, (today.complaints.rack || 0) - n0, today.rackAt[L.id]];
    L.q.seat = L.q.seat.filter((x) => x !== c); leaveBuilding(c, L); out.snowPickup = c.rack === undefined;
    startVisit(c, L, 'warm', { k: 'base' }); go(c);
    out.once = [(today.complaints.rack || 0) - n0, today.rackAt[L.id]];
    L.q.seat = L.q.seat.filter((x) => x !== c); leaveBuilding(c, L);
    // 4. A new resort's first days: skis in the snow, but no complaint yet.
    state.seasonStats.days = 1; rackUse.set(L.id, 1000); rackUse.set(R.id, 12);
    const d = guest(), dsat = d.sat; startVisit(d, L, 'warm', { k: 'base' }); go(d);
    out.easy = [d.rack === -L.id, d.sat === dsat, (today.complaints.rack || 0) - n0, !!today.rackEasy];
    L.q.seat = L.q.seat.filter((x) => x !== d); leaveBuilding(d, L); go(d);
    state.seasonStats.days = 10; delete today.rackEasy;
    // 5. Guests without skis (sightseers, renters on the way in) never stop at a rack.
    const e = guest(); e.sight = true; startVisit(e, L, 'warm', { k: 'base' }); out.noSkis = e.then.rid === undefined && e.tx === L.door.x;
    for (const k of [a, b, c, d, e]) { k.gone = true; gById.delete(k.id); }
    guests = guests.filter((k) => !k.gone); rackMin = -1;
    // The cards say what the racks hold.
    select({ kind: 'bld', obj: L }); renderSheet(); out.lodgeCard = /ski rack by the door holds 95 pairs/.test($('sheet').textContent) && /pairs on its ski rack/.test($('sheet').textContent);
    select({ kind: 'bld', obj: R }); renderSheet(); out.rackCard = /of 12 pairs of skis on the rack/.test($('sheet').textContent);
    select(null);
    return out;
  })()`);
  eq(steps, {
    toOwnRack: true, dropped: [true, false, 'bld'], inLine: 'bq', backForSkis: true, pickedUp: [null, true, true],
    toPlaced: true, onPlaced: true,
    toDoor: true, snow: [true, 3, 1, 1], snowPickup: true, once: [1, 2],
    easy: [true, true, 1, true], noSkis: true, lodgeCard: true, rackCard: true,
  }, 'skis go on the nearest free rack, then in the snow; the first-days grace and once-a-day sting hold');

  // A whole busy day: racks fill at lunch, nobody skis or rides without their skis, and a mid-day save keeps them.
  const day = await g.ev(`(() => {
    let n = 0, racked = 0, wrong = 0, saved = null;
    while (state.phase === 'open' && n < 90000) {
      simStep(1.5); n++;
      if (n % 10) continue;
      for (const k of guests) { if (k.rack > 0) racked++; if (k.rack != null && (k.st === 'ski' || k.st === 'ride' || k.st === 'queue')) wrong++; }
      if (!saved && state.time >= 760) {
        const before = guests.filter((k) => k.rack != null).map((k) => k.id + ':' + k.rack).sort().join();
        restoreSim(JSON.parse(JSON.stringify(serializeSim())));
        saved = before.length > 0 && before === guests.filter((k) => k.rack != null).map((k) => k.id + ':' + k.rack).sort().join();
      }
    }
    const r = state.lastReport;
    return { phase: state.phase, racked: racked > 0, wrong, saved, holding: guests.filter((k) => k.rack != null).length, report: !!r.racks && r.racks.at[0].name === world.buildings.find((b) => b.type === 'lodge').name && r.complaints.rack >= 1 };
  })()`);
  eq(day, { phase: 'report', racked: true, wrong: 0, saved: true, holding: 0, report: true }, 'a day with racks runs clean and survives a mid-day save');
  assert(await g.ev(`/ski rack/i.test(adviceFor(state.lastReport) + JSON.stringify(advice().map((a) => a.text))) || state.lastReport.racks.n < 15`), 'advice mentions ski racks when skis end up in the snow');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
