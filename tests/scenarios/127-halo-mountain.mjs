// Halo Mountain: a lone hill in the middle with a ring road round its foot, a branch out to town and the main
// lot on the south side. Cars drive in from town; the ring and the town are scenery, and no land is sold under town.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('[data-slot=new]'); await g.wait(100);
  assert(/Halo Mountain/i.test(await g.ev(`$('titleSlots').innerText`)), 'picker lists Halo Mountain');
  await g.click('[data-slot=pick][data-mt=halo]'); await g.reloaded();
  const m = await g.ev(`({ id: MOUNTAIN.id, cash: state.cash, vert: ft(MOUNTAIN.summitH) - ft(MOUNTAIN.baseH), goals: goalList().map((G) => G.id),
    ring: ringPath().length, town: !!townMesh, sw: PARCELS.some((p) => p.id === 'SW'), parcels: PARCELS.length,
    // the ring goes all the way round the summit: its points fill every eighth of the circle
    round: new Set(ringPath().map((p) => Math.floor((Math.atan2(p.z - (PLAY1 - HALO_S[1] * PN - HALF), p.x) / Math.PI + 1) * 4) % 8)).size,
    ringOnGround: ringPath().every((p) => roadDist(p.x, p.z) < 0.6) })`);
  eq([m.id, m.cash], ['halo', 2300000], 'Halo Mountain with its starting cash');
  assert(m.vert > 400 && m.vert < 800, `a gentle hill (${m.vert} ft vertical)`);
  eq(m.goals, ['firstDay', 'bothSides', 'mix', 'crowd400', 'profit'], 'its own goals');
  assert(m.ring > 400 && m.round === 8, 'a road all the way round the hill');
  assert(m.ringOnGround, 'the ring is cut into the ground like the access road (nothing can be built on it)');
  assert(m.town && !m.sw && m.parcels === 23, 'a town off the southwest corner, where no land is for sale');
  // the main lot sits on the south side, outside the ring and clear of it
  const lot = await g.ev(`(() => { const b = lotBoxes()[0]; return { z0: b.z0, road: footprintStats(b).roadMin }; })()`);
  assert(lot.z0 > 50 && lot.road > 1.8, `main lot south of the ring (${lot.z0.toFixed(1)}, ${lot.road.toFixed(1)} from the road)`);
  // a starter resort on the sunny side: a chair from the south apron to near the top, two trails and a lodge
  await g.click('#startBtn'); await g.wait(400);
  const built = await g.ev(`(() => {
    const i = evalLift({x:0,z:42},{x:0,z:-16},'double'); if (i.problems.length) throw new Error('lift: ' + i.problems); commitLift(i,'double'); computeNetwork();
    const L = world.lifts[0];
    for (const w of [[[-3,-14],[-5,0],[-20,4],[-13,16],[-13,36],[-5,44]], [[3,-14],[10,8],[12,30],[5,44]]]) {
      const pts = w.map(([x,z]) => ({x, z, y: heightAt(x,z)})), t = evalTrail(pts, 'wide');
      if (t.an.problems.length) throw new Error('trail: ' + t.an.problems); commitTrail(t, pts, 'wide'); computeNetwork();
    }
    const b = evalBuilding('lodge', 10, 44, 0); if (b.problems.length) throw new Error('lodge: ' + b.problems); commitBuilding(b, 'lodge', 10, 44, 0); computeNetwork(); syncLabels();
    return { fromBase: L.fromBase, ratings: world.trails.map(trailSign), north: haloNorth(L.a) };
  })()`);
  assert(built.fromBase && !built.north, 'the lift starts in the base area on the south side');
  assert(built.ratings.includes(0), `a green from the top, winding across the sunny side (${built.ratings})`);
  await g.ev(SETUPS.midwinter);
  await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
  const r = await g.ev(`({ guests: state.lastReport.guests, goals: state.lastReport.goals })`);
  assert(r.guests > 100, `guests drove in from town (${r.guests})`);
  assert(r.goals.includes('First chair'), 'first goal on the first day');
  eq(await g.ev(`goalList().find((G) => G.id === 'bothSides').prog()`), 'Now one up the shady north side, round the back of the hill.', 'the next goal points round the back');
  await g.ev(`saveNow(); $('mTitle').onclick()`); await g.wait(500);
  assert(/Halo Mountain/i.test(await g.ev(`$('titleSlots').innerText`)), 'saved mountain listed as Halo Mountain');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
