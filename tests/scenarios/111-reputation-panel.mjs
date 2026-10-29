import '../reputation-tracking.mjs';
import {openGame,eq,assert,SETUPS} from '../harness.mjs';
export default async function({browser,url}) {
  const g=await openGame(browser,url);await g.click('#startBtn');await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  await g.click('#manage [data-m=biz]');await g.click('#bizFly [data-m=reputation]');
  eq(await g.ev('selected.obj'),'reputation','Business submenu opens reputation');
  assert((await g.ev(`$('sheet').innerText`)).includes('Current reputation'),'current score visible before first day');
  await g.ev(`(() => {
    state.cash=1e8;const base=world.buildings[0];let B;
    for(let dz=-12;dz<=16&&!B;dz+=4)for(let dx=-20;dx<=20&&!B;dx+=4){const x=base.x+dx,z=base.z+dz,i=evalBuilding('patrol',x,z,0);if(!i.problems.length)B=commitBuilding(i,'patrol',x,z,0);}
    if(!B)throw Error('No patrol site');
    state.reputation=1;openDay();state.speed=0;
    Object.assign(today,{satN:1,satSum:96,injuries:100,unhelped:20,rescues:[],leftLines:0});
    endDay();
  })()`);
  const result=await g.ev(`({rep:state.reputation,day:state.lastReport.repDay,log:state.repLog})`);
  eq(result.day.changes.map(r=>r.reason),['Guest satisfaction','Missed rescues'],'actual settlement records satisfaction and rescue causes');
  assert(Math.abs(result.day.changes.reduce((n,r)=>n+r.change,0)-(result.day.end-result.day.start))<1e-10,'settlement reasons reconcile exactly');
  eq(result.day.end,result.rep,'report end matches current reputation');
  await g.ev(`$('report').hidden=true;state.phase='closed';state.cash=-1000;coverOverdraft();openManage('reputation')`);
  eq(await g.ev(`state.repLog.at(-1).reason`),'Emergency bank borrowing','overnight borrowing is recorded separately');
  const snapshot=await g.ev(`({log:state.repLog,day:state.lastReport.repDay,rep:state.reputation})`);
  await g.ev('saveNow()');await g.page.reload();await g.reloaded();await g.click('#startBtn');
  eq(await g.ev(`({log:state.repLog,day:state.lastReport.repDay,rep:state.reputation})`),snapshot,'save/reload preserves scores and causes without duplicate recording');
  await g.page.setViewportSize({width:390,height:844});await g.ev(`openManage('more')`);await g.click('.mtile[data-v=reputation]');
  eq(await g.ev('selected.obj'),'reputation','phone More tile opens same panel');
  assert(await g.ev(`document.querySelector('.rep-trend').getBoundingClientRect().width <= $('sheet').clientWidth`),'trend fits phone panel');
  const legacy=await g.ev(`(() => {const s=JSON.parse(JSON.stringify(saveData(false)));delete s.clock.repLog;delete s.clock.lastReport.repDay;for(const r of s.clock.history||[])delete r.repDay;applySave(s);openManage('reputation');return {rep:state.reputation,log:state.repLog,text:$('sheet').innerText};})()`);
  eq(legacy.rep,snapshot.rep,'older save score unchanged');eq(legacy.log,null,'older saves start with no invented ledger');assert(legacy.text.includes('no recorded breakdown'),'older report limitation explained');
  await g.ev(`visiting=true;openManage('reputation')`);eq(await g.ev('selected.obj'),'reputation','visiting reputation panel is read-only');
  eq(g.errors,[],'no page errors');await g.page.close();
}
