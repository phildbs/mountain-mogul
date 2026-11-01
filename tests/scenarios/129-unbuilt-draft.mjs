// Leaving a drawn trail or lift that isn't built yet asks first: build it, throw it away, or keep editing.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter);
  const draw = `(() => { setTool('trail'); const L = world.lifts[0];
    draft.pts = [[L.b.x - 3, L.b.z + 2], [2, 15], [0, 40], [6, 58]].map(([x, z]) => ({ x, z })); draft.dirty = true; recomputeDraft(); return draft.info.an.problems.length; })()`;
  eq(await g.ev(draw), 0, 'a buildable trail is drawn');
  const trails = await g.ev(`world.trails.length`);
  // closing the card asks, and Keep editing keeps the drawing
  await g.click('[data-action=exitTool]'); await g.wait(100);
  const ask = await g.ev(`({ open: !$('crisis').hidden, text: $('crisis').innerText, build: !!$('crYes') })`);
  assert(ask.open && /Build this trail\?/i.test(ask.text) && ask.build && /Build · \$/.test(ask.text), `asks before losing the trail: ${ask.text.replace(/\s+/g, " ")}`);
  await g.click('#crKeep'); await g.wait(100);
  eq(await g.ev(`[$('crisis').hidden, state.tool, draft.pts.length]`), [true, 'trail', 4], 'Keep editing: still drawing the same trail');
  // a toolbar button asks too; Throw it away drops it and goes on
  await g.click('#tLift'); await g.wait(100);
  eq(await g.ev(`!$('crisis').hidden`), true, 'switching tools asks too');
  await g.click('#crNo'); await g.wait(100);
  eq(await g.ev(`[$('crisis').hidden, state.tool, draft.pts.length, world.trails.length]`), [true, 'lift', 0, trails], 'Throw it away: nothing built, on to the lift tool');
  // Build from the question builds it, then carries on
  await g.ev(draw);
  await g.click('#tExplore'); await g.wait(100);
  await g.click('#crYes'); await g.wait(100);
  eq(await g.ev(`[$('crisis').hidden, state.tool, world.trails.length]`), [true, 'explore', trails + 1], 'Build: the trail is built, then back to exploring');
  // nothing drawn, nothing to ask; one point isn't a trail yet
  await g.ev(`setTool('trail'); draft.pts = [{ x: 0, z: 0 }]`);
  await g.click('#tExplore'); await g.wait(100);
  eq(await g.ev(`[$('crisis').hidden, state.tool]`), [true, 'explore'], 'a single point leaves without asking');
  // a lift that can't be built yet: no Build button, just the reason
  await g.ev(`(() => { setTool('lift'); draft.pts = [{ x: 0, z: 56 }, { x: 0, z: 54 }]; draft.dirty = true; recomputeDraft(); })()`);
  await g.click('[data-action=exitTool]'); await g.wait(100);
  const lift = await g.ev(`({ text: $('crisis').innerText, build: !!$('crYes') })`);
  assert(/Build this lift\?/i.test(lift.text) && !lift.build && /can’t be built/.test(lift.text), `a lift that can't be built says why, with no Build button: ${lift.text.replace(/\s+/g, " ")}`);
  await g.click('#crNo'); await g.wait(100);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
