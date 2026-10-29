// A generous food supply must feed guests; closing food must remain a meaningful management choice.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const results=[];
  for (const open of [true,false]) {
    const g=await openGame(browser,url);await g.click('#startBtn');await g.wait(300);
    await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
    await g.ev(`(() => {
      let seed=1409;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
      const B=world.buildings.find(B=>B.type==='lodge');B.tier=2;
      // Keep food prices and guest budgets at their normal values.
      const P=opsState().plans[planFor(state.day)];P.bld[B.id]='${open?'open':'closed'}';openDay();state.speed=0;
    })()`);
    eq(await g.ev(SETUPS.finishDay),'report','test resort finishes its day');
    const r=await g.ev(`({meals:state.lastReport.meals,missed:state.lastReport.complaints.food,note:hungryNote(state.lastReport)})`);
    assert(r.meals && r.meals.onTime+r.meals.delayed+r.meals.missed>20,`enough lunch guests to assess supply: ${JSON.stringify(r)}`);
    eq(r.missed,r.meals.missed,'missed-meal complaints reconcile to actual outcomes');
    results.push(r);eq(g.errors,[],'no page errors');await g.page.close();
  }
  const [supplied,closed]=results, fed=supplied.meals.onTime+supplied.meals.delayed;
  assert(fed/(fed+supplied.meals.missed)>0.8,`ample lodge capacity feeds at least 80% at normal prices: ${JSON.stringify(supplied)}`);
  assert(closed.meals.missed>supplied.meals.missed*2 && closed.meals.onTime+closed.meals.delayed===0,`closing food causes more missed meals: ${JSON.stringify(results)}`);
  return JSON.stringify({supplied:supplied.meals,closed:closed.meals});
}
