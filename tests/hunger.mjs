// Run the service logic without a renderer; Chromium coverage lives in scenario 98.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { hungerCases } from './hunger-cases.mjs';
const s = readFileSync(process.argv[2] || new URL('../index.html', import.meta.url), 'utf8');
const section = (a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)));
const code = `
const world = { buildings: [], trails: [], lifts: [] }, state = { time: 720, phase: 'open', cash: 0 }, AGENT = 1;
let today = {};
const clamp = (v,a,b) => Math.max(a,Math.min(b,v)), lerp = (a,b,t) => a+(b-a)*t;
const distXZ = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const staffLevel = () => ({svc:1}), learningOpen = () => false;
let runOps = {bld:{}}; const closeTime = () => 960, sessionEnd = () => 960, bldMode = B => runOps.bld[B.id] || 'open', lotCount = () => 1, baseOf = () => 0;
const LUNCH_OPEN=660, LUNCH_CLOSE=840, PACE=4, WALK=0.13/PACE, SKI_SPEED=[0.38/PACE], SLOW={speed:0.7};
const LIFT_TYPES={double:{speed:2}}, liftMode = () => 'full', isVillage = L => L.type==='village';
const canLoad = L => L.open && !L.windHold, runnable = T => T.open && T.snowOk !== false, trailSign = T => T.sign;
const liftWait = L => L.queue.length, liftById = id => world.lifts.find(L=>L.id===id), trailById = id => world.trails.find(T=>T.id===id);

const bldById = id => world.buildings.find(B=>B.id===id);
const thought = () => {};
${section('const BTYPES = {', 'const BORDER =')}
${section('const bspec =', '// What a building costs')}
${section('const PRICE_DEFAULTS =', 'const PRICE_INFO =')}
state.prices = {...PRICE_DEFAULTS};
const isDecor = B => !!BTYPES[B.type].decor;
${section('function bldOpenNow(B)', '// A snapshot of today')}
${section('function newToday()', 'function canLoad(')}
${section('function updateNeeds(', '/* ---------- Ski patrol')}
${section('function hungryNote(', '// Why the day went the way')}
${section('const POOL =', '/* ---------- Après-ski')}
${section('function startVisit(', '// The open building of one of these types')}
(${hungerCases.toString()})()`;
const result = vm.runInNewContext(code, {Math: Object.create(Math)}, {timeout:5000});
console.log('PASS hunger reliability:', JSON.stringify(result));
