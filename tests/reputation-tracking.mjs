// Track actual clamped changes without changing the underlying reputation rules.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
const src=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=name=>{const a=src.indexOf('function '+name+'(');assert(a>=0);return src.slice(a,src.indexOf('\n}',a)+2);};
const ctx={state:{reputation:1,repLog:null,day:10,season:2,phase:'open',history:null,lastReport:null},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),dateLabel:d=>'Day '+d,esc:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;')};
const constants=['repPoints','repDelta','repWordOf'].map(n=>src.match(new RegExp('const '+n+' = [^\\n]+'))[0]).join('\n');
const api=runInNewContext(constants+'\n'+['changeReputation','reputationRows','reputationTrend','reputationPanel'].map(fn).join('\n')+'\n({changeReputation,reputationRows,reputationTrend,reputationPanel})',ctx);
const changes=[];
for(const [delta,reason]of [[.03,'Guest satisfaction'],[-.01,'Missed rescues'],[-.02,'Guests leaving lift lines'],[-.015,'Late-night rowdiness'],[.02,'Successful event']]){
 const before=ctx.state.reputation;api.changeReputation(delta,reason,changes);assert.equal(ctx.state.reputation,Math.max(.5,Math.min(1.5,before+delta)),'existing balance unchanged');
}
assert(Math.abs(changes.reduce((n,r)=>n+r.change,0)-(ctx.state.reputation-1))<1e-12,'breakdown reconciles with net change');
ctx.state.reputation=1.49;api.changeReputation(.04,'Guest satisfaction');assert(Math.abs(ctx.state.repLog.at(-1).change-.01)<1e-12);assert(api.reputationRows([ctx.state.repLog.at(-1)]).includes('150-point maximum'));
ctx.state.reputation=.5;api.changeReputation(-.03,'Emergency bank borrowing');assert.equal(ctx.state.repLog.at(-1).change,0);assert(api.reputationRows([ctx.state.repLog.at(-1)]).includes('50-point minimum'));
for(let i=0;i<130;i++)api.changeReputation(.001,'Guest satisfaction');assert.equal(ctx.state.repLog.length,120,'ledger bounded for saves');
const legacy=api.reputationPanel();assert(legacy.includes('No changes recorded')===false);assert(!legacy.includes('NaN'));
ctx.state.repLog=null;ctx.state.lastReport={rep:.85,when:'Old day',day:4};ctx.state.history=[ctx.state.lastReport];
const old=api.reputationPanel();assert(old.includes('no recorded breakdown')&&old.includes('85.00'),'old scores retained without inventing causes');
assert(api.reputationTrend([]).includes('Finish an operating day'));
assert(!/NaN|Infinity/.test(api.reputationTrend([{rep:1,when:'First',day:1}])),'single-point chart stays finite');
assert(api.reputationTrend([{rep:1,when:'<script>',day:1}]).includes('&lt;script&gt;'),'chart labels escaped');
console.log('PASS actual changes, bounds, reconciliation, bounded ledger and legacy/single-day history');
