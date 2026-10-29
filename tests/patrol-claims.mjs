// Test actual claim functions independently of graphics and with controlled chance draws.
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const src=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=name=>{const a=src.indexOf('function '+name+'(');assert(a>=0,name+' exists');return src.slice(a,src.indexOf('\n}',a)+2);};
let draws=0;const random=Object.create(Math);random.random=()=>{draws++;return 0;};
const ctx={today:{rescues:[],unhelped:0,glades:{}},state:{time:600},world:{buildings:[{id:1,type:'patrol'}]},Math:random,
 hasBld:t=>ctx.world.buildings.some(B=>B.type===t),clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),money:n=>'$'+n};
const api=runInNewContext('const RESCUE_GRACE=30;\n'+['noteRescue','rescueClaimOdds','patrolClaimReview','opsNotes'].map(fn).join('\n')+'\n({noteRescue,rescueClaimOdds,patrolClaimReview,opsNotes})',ctx);
const ops={bld:{1:'open'}},reset=()=>{ctx.today={rescues:[],unhelped:0,glades:{}};draws=0;};
for(const wait of [0,5,7,29,30])for(const severe of [false,true])for(const ab of [0,1,2,3]){
 reset();const g={hurtAt:600-wait,severe,ab};api.noteRescue(g,false);api.noteRescue(g,false,100);
 ctx.today.glades={1:{severe:severe?1:0,unhelped:0}};
 const r=api.patrolClaimReview(ops);
 assert.equal(r.timely,1);assert.equal(r.delayedClaims+r.unhelpedClaims,0);assert.equal(draws,0,'prompt injury never even rolls for a claim');
 assert.equal(ctx.today.rescues.length,1,'one record per injury');
}
assert.equal(api.rescueClaimOdds(30,false,.12),0);
const odds=[31,40,50,70,100].map(t=>api.rescueClaimOdds(t,false,.12));
assert(odds.every((p,i)=>p>0&&p<=.12&&(!i||p>=odds[i-1])),'risk grows gradually after grace and stays capped');
reset();api.noteRescue({hurtAt:530},false);api.noteRescue({hurtAt:525},true);ctx.today.unhelped=1;ctx.today.glades={1:{severe:50,unhelped:1}};
let r=api.patrolClaimReview(ops);assert.equal(r.delayedClaims,1);assert.equal(r.unhelpedClaims,1);assert.equal(draws,2,'no extra roll for severity, glades or the same missed rescue');
const report={ops:{claims:2,lots:{away:0},blds:[],lifts:[],letdown:0},exp:{claims:18000},complaints:{},rescueClaims:r};
const html=api.opsNotes(report).join(' ');assert(html.includes('without patrol help')&&html.includes('longer than 30 minutes'));assert(!html.includes('short-handed'));
assert(api.opsNotes({...report,rescueClaims:undefined}).join(' ').includes('older report'),'old reports do not invent a reason');
reset();delete ctx.today.rescues;ctx.today.unhelped=2;r=api.patrolClaimReview(ops);assert.equal(r.unhelpedClaims,2);assert.equal(r.delayed,0,'old saves do not infer delays from an average');
ctx.today.claimExemptMissed=1;assert.equal(api.patrolClaimReview(ops).unhelpedClaims,1,'a restarted tow cannot add another claim');
ctx.world.buildings=[];assert.equal(api.patrolClaimReview(ops).unhelpedClaims,0,'existing pre-patrol starter protection remains');
ctx.world.buildings=[{id:1,type:'patrol'}];reset();api.noteRescue({hurtAt:530},false);
random.random=()=>.08;assert.equal(api.patrolClaimReview(ops).delayedClaims,1);
ctx.world.buildings.push({id:2,type:'clinic'});assert.equal(api.patrolClaimReview(ops).delayedClaims,0,'existing clinic mitigation still applies');
console.log('PASS 40 prompt-rescue combinations, delayed/missed outcomes, one claim per injury, reasons, old-save defaults and clinic mitigation');
