// Adum888's feedback (4.18): base snowmaking shares the water, the gun count and the pond discount; cruisers only
// mind a park when they have to squeeze past its features; walking guests say where they're going; passes up to $2,500.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 5e6; state.reputation = 1.1`);

  // Base guns: counted with the trails' guns, on the same water, at the pond's price.
  const sm = await g.ev(`(() => {
    for (const t of realTrails()) t.sm = { on: true, mode: 'always', target: 99 };
    const trailGuns = smGunsInstalled();
    state.baseSm = { mode: 'always', target: 18 };
    const all = smGunsInstalled(), bz = baseZone(), d0 = baseDepth();
    const one = runSnowmaking(-20), grew = baseDepth() - d0;
    world.ponds.push({ id: -1, name: 'Test Pond', cells: new Array(400).fill(0) }); // water for 600 guns: everything runs on pond water
    const pond = runSnowmaking(-20); world.ponds.pop();
    state.baseSm.mode = 'off'; const off = runSnowmaking(-20);
    return { trailGuns, all, base: baseGuns(), zone: bz.length, one: { want: one.want, base: one.base, cost: one.cost }, grew, pond: { pond: pond.pond, cost: pond.cost, base: pond.base }, off: { want: off.want, base: off.base } };
  })()`);
  assert(sm.zone > 0, 'the starter resort has a base area');
  eq(sm.all, sm.trailGuns + sm.base, 'base guns count towards your snow guns');
  eq([sm.one.want, sm.one.base], [sm.all, true], 'the base runs on the same water as the trails');
  assert(sm.grew > 0, `the base gets its snow (${sm.grew})`);
  eq(sm.pond.pond, sm.all, 'with a pond big enough, every gun runs on pond water, the base too');
  assert(Math.abs(sm.pond.cost - sm.one.cost * 0.55) <= 2, `pond water costs 45% less, base included (${sm.one.cost} → ${sm.pond.cost})`);
  eq([sm.off.want, sm.off.base], [sm.trailGuns, false], 'base snowmaking switched off leaves the base out');
  // short of water, the base makes its share like the trails
  const short = await g.ev(`(() => { state.baseSm.mode = 'always'; const t = realTrails()[0], keep = t.an.len; t.an.len = 4000;
    const NS0 = baseDepth(), r = runSnowmaking(-20), grew = baseDepth() - NS0; t.an.len = keep; state.baseSm.mode = 'off';
    return { want: r.want, ran: r.ran, grew, full: 5 * clamp((28 - tempAt(-20, MOUNTAIN.baseH)) / 12, 0, 1) }; })()`);
  assert(short.want > short.ran, `more guns than water (${short.want} for ${short.ran})`);
  assert(short.grew < short.full * 0.9 && short.grew > 0, `the base makes its share (${short.grew.toFixed(2)} of ${short.full.toFixed(2)})`);
  await g.ev(`select({ kind: 'manage', obj: 'snow' })`); await g.wait(50);
  assert(/share your snowmaking water/.test(await g.ev(`$('sheet').innerText`)), 'the base snowmaking panel says it shares the water');

  // Park room: a box at the edge of a wide trail leaves room; a jump in the middle of a narrow one doesn't.
  const room = await g.ev(`(() => {
    const t = realTrails()[0], set = (hw, feats) => { t.ws = [hw, hw, hw]; shapeSamples(t.samples, t.ws); t.feats = feats; buildFeats(t); return t.fxSq; };
    const wideEdge = set(4.9, [{ id: 9001, type: 'box', at: 0.5, off: -1 }]);
    const wideMid = set(4.9, [{ id: 9001, type: 'jump', at: 0.5, off: 0 }]);
    const mediumMid = set(2.6, [{ id: 9001, type: 'jump', at: 0.5, off: 0 }]);
    const mediumEdge = set(2.6, [{ id: 9001, type: 'jump', at: 0.5, off: 1 }]);
    const narrowMid = set(1.6, [{ id: 9001, type: 'jump', at: 0.5, off: 0 }]);
    const side = set(2.6, [{ id: 9001, type: 'box', at: 0.5, off: -1 }, { id: 9002, type: 'box', at: 0.5, off: 1 }, { id: 9003, type: 'roller', at: 0.5, off: 0 }]);
    return { wideEdge, wideMid, mediumMid, mediumEdge, narrowMid, side };
  })()`);
  eq([room.wideEdge, room.wideMid, room.mediumEdge], [0, 0, 0], 'a wide trail, or a feature at the side, leaves room');
  assert(room.mediumMid > 0 && room.mediumMid < 0.6, `a jump in the middle of a medium trail is a little tight (${room.mediumMid})`);
  assert(room.narrowMid > 0.8, `a jump in the middle of a narrow trail leaves no room (${room.narrowMid})`);
  assert(room.side > room.mediumMid, `features side by side leave less room than one (${room.side})`);
  // A day with a roomy park: nobody counts as annoyed. With a squeezed one, cruisers do.
  const day = (hw, off) => g.ev(`(() => {
    let seed = 3; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const t = realTrails()[0]; t.ws = [${hw}, ${hw}, ${hw}]; shapeSamples(t.samples, t.ws); computeNetwork();
    t.feats = [{ id: 9001, type: 'jump', at: 0.4, off: ${off} }, { id: 9002, type: 'box', at: 0.6, off: ${off} }]; buildFeats(t);
    demandForDay = () => 600; state.day = 41; state.phase = 'closed'; state.time = DAY_OPEN; openDay(); state.speed = 0;
    for (let n = 0; state.phase === 'open' && state.time < 14 * 60 && n < 20000; n++) simStep(1.5);
    const r = { sq: t.fxSq, cruise: (today.parkCruise || {})[t.id] || 0, runs: (today.trailRuns || {})[t.id] || 0, card: (() => { select({ kind: 'trail', obj: t }); return $('sheet').innerText; })() };
    while (state.phase === 'open') simStep(1.5);
    return r; })()`);
  const roomy = await day(4.9, -1), tight = await day(1.6, 0);
  eq([roomy.sq, roomy.cruise], [0, 0], 'a roomy park annoys nobody');
  assert(/Plenty of room for other skiers/.test(roomy.card), 'the trail card says there is room');
  assert(tight.sq > 0.8 && tight.cruise > 0, `a squeezed park annoys cruisers (${tight.cruise})`);
  assert(/have to squeeze past/.test(tight.card), 'the trail card says they have to squeeze past');

  // Walking guests say where they're going, not "Looking around".
  const labels = await g.ev(`(() => { const T = realTrails()[0], L = world.lifts[0], g0 = { id: -5, x: 0, z: 0, st: 'walk' };
    const say = (then) => guestActivity({ ...g0, then });
    return [say({ k: 'hubWalk', path: [], next: { k: 'ski', tid: T.id } }), say({ k: 'hubEnter', next: { k: 'hubQueue', lid: L.id } }),
      say({ k: 'hubWalk', path: [], next: { k: 'hubBase' } }), say({ k: 'skis' }), say({ k: 'hubCar' }), say(null), T.name, L.name]; })()`);
  eq(labels.slice(0, 6), [`Heading to ${labels[6]}`, `Heading to ${labels[7]}`, 'Heading to the base', 'Fetching their skis', 'Walking back to the car', 'Looking around'], 'walking guests name where they are going');

  // Passes: up to $2,500, and a dear pass sells to almost nobody.
  const pass = await g.ev(`(() => { state.passSale = null; state.passPrice = 2400; openManage('prices');
    const up = () => document.querySelector('#sheet [data-action=passPrice][data-d="50"]'); if (!up()) return null;
    for (let i = 0; i < 5; i++) up().click();
    return { max: state.passPrice, at399: passBuyers(399), at999: passBuyers(999), at2500: passBuyers(2500) }; })()`);
  assert(pass, 'the pass price buttons are on the card');
  eq(pass.max, 2500, 'the pass price stops at $2,500');
  assert(pass.at399 > pass.at999 && pass.at999 > pass.at2500 && pass.at2500 <= Math.max(1, pass.at399 * 0.02), `a dearer pass sells fewer (${pass.at399}, ${pass.at999}, ${pass.at2500})`);
  eq(g.errors, [], 'no errors');
}
