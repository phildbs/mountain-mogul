// Busy days stay quick: guests keep one object shape, and mid-day saves skip parked cars' road paths and
// long decimals, yet a reloaded day carries on with its cars, guests and lines intact.
import {openGame,eq,assert,SETUPS} from '../harness.mjs';
export default async function({browser,url}) {
  const g=await openGame(browser,url);await g.click('#startBtn');await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  const noon=await g.ev(`(() => {
    state.day=41;openDay();state.speed=0;let n=0;while(state.time<720&&state.phase==='open'&&n++<90000)simStep(1.5);
    const shapes=new Set(guests.map((x)=>Object.keys(x).join(','))).size;
    const sim=saveData(true).sim, parked=sim.cars.filter((c)=>c.st==='parked'), moving=sim.cars.filter((c)=>c.st!=='parked');
    const long=sim.guests.some((x)=>Object.values(x).some((v)=>typeof v==='number'&&String(v).split('.')[1]?.length>3));
    return {guests:guests.length,shapes,parked:parked.length,parkedPaths:parked.filter((c)=>c.path).length,moving:moving.length,movingPaths:moving.filter((c)=>c.path).length,long,
      queues:world.lifts.map((L)=>L.queue.length),time:state.time};
  })()`);
  assert(noon.guests>20&&noon.parked>5,`a busy enough morning (${JSON.stringify(noon)})`);
  eq(noon.shapes,1,'every guest shares one object shape');
  eq(noon.parkedPaths,0,'parked cars save no road path');eq(noon.movingPaths,noon.moving,'moving cars keep their path');
  eq(noon.long,false,'guest decimals are saved to thousandths');
  await g.ev('saveNow()');await g.page.reload();await g.reloaded();await g.click('#startBtn');
  const back=await g.ev(`({guests:guests.length,queues:world.lifts.map((L)=>L.queue.length),time:state.time,phase:state.phase})`);
  eq(back,{guests:noon.guests,queues:noon.queues,time:noon.time,phase:'open'},'the day reloads where it was saved');
  const done=await g.ev(`(() => {let n=0;while(state.phase==='open'&&n++<90000){simStep(1.5);if(n%400===0)drawPeople();}return {phase:state.phase,carsLeft:cars.length};})()`);
  eq(done.phase,'report','the reloaded day plays to its report, cars driving out on fresh paths');
  eq(g.errors,[],'no page errors');
  await g.page.close();
  return `${noon.guests} guests in one shape; ${noon.parked} parked cars saved without paths`;
}
