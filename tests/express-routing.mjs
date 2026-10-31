// Exercise the game's network and route functions without graphics or a live database.
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const src=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=name=>{const a=src.indexOf('function '+name+'(');if(a<0)return '';return src.slice(a,src.indexOf('\n}',a)+2);};
const types=runInNewContext(src.slice(src.indexOf('const LIFT_TYPES ='),src.indexOf('const isVillage ='))+'\nLIFT_TYPES');
const noop=()=>{};
const world={lifts:[],trails:[],buildings:[],areas:[]};
const state={started:false,phase:'open',time:600};
const ctx={world,state,STATION_R:6,TRANSFER_R:22,PACE:4,SLOW:{speed:0.65},
 LIFT_TYPES:types,
 distXZ:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),trueY:()=>0,inProperty:()=>true,lerp:(a,b,f)=>a+(b-a)*f,
 isVillage:()=>false,isBase:p=>p.z>50,TRAIL_WIDTHS:{medium:{hw:2}},trailHW:t=>2,sampleHW:()=>2,
 syncAreaLines:noop,rebuildPads:noop,surfaceIndex:noop,refreshTrailMesh:noop,rebuildGuns:noop,rebuildLights:noop,
 offers:()=>[],liftById:id=>world.lifts.find(L=>L.id===id),
 canLoad:L=>L.open&&!L.windHold,runnable:t=>t.open!==false,
 liftWait:L=>(L.queue.length+L.incoming)/10,liftMode:L=>L.mode||'normal',
 todayWx:()=>({hi:35}),trailFit:t=>t.fit,lotCount:()=>1,baseOf:()=>0,crossCost:()=>Infinity,cars:[],stalls:[],
};
const funcs=['liftTransferMode','liftTrailMode','trailNear','dryEnd','connAt','computeNetwork','vTrail','vRest','vEnd','vLift','vBase','cacheHubs','refreshHubEdges','hubFlood','hubDistance','hubChoices','vHub'];
// Expressions shared with the game (the prior build has no ride-time helper).
const transfer=src.match(/^const liftTransferCost = .*;$/m)[0];
const ride=src.match(/^const liftRideMinutes = .*;$/m)?.[0]||'';
const hubShared=['cellKey','isHub','hubAt','HUB_STEPS'].map(name=>src.match(new RegExp('^const '+name+' = .*;$','m'))[0]).join('\n');
const api=runInNewContext(hubShared+'\n'+transfer+'\n'+ride+'\n'+funcs.map(fn).join('\n')+'\n({computeNetwork,vLift,vEnd'+(fn('liftTrailMode')?',liftTrailMode':'')+(ride?',liftRideMinutes':'')+'})',ctx);
const lift=(id,type,a,b,len)=>({id,type,a,b,upLen:len,open:true,windHold:false,queue:[],incoming:0,stats:{cap:1200},departing:[],transfers:[]});
const lower=lift(1,'double',{x:0,z:60},{x:0,z:0},60),upper=lift(2,'double',{x:10,z:0},{x:10,z:-30},30),express=lift(3,'hsq',{x:8,z:60},{x:15,z:-30},90);
const trail=(id,samples,fit)=>({id,samples,fit,width:'medium',open:true,an:{rating:1},branches:[]});
const summit=trail(10,[{x:13,z:-28},{x:18,z:20},{x:3,z:60}],6),mid=trail(11,[{x:2,z:2},{x:0,z:30},{x:-3,z:60}],1);
world.lifts.push(lower,upper,express);world.trails.push(summit,mid);api.computeNetwork();
const g={x:0,z:60,ab:2,pref:2,seen:{},seenLift:{1:true,2:true,3:true},explore:0,leaving:false,qh:0.7};
console.log('Shared summit access:',{canonical:summit.from.obj.id,upper:upper.departing.includes(summit),express:express.departing.includes(summit)});
assert(upper.departing.includes(summit)&&express.departing.includes(summit),'nearby summit lifts both serve the same trail entrance');
const values=()=>({direct:api.vLift(express,g,0,new Map()),transfer:api.vLift(lower,g,0,new Map())});
const initial=values();console.log('Uncongested routes:',initial);assert(initial.direct>initial.transfer,'faster direct summit route beats two slow lifts');
const oldRide=express.upLen;express.upLen*=2;
assert(api.vLift(express,g,0,new Map())<initial.direct,'longer ride lowers route value');express.upLen=oldRide;
const regular=api.liftRideMinutes(express);express.mode='slow';assert(api.liftRideMinutes(express)>regular,'slow operating plan increases ride estimate');express.mode='normal';
express.queue=Array(500).fill(null);const busy=values();assert(busy.transfer>busy.direct,'long express queue can make the transfer route better');express.queue=[];
// Returning to the base must compare base lifts even if a trail endpoint names the old lift.
const viaOld=api.vEnd(summit,g,0,new Map()),viaBase=api.vEnd({...summit,to:{kind:'base'}},g,0,new Map());
assert.equal(viaOld,viaBase,'base endpoint does not force the originally linked lift');
upper.open=false;lower.open=false;api.computeNetwork();assert(summit.reachable&&express.returns,'shared trail remains reachable through direct lift');
const oldTop=express.b;express.b={x:30,z:-30};api.computeNetwork();assert(!express.departing.includes(summit),'distant summit cannot borrow a trail');express.b=oldTop;
// A steep uphill connection is not added merely because two trailheads look close on a map.
ctx.trueY=(x,z)=>x>14&&z<0?-10:0;api.computeNetwork();assert(!express.departing.includes(summit),'unsafe uphill summit connection is excluded');ctx.trueY=()=>0;
world.lifts.reverse();api.computeNetwork();assert(upper.departing.includes(summit)&&express.departing.includes(summit),'shared summit access does not depend on construction order');
console.log('PASS shared summit entrances, ride time, congestion, operating speed, base reconsideration, reachability and geometry limits');
