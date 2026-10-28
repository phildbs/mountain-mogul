import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function({browser,url}) {
 const g=await openGame(browser,url);
 await g.click('#startBtn'); await g.ev(SETUPS.juniperStarter);
 const cancel=await g.ev(`(()=>{const t=realTrails()[0];const before=JSON.stringify(saveData(false));startTrailMove(t);draft.pts[0].x+=3;cancelTrailMove();return before===JSON.stringify(saveData(false));})()`);
 eq(cancel,true,'cancel leaves saved resort untouched');
 const r=await g.ev(`(()=>{state.cash=1e9;const t=realTrails()[0], id=t.id,name=t.name,old=t.pts.map(p=>({...p}));t.open=false;t.sign=2;t.sm=true;t.lit=true;t.machine=12;
 startTrailMove(t);let info;for(const dx of [.5,-.5,1,-1]){draft.pts=old.map(p=>({...p}));const i=Math.floor(old.length/2);draft.pts[i].x+=dx;info=evalTrailMove(t,draft.pts,draft.width,false);if(!info.an.problems.length)break;}
 if(info.an.problems.length)return {problems:info.an.problems};draft.info=info;const cash=state.cash;moveTrailDraft();const a=realTrails().find(o=>o.id===id);const out={id:a.id===id,name:a.name===name,changed:JSON.stringify(a.pts)!==JSON.stringify(old),flags:!a.open&&a.sign===2&&a.sm&&a.lit,snow:a.machine===0,charge:cash-state.cash===info.cost};const saved=JSON.parse(JSON.stringify(saveData(false)));applySave(saved);out.saved=JSON.stringify(realTrails().find(o=>o.id===id).pts)===JSON.stringify(a.pts);return out;})()`);
 assert(!r.problems,JSON.stringify(r));for(const [k,v] of Object.entries(r))eq(v,true,k);
 eq(g.errors,[],'no runtime errors');await g.page.close();
}
