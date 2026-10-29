// Check the real footprint helpers independently of WebGL: every corner, every degree, every building size.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
const src=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const types=src.slice(src.indexOf('const BTYPES = {'),src.indexOf('const BORDER ='));
const dims=src.slice(src.indexOf('function bDims('),src.indexOf('function lotBoxes('));
const {BTYPES,bDims,bAABB,toWorld}=runInNewContext(types+`\n${dims}\n({BTYPES,bDims,bAABB,toWorld})`);
let count=0;
for(const [type,t] of Object.entries(BTYPES))for(const [tier,s] of (t.tiers||[t]).entries())for(let deg=0;deg<360;deg++) {
  const b={type,tier,x:13,z:-7,rot:deg/90},bb=bAABB(type,tier,b.x,b.z,b.rot);
  for(const x of [-1,1])for(const z of [-1,1]){
    const p=toWorld(b,x*s.w/2,z*s.d/2);
    assert(p.x>=bb.x0-1e-10&&p.x<=bb.x1+1e-10&&p.z>=bb.z0-1e-10&&p.z<=bb.z1+1e-10,`${type} ${tier} ${deg} corner outside footprint`);
  }
  if(deg%90===0){const d=bDims(type,tier,deg/90);assert.equal(d.w,deg%180?s.d:s.w);assert.equal(d.d,deg%180?s.w:s.d);}
  count++;
}
console.log(`PASS ${count} building/size/angle combinations: enclosed corners and unchanged cardinal footprints`);
// Check button meaning against the actual world transform, not just numeric increments.
const controls = src.slice(src.indexOf('function rotationArrow('), src.indexOf('function setDraftDegrees('));
const html = runInNewContext(controls+'\nrotationControls()', { visiting:false, draft:{btype:'bench',rot:37/90}, canTurn:()=>true });
for (const [direction,sign] of [['left',1],['right',-1]]) {
  const button = html.match(new RegExp('<button[^>]*data-d="(-?1)"[^>]*aria-label="Rotate 90 degrees '+direction+'"[^>]*>([\\s\\S]*?)<\\/button>'));
  assert(button, `${direction} control has a clear accessible label`);
  const delta = Number(button[1]);assert.equal(delta,sign,`${direction} button increment`);
  assert(button[2].includes(direction==='left'?'Left 90°':'Right 90°'), 'visible direction label');
  for (const deg of [0,37,90,180,270,350]) {
    const a=toWorld({x:0,z:0,rot:deg/90},1,0),b=toWorld({x:0,z:0,rot:deg/90+delta},1,0);
    const cross=a.x*b.z-a.z*b.x;
    assert(Math.abs(cross+sign)<1e-9,`${direction} is ${direction==='left'?'counterclockwise':'clockwise'} from ${deg}° viewed above`);
  }
}
console.log('PASS labeled rotation buttons match actual left/right world rotation at six starting angles');
