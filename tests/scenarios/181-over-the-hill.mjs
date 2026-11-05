// From Snowy's feedback (Snowy Summit, Ridgeback): "a huge amount of guests hike over the top of the entire mountain
// between base areas", "guests path towards one random point or corner, then turn around", and a clump at the bus
// stations after the bus has left. With the land behind the mountain bought, the low ground joined up all the way
// round, so the backside counted as base: guests walked straight over the ridge to lifts there, and bus riders to
// whichever station was nearest in a straight line. A guest area painted over the base sent everyone to one corner
// of it first. The clump was guests waiting for the base shuttle, which the station card didn't count.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { mountain: 'ridgeback' });
  await g.click('#startBtn'); await g.wait(400);
  const setup = await g.ev(`(() => {
    state.welcomed = true; select(null); state.cash = 1e8; state.reputation = 1.3;
    state.land = PARCELS.filter((p) => p.id !== MOUNTAIN.townParcel).map((p) => ({ id: p.id, own: 'buy', rent: 0, wait: 0, price: 1 })); applyLand(); terrainRev++;
    state.lotLayout = [[0, 0, 0], [0, 1, 0], [0, 0, 1], [0, 1, 1]]; state.lotSections = 4; buildLot();
    const lift = (a, b) => { const i = evalLift(a, b, 'six'); if (i.problems.length) throw new Error('lift: ' + i.problems); commitLift(i, 'six'); computeNetwork(); return world.lifts[world.lifts.length - 1]; };
    const trail = (w) => { const pts = w.map(([x, z]) => ({ x, z, y: heightAt(x, z) })), t = evalTrail(pts, 'wide'); if (t.an.problems.length) throw new Error('trail: ' + t.an.problems); commitTrail(t, pts, 'wide'); computeNetwork(); return realTrails().at(-1); };
    const LB = lift({ x: -36, z: 44 }, { x: -31, z: -10 }), LE = lift({ x: 40, z: 26 }, { x: 30, z: -22 });
    trail([[-34, -8], [-59, 10], [-54, 23], [-40, 46]]);
    trail([[27, -20], [7, -3], [8, 14], [36, 28]]); trail([[33, -20], [51, -13], [65, 0], [58, 15], [44, 28]]);
    trail([[LE.b.x - 3, LE.b.z + 1], [-1, -18], [-28, -12], [-38, 8], [-40, 30], [LB.a.x - 4, LB.a.z + 2]]);
    const LN = lift({ x: -37, z: -71 }, { x: -35, z: -18 }), LX = lift({ x: 37, z: -88 }, { x: 32, z: -28 }); // two lifts up the back
    trail([[LN.b.x - 3, LN.b.z + 2], [-56, 0], [-58, 20], [-42, 44]]);
    trail([[LB.b.x - 2, LB.b.z - 3], [-50, -35], [-46, -55], [-39, -69]]); trail([[LN.b.x + 2, LN.b.z - 3], [-22, -40], [-28, -60], [-35, -70]]);
    for (const [x, z] of [[-24, 50], [-50, 40], [52, 40], [30, 34]]) { const b = evalBuilding('lodge', x, z, 0); if (!b.problems.length) commitBuilding(b, 'lodge', x, z, 0); }
    computeNetwork();
    const spots = [];
    for (const p of [...ROAD_WORLD, ...(BRANCH_WORLD || [])]) for (const off of [-3, 3]) {
      const sn = snapToRoad('transit', { x: p.x, z: p.z + off }), v = evalBuilding('transit', sn.x, sn.z, sn.rot, false);
      if (v.problems.length || !isBase(sn) || spots.filter((o) => baseOf(o) === baseOf(sn)).length >= 2 || spots.some((o) => Math.hypot(o.x - sn.x, o.z - sn.z) < 8)) continue;
      commitBuilding(v, 'transit', sn.x, sn.z, sn.rot); computeNetwork(); spots.push(sn);
    }
    // A big guest area painted over the west base.
    const blocks = hubBlocks(null), ok = (k) => !hubCellProblem(keyX(k), keyZ(k), blocks);
    const out = [cellKey(Math.round(LB.a.x) - 3, Math.round(LB.a.z) + 4)].filter(ok), seen = new Set(out);
    for (let i = 0; i < out.length && out.length < 1400; i++) for (const d of HUB_STEPS) { const k = out[i] + d, p = { x: keyX(k), z: keyZ(k) }; if (seen.has(k) || !ok(k)) continue; seen.add(k); if (!isBase(p) || baseOf(p) !== 0) continue; out.push(k); }
    areaDraft = { cells: new Set(out), erase: false, editId: null }; commitHub(areaDraftInfo());
    state.offsite = 2;
    const A = world.areas.find(isHub);
    return { back: [isBase({ x: 37, z: -88 }), isBase({ x: -37, z: -74 }), isBase({ x: 0, z: -80 })], front: [isBase({ x: -40, z: 60 }), isBase({ x: 45, z: 35 })],
      fromBase: [LX.fromBase, LN.fromBase, LB.fromBase, LE.fromBase], stations: spots.map((s) => baseOf(s)), area: A.cells.length, exits: A.exits.length };
  })()`);
  eq(setup.back, [false, false, false], 'with the land behind the ridge bought, the low ground there is still not a base');
  eq(setup.front, [true, true], 'the ground by both lots is');
  eq(setup.fromBase, [false, false, true, true], 'the lifts up the back are not base lifts');
  eq(setup.stations.sort(), [0, 0, 1, 1], 'two transit centers at each base');
  assert(setup.area > 800 && setup.exits > 10, `a big base area with ways out all along it: ${JSON.stringify(setup)}`);
  await g.ev(SETUPS.midwinter);
  const r = await g.ev(`(() => {
    let seed = 7; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    openDay(); state.speed = 0;
    const over = {}, A = world.areas.find(isHub), corner = { n: 0, far: 0 };
    const sm = setMove; setMove = (g, p, mode, then) => {
      if ((mode === 'walk' || mode === 'glide') && !(then && then.k === 'hubWalk') && !/limp/.test(g.th[0] || '')) {
        const top = Math.max(trueY(g.x, g.z), trueY(p.x, p.z)); let hi = 0;
        for (let f = 0; f <= 1; f += 0.05) hi = Math.max(hi, trueY(g.x + (p.x - g.x) * f, g.z + (p.z - g.z) * f) - top);
        if (hi > 5) { const k = (then && then.k) || '?'; over[k] = (over[k] || 0) + 1; }
      }
      return sm(g, p, mode, then);
    };
    const wh = walkHub; walkHub = (g, A2, p, then) => { if (then && then.k === 'hubBase') { corner.n++; if (Math.hypot(p.x - g.x, p.z - g.z) > 10) corner.far++; } return wh(g, A2, p, then); };
    let n = 0, card = '';
    while (state.phase === 'open' && n < 90000) { simStep(1.5); n++;
      if (!card && guests.some((x) => x.st === 'xbq')) { const B = bldById(guests.find((x) => x.st === 'xbq').stn); card = B ? bldLive(B) : ''; }
    }
    return { over, corner, card, guests: state.lastReport.guests };
  })()`);
  eq(r.over, {}, 'nobody walks straight over the mountain');
  assert(r.corner.far < r.corner.n * 0.05 + 5, `guests in the base area go where they're heading, not to one corner first: ${JSON.stringify(r.corner)}`);
  assert(r.guests > 1000, `a busy day: ${r.guests}`);
  assert(/for the base shuttle/.test(r.card), `the station card counts guests waiting for the base shuttle: ${r.card}`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
