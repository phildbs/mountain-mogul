import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g=await openGame(browser,url);await g.click('#startBtn');await g.wait(300);
  await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  const ids=await g.ev(`(() => {
    state.cash=1e9;const B=world.buildings[0],L=world.lifts[0];let rental=null,second=null;
    for(let dx=-20;dx<=20&&!rental;dx+=4)for(let dz=-12;dz<=16&&!rental;dz+=4){const x=B.x+dx,z=B.z+dz,v=evalBuilding('rental',x,z,0);if(!v.problems.length)rental=commitBuilding(v,'rental',x,z,0);}
    for(const dx of [-18,18,-12,12]){const v=evalLift({x:L.a.x+dx,z:L.a.z},{x:L.b.x+dx,z:L.b.z},'double');if(!v.problems.length){second=commitLift(v,'double');break;}}
    if(!rental||!second)throw Error('Need real second lift and rental building');computeNetwork();syncLabels();
    opsEdit='quiet';select({kind:'bld',obj:B});return {lodge:B.id,rental:rental.id,lift:L.id,second:second.id};
  })()`);
  eq(await g.ev(`$('sheet').querySelectorAll('[data-action=opsBld]').length`),9,'eatery card has three choices for each of three plans');
  await g.click('[data-action=opsBld][data-plan=weekday][data-v=closed]');
  await g.click('[data-action=opsBld][data-plan=quiet][data-v=lunch]');
  eq(await g.ev(`[bldModeIn(opsState().plans.weekday,bldById(${ids.lodge})),bldModeIn(opsState().plans.quiet,bldById(${ids.lodge})),opsEdit]`),['closed','lunch','quiet'],'card edits exact plans without changing the Operations tab selection');
  await g.ev(`openManage('ops');opsEdit='weekday';opsFold.blds=true;renderSheet()`);
  eq(await g.ev(`$('sheet').querySelector('[data-action=opsBld][data-id="${ids.lodge}"][data-v=closed]').getAttribute('aria-pressed')`),'true','Operations reflects the card change');
  await g.click(`[data-action=opsBld][data-id="${ids.lodge}"][data-v=open]`);
  await g.ev(`select({kind:'bld',obj:bldById(${ids.lodge})})`);
  eq(await g.ev(`$('sheet').querySelector('[data-plan=weekday][data-v=open]').getAttribute('aria-pressed')`),'true','Operations edits reflect back in the card');
  await g.ev(`select({kind:'bld',obj:bldById(${ids.rental})})`);
  eq(await g.ev(`[$('sheet').querySelectorAll('[data-action=opsBld]').length,$('sheet').querySelectorAll('[data-v=lunch]').length,opsAction('opsBld',{dataset:{id:'${ids.rental}',plan:'quiet',v:'lunch'}})]`),[6,0,false],'non-eateries have Open/Closed only and reject invalid lunch mode');
  await g.ev(`select({kind:'lift',obj:liftById(${ids.lift})})`);
  eq(await g.ev(`[$('sheet').querySelectorAll('[data-action=opsLift]').length,$('sheet').querySelectorAll('[data-action=liftColor]').length]`),[9,8],'lift card has three modes per plan and eight colors');
  await g.click('[data-action=opsLift][data-plan=weekday][data-v=slow]');
  await g.click('[data-action=opsLift][data-plan=quiet][data-v=off]');
  eq(await g.ev(`[liftModeIn(opsState().plans.weekday,liftById(${ids.lift})),liftModeIn(opsState().plans.quiet,liftById(${ids.lift}))]`),['slow','off'],'lift card plans saved independently');
  eq(await g.ev(`(() => {const sv=JSON.parse(JSON.stringify(saveData(false)));applySave(sv);return [liftModeIn(opsState().plans.weekday,liftById(${ids.lift})),liftModeIn(opsState().plans.quiet,liftById(${ids.lift})),bldModeIn(opsState().plans.quiet,bldById(${ids.lodge}))];})()`),['slow','off','lunch'],'card changes survive save/load');
  // During an open day the plan snapshot, queues and occupied chairs must remain untouched.
  await g.ev(`(() => {for(const P of Object.values(opsState().plans)){P.lifts={};P.bld={};}openDay();state.speed=0;select({kind:'bld',obj:bldById(${ids.lodge})});})()`);
  const kind=await g.ev(`runOps.kind`);
  await g.click(`[data-action=opsBld][data-plan=${kind}][data-v=closed]`);
  eq(await g.ev(`[bldMode(bldById(${ids.lodge})),bldModeIn(opsState().plans['${kind}'],bldById(${ids.lodge}))]`),['open','closed'],'building plan change applies next day, not mid-service');
  await g.ev(`select({kind:'lift',obj:liftById(${ids.lift})})`);
  await g.click(`[data-action=opsLift][data-plan=${kind}][data-v=off]`);
  eq(await g.ev(`[liftMode(liftById(${ids.lift})),liftModeIn(opsState().plans['${kind}'],liftById(${ids.lift})),canLoad(liftById(${ids.lift}))]`),['full','off',true],'lift plan change does not stop current operation');
  const color=await g.ev(`(() => {
    const L=liftById(${ids.lift}),M=liftById(${ids.second});setLiftColor(M,L.color);
    const old=L.color,mat=accentMat(old),target=LIFT_COLORS.find(c=>c!==old),group=L.group,chairs=L.chairs,queue=L.queue,riders=L.riders,phase=L.phase;
    const p=makeGuest({id:null},L.a.x,L.a.z);p.st='queue';p.L=L;guests.push(p);gById.set(p.id,p);queue.push(p);
    const r=makeGuest({id:null},L.b.x,L.b.z);Object.assign(r,{st:'ride',L,chair:0,seat:0});guests.push(r);gById.set(r.id,r);riders[0].push(r.id);
    document.querySelector('[data-action=liftColor][data-v="'+target+'"]').click();
    let oldRefs=0,newRefs=0;L.group.traverse(m=>{if(m.material===mat)oldRefs++;if(m.material===accentMat(target))newRefs++;});
    const unchanged=group===L.group&&chairs===L.chairs&&queue===L.queue&&riders===L.riders&&L.phase===phase&&queue.includes(p)&&riders[0].includes(r.id);
    return {color:L.color,target,chair:L.chairs.material.color.getHex(),oldRefs,newRefs,unchanged,other:M.color===old&&M.chairs.material.color.getHex()===old&&mat.color.getHex()===old};
  })()`);
  assert(color.color===color.target&&color.chair===color.target&&color.oldRefs===0&&color.newRefs>0&&color.unchanged&&color.other,`recolors only this lift without interrupting guests: ${JSON.stringify(color)}`);
  eq(await g.ev(`(() => {const sv=JSON.parse(JSON.stringify(saveData(true)));applySave(sv);const L=liftById(${ids.lift});return [L.color,L.chairs.material.color.getHex(),L.queue.length,L.riders[0].length];})()`),[color.target,color.target,1,1],'color and occupied lift state survive mid-day reload');
  eq(await g.ev(`(() => {const prev=visiting,L=liftById(${ids.lift}),before=L.color;visiting=true;const hidden=!liftSheet(L).includes('data-action="liftColor"')&&!bldSheet(bldById(${ids.lodge})).includes('data-action="opsBld"');setLiftColor(L,LIFT_COLORS.find(c=>c!==before));const blocked=opsAction('opsLift',{dataset:{id:String(L.id),plan:'weekday',v:'full'}})===false;visiting=prev;return [hidden,L.color===before,blocked];})()`),[true,true,true],'visited resorts stay read-only');
  eq(g.errors,[],'no page errors');await g.page.close();
}
