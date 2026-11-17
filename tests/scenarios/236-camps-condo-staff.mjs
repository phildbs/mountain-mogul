// From Adum888's feedback: a full kids' camp sends families on to another camp with room; sold condo homes need no
// resort staff (only homes rented by the night do); and a building's last-day profit counts its own staff.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 1e8`);

  // Staff by building: a sold chalet none, an unsold one a full crew, townhomes by the homes still to rent.
  const staff = await g.ev(`[bldStaff({ type: 'condo', tier: 0, sold: 1 }, 'open'), bldStaff({ type: 'condo', tier: 0 }, 'open'), bldStaff({ type: 'condo', tier: 2, sold: 2 }, 'open'),
    bldStaff({ type: 'condo', tier: 0 }, 'closed'), bldStaff({ type: 'lodge', tier: 0 }, 'lunch')]`);
  eq(staff, [0, 600, 360, 0, 300], 'condo crews follow the homes still rented');
  eq(await g.ev(`(() => { const B = { type: 'condo', tier: 0, sold: 1 }; return bldUpkeep(B, 'closed') === bldUpkeep(B, 'open'); })()`), true, 'closing condos keeps the homes’ upkeep');

  // Two kids' camps at the base.
  const built = await g.ev(`(() => { let n = 0;
    for (let z = 50; z < 80 && n < 2; z += 2) for (let x = -30; x < 40 && n < 2; x += 2) { const b = evalBuilding('kids', x, z, 0); if (!b.problems.length) { commitBuilding(b, 'kids', x, z, 0); computeNetwork(); n++; } }
    return n; })()`);
  eq(built, 2, 'two camps built');
  await g.ev(`openDay()`);
  const camp = await g.ev(`(() => {
    let n = 0; while (!guests.length && n++ < 4000) simStep(1.5);
    const g = guests[0], [A, B] = world.buildings.filter((b) => b.type === 'kids'), near = nearestOpen(['kids'], g), other = near === A ? B : A;
    near.today.visits = bspec(near).campers; g.spend = 10; const was = other.today.visits;
    campDropOff(g);
    const sent = other.today.visits > was;
    other.today.visits = bspec(other).campers; const g2 = guests.find((x) => x !== g) || g; g2.spend = 10; const full = today.complaints.campFull || 0; campDropOff(g2);
    return { sent, full: (today.complaints.campFull || 0) > full };
  })()`);
  eq(camp, { sent: true, full: true }, 'a full camp sends families to the other camp; both full, the kids tag along');

  // Last-day profit counts the building's own staff.
  await g.ev(SETUPS.finishDay);
  const lodge = await g.ev(`(() => { const B = world.buildings.find((b) => b.type === 'lodge'), ops = state.lastReport.ops || runOps; const P = opsState().plans[planFor(state.day - 1)];
    return { gap: B.yday.revenue - B.yday.profit, floor: Math.round(bldUpkeep(B, 'open', P) + bldStaff(B, 'open') * staffRate(P)) }; })()`);
  assert(lodge.gap >= lodge.floor - 2, `lodge profit takes off upkeep and staff (${lodge.gap} vs at least ${lodge.floor})`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
