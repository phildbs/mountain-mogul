// Two trails that end into each other (a player's real layout): skiers must not bounce between them at the bottom.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(`(() => {
    state.cash = 1e8;
    const i = evalLift({x:-5.732,z:64.301},{x:-49.167,z:-17.253},'quad'); commitLift(i,'quad'); computeNetwork();
    for (const p of [
      [[-53.438,-15.463],[-64.838,-5.884],[-73.109,16.987],[-67.689,35.882],[-59.121,51.260],[-28.528,61.211],[-12.717,65.403]],
      [[-44.911,-19.422],[-33.790,-10.541],[-27.523,-12.595],[-27.374,1.978],[-21.849,16.102],[-16.301,23.208],[-7.215,32.248],[-12.473,52.244]],
      [[-51.039,-14.623],[-44.304,10.235],[-39.129,14.630],[-35.355,23.282],[-37.157,30.150],[-34.165,38.684],[-29.184,45.248],[-21.937,49.925],[-14.688,54.268]],
    ]) { const pts = p.map(([x,z]) => ({x, z, y: heightAt(x,z)})); commitTrail(evalTrail(pts, 'medium'), pts, 'medium'); computeNetwork(); }
    const b = evalBuilding('lodge', 3, 64, 0); commitBuilding(b, 'lodge', 3, 64, 0); computeNetwork(); syncLabels();
  })()`);
  // no trail hands skiers to the very end of another trail
  const bad = await g.ev(`world.trails.filter((t) => t.to && t.to.kind === 'trail' && t.joinIdx >= t.to.obj.samples.length - 3).map((t) => t.name)`);
  eq(bad, [], 'no trail ends into the end of another');
  eq(await g.ev(`world.trails.slice(1).map((t) => t.to && t.to.kind)`), ['lift', 'lift'], 'the two looping trails go on to the quad');
  await g.ev(SETUPS.midwinter);
  await g.ev(`openDay()`);
  await g.ev(`(() => { let n = 0; while (state.time < 720 && n < 99999) { simStep(1.5); n++; } })()`);
  const stuck = await g.ev(`guests.filter((x) => x.st === 'ski' && x.s >= x.T.len - 0.6).length`);
  assert(stuck < 3, `skiers stuck at a trail end: ${stuck}`);
  assert(await g.ev(`today.liftRiders[world.lifts[0].id] || 0`) > 200, 'guests keep riding the quad');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
