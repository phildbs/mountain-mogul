// Guests who paid don't go home without a run just because their planned time passed, and late arrivals plan a real afternoon.
import {openGame,eq,assert,SETUPS} from '../harness.mjs';
export default async function({browser,url}) {
  const g=await openGame(browser,url);
  await g.click('#startBtn');await g.wait(300);
  await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  const r=await g.ev(`(() => {
    state.cash=2e7;state.day=40;openDay();schedule=[];
    const L=world.lifts[0],add=(t,extra)=>{state.time=t;const p=makeGuest({id:null},L.a.x+2,L.a.z+3);Object.assign(p,{needsRental:false,wantsLesson:false,sight:false},extra);guests.push(p);gById.set(p.id,p);return p;};
    // A late arrival: planned leaving times sit around midday to late afternoon, so 12:50 used to mean a few minutes' skiing.
    let late=Infinity;for(let i=0;i<40;i++)late=Math.min(late,add(770).leaveAt-770);
    // A slow starter whose planned time has passed before their first ride.
    const slow=add(800,{leaveAt:799});updateLeaving(slow);
    const stays=!slow.leaving&&slow.leaveAt>state.time;
    // One who has skied goes home on time.
    const done=add(800,{leaveAt:799,runs:2});updateLeaving(done);
    // At closing, everyone goes.
    const closing=add(closeTime(),{leaveAt:799});updateLeaving(closing);
    return {late:late>=120,stays,doneLeaves:done.leaving,closingLeaves:closing.leaving};
  })()`);
  eq(r,{late:true,stays:true,doneLeaves:true,closingLeaves:true},'no-run guests stay on; late arrivals plan two hours or more');
}
