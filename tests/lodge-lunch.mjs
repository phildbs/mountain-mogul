// Run the service logic without a renderer; Chromium coverage lives in scenario 98.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { lodgeLunchCases } from './lodge-lunch-cases.mjs';
const s = readFileSync(process.argv[2] || new URL('../index.html', import.meta.url), 'utf8');
const section = (a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)));
const code = `
const world = { buildings: [] }, state = { time: 720, phase: 'open', cash: 0 }, AGENT = 1;
let today = {};
const clamp = (v,a,b) => Math.max(a,Math.min(b,v)), lerp = (a,b,t) => a+(b-a)*t;
const distXZ = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const staffLevel = () => ({svc:1}), learningOpen = () => false;
const closeTime = () => 960, sessionEnd = () => 960, bldMode = () => 'open', lotCount = () => 1;
const bldById = id => world.buildings.find(B=>B.id===id);
const thought = () => {};
${section('const BTYPES = {', 'const BORDER =')}
${section('const bspec =', '// What a building costs')}
${section('const PRICE_DEFAULTS =', 'const PRICE_INFO =')}
state.prices = {...PRICE_DEFAULTS};
const isDecor = B => !!BTYPES[B.type].decor;
${section('function bldOpenNow(B)', '// A snapshot of today')}
${section('const POOL =', '/* ---------- Après-ski')}
${section('function startVisit(', '// The open building of one of these types')}
(${lodgeLunchCases.toString()})()`;
const result = vm.runInNewContext(code, {Math: Object.create(Math)}, {timeout:5000});
console.log('PASS lodge lunch:', JSON.stringify(result));
