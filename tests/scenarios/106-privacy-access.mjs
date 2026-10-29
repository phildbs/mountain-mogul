import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  for (const phone of [false,true]) {
    const g=await openGame(browser,url,phone?{width:390,height:844,hasTouch:true}:{});
    const entry=g.page.locator('#titlePrivacy'),r=await entry.boundingBox();
    assert(await entry.isVisible(),'privacy link visible before playing');
    assert(r && r.height>=44,'footer privacy link is easy to tap');
    eq(await g.ev(`$('title').lastElementChild === $('titlePrivacy').closest('.tfoot')`),true,'privacy link is in the bottom title-screen footer');
    eq(await entry.getAttribute('href'),'privacy.html','direct policy link');
    const openPolicy=async selector=>{
      const pending=g.page.waitForEvent('popup');
      if(phone)await g.page.locator(selector).tap();else await g.page.locator(selector).click();
      const p=await pending;await p.waitForLoadState('domcontentloaded');
      eq(await p.locator('h1').textContent(),'Mountain Mogul privacy policy','policy opens without sign-in');
      eq(await p.locator('script').count(),0,'policy has no game, analytics or sign-in scripts');
      assert(await p.locator('#data').isVisible(),'data practices available');
      const layout=await p.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
      assert(layout.scroll<=layout.w,'policy fits the viewport');
      eq(await p.locator('a.back').first().getAttribute('href'),'./','return link available');
      if(process.env.SHOTS==='1')await p.screenshot({path:`privacy-${phone?'phone':'desktop'}.png`,fullPage:true});
      await p.close();
    };
    await openPolicy('#titlePrivacy');
    assert(await entry.isVisible(),'game stays on title screen');
    await g.click('#startBtn');await g.wait(2200);
    await g.click('#badge');
    eq(await g.page.locator('#mPrivacy').getAttribute('rel'),'noopener','policy cannot control the game tab');
    const before=await g.ev('[state.day,state.cash,state.tool]');
    await openPolicy('#mPrivacy');
    eq(await g.ev('[state.day,state.cash,state.tool]'),before,'reading policy preserves the current game');
    eq(g.errors,[],'no page errors');await g.page.close();
  }
}
