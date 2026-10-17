// The tutorial checklist ticks off in order and keeps its own save.
import { openGame, eq } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(`state.cash -= 1234; saveNow(); $('mTitle').onclick()`); await g.wait(500);
  const mainCash = await g.ev(`state.cash`);
  await g.click('#tutBtn'); await g.wait(800);
  eq(await g.ev(`[practice, state.day, state.cash, state.wx.mild, state.tut].join()`), 'true,45,4000000,true,0', 'tutorial start');
  await g.ev(`(() => { const i = evalLift({x:14,z:56},{x:12,z:-10},'double'); commitLift(i,'double'); computeNetwork(); syncLabels(); })()`); await g.wait(300);
  eq(await g.ev(`state.tut`), 1, 'lift step done');
  await g.ev(`(() => { const L = world.lifts[0]; const pts = [{x: L.b.x+3, z: L.b.z+2}, {x: 22, z: 15}, {x: 24, z: 40}, {x: 22, z: 58}].map(q => ({...q, y: heightAt(q.x,q.z)})); commitTrail(evalTrail(pts,'wide'), pts, 'wide'); computeNetwork(); syncLabels(); })()`); await g.wait(300);
  eq(await g.ev(`state.tut`), 2, 'trail step done');
  await g.ev(`(() => { const b = evalBuilding('lodge', 4, 60, 0); commitBuilding(b, 'lodge', 4, 60, 0); computeNetwork(); syncLabels(); })()`); await g.wait(300);
  eq(await g.ev(`state.tut`), 3, 'lodge step done');
  await g.ev(`openDay()`); await g.wait(300);
  eq(await g.ev(`state.tut`), 4, 'open step done');
  await g.ev(`(() => { while (state.phase === 'open') simStep(1.5); })()`); await g.click('#rpNext'); await g.wait(400);
  eq(await g.ev(`state.tut`), 5, 'report step done');
  await g.click('#tutHome'); await g.wait(800);
  eq(await g.ev(`[practice, state.cash].join()`), `false,${mainCash}`, 'main resort untouched');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
