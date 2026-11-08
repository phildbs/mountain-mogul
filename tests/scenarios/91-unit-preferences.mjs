import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  for (const width of [1280, 390]) {
    const g = await openGame(browser, url, {width, height:640});
    await g.click('#startBtn'); await g.wait(300);
    await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
    await g.ev(`state.welcomed=true; $('hint').hidden=true; todayWx(); select({kind:'trail',obj:realTrails()[0]});
      window.__unitBefore=JSON.stringify({world:serializeWorld(),cash:state.cash,wx:state.wx,prices:state.prices,ops:opsState(),snow:Array.from(NS)});`);
    const values=()=>g.ev(`[fmtFt(1000),inch(12),tempF(32),tempF(68),fmtWind(10),fmtAcres(10)]`);
    eq(await values(), ['1,000 ft','12″','32°F','68°F','10 mph','10 acres'], 'existing defaults are imperial and Fahrenheit');
    await g.page.locator('#badge').click();
    await g.page.locator('#mUnits').click();
    eq(await values(), ['305 m','30 cm','32°F','68°F','16 km/h','4.0 ha'], 'metric measurements do not change Fahrenheit');
    assert((await g.ev(`$('sheet').textContent`)).includes(' m'), 'the open trail panel updates immediately');
    await g.page.locator('#mTemp').click();
    eq(await values(), ['305 m','30 cm','0°C','20°C','16 km/h','4.0 ha'], 'Celsius has correct freezing and room-temperature conversions');
    const weather=await g.ev('weatherSheet()');
    assert(weather.includes('km/h') && weather.includes(' cm') && weather.includes('°C') && !weather.includes('°F'), 'forecast and snowmaking help consistently use chosen units');
    eq(await g.ev(`tempF(-40)`), '-40°C', 'negative temperatures convert correctly');
    await g.page.locator('#mUnits').click();
    eq(await values(), ['1,000 ft','12″','0°C','20°C','10 mph','10 acres'], 'imperial measurements can use Celsius');
    await g.page.locator('#mTemp').click();
    eq(await values(), ['1,000 ft','12″','32°F','68°F','10 mph','10 acres'], 'both toggles round-trip without changing values');
    assert(await g.ev(`window.__unitBefore===JSON.stringify({world:serializeWorld(),cash:state.cash,wx:state.wx,prices:state.prices,ops:opsState(),snow:Array.from(NS)})`), 'display choices do not change physical values, weather, cash or operating plans');
    // clock and money: display only
    const clk=()=>g.ev(`[clockLabel(480),clockLabel(960+5),clockLabel(1500),hourLabel(1320),money(130748),shortMoney(250000),nightLabel(1200)]`);
    eq(await clk(), ['8:00 AM','4:05 PM','1:00 AM','10 PM','$130,748','$250k','Until 8'], '12-hour clock and dollars by default');
    await g.page.locator('#mClock').click(); await g.page.locator('#mEuro').click();
    eq(await clk(), ['08:00','16:05','01:00','22:00','€130,748','€250k','Until 20:00'], '24-hour clock and euros');
    assert((await g.ev(`$('cash').textContent`)).startsWith('€'), 'the cash readout switches at once');
    assert(!/ (AM|PM)\b/.test(await g.ev(`(P=>nightOpsHtml(P)+apresOpsHtml(P))({...Object.values(opsState().plans)[0],apres:'on',lastCall:1500,night:1260})`)), 'evening plans use the 24-hour clock');
    await g.page.locator('#mClock').click(); await g.page.locator('#mEuro').click();
    eq(await clk(), ['8:00 AM','4:05 PM','1:00 AM','10 PM','$130,748','$250k','Until 8'], 'clock and money round-trip');
    await g.page.locator('#mUnits').click(); await g.page.locator('#mTemp').click();
    eq(await g.ev(`[$('mUnits').getAttribute('aria-checked'),$('mTemp').getAttribute('aria-checked')]`), ['true','true'], 'toggles expose their state accessibly');
    const fits=await g.ev(`(() => {const r=$('menu').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;})()`);
    assert(fits, `menu fits the ${width}px viewport and scrolls as needed`);
    await g.ev('saveNow()'); await g.page.reload(); await g.reloaded();
    eq(await g.ev('units'), {metric:true,celsius:true,clock24:false,euro:false}, 'preferences survive reload');
    await g.click('#mTitle'); await g.click('[data-slot=new]'); await g.click('[data-slot=pick][data-mt=raven]'); await g.reloaded();
    eq(await g.ev('[MOUNTAIN.id,units.metric,units.celsius]'), ['raven',true,true], 'the same preferences follow the player to another resort');
    await g.ev(`localStorage.setItem('mm.units','broken-json')`); await g.page.reload(); await g.reloaded();
    eq(await g.ev('units'), {metric:false,celsius:false,clock24:false,euro:false}, 'invalid stored preferences fall back safely');
    const blocked=await g.ev(`(() => {const old=Storage.prototype.setItem;try {Storage.prototype.setItem=()=>{throw Error('blocked')};setUnits('metric',true);setUnits('celsius',true);return [inch(12),tempF(32)];}finally {Storage.prototype.setItem=old;}})()`);
    eq(blocked,['30 cm','0°C'],'toggles still work when saving preferences is blocked');
    eq(g.errors, [], 'no page errors');
    await g.page.close();
  }
}
