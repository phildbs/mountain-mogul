import { openGame, assert, eq, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  for (const width of [1280,390]) {
    const g=await openGame(browser,url,{width,height:844});
    await g.ev('window.__mmCapturePhotos=true');
    await g.click('#startBtn'); await g.wait(800);
    await g.ev(SETUPS.juniperStarter);
    await g.ev(`select(null); state.welcomed=true; $('hint').hidden=true; saveNow(); $('mTitle').onclick();`);
    await g.page.waitForFunction(()=>window.__dbg("!CLOUD.uploading && (CLOUD.own || []).some(r=>r.id===slots.active)"));
    const photo=await g.ev('activeSlot().photo');
    assert(photo?.startsWith('data:image/jpeg;base64,'),'title card captures actual mountain scene');
    assert(photo.length<120000,'photo has a bounded save size');
    await g.page.locator('.scard.on img').evaluate(img=>img.decode());
    const content=await g.page.locator('.scard.on img').evaluate(img=>{
      const c=document.createElement('canvas');c.width=72;c.height=36;
      const ctx=c.getContext('2d');ctx.drawImage(img,0,0,72,36);
      const px=ctx.getImageData(0,0,72,36).data,colors=new Set();let dark=0;
      for(let i=0;i<px.length;i+=4){colors.add(`${px[i]},${px[i+1]},${px[i+2]}`);if(px[i]<150&&px[i+1]<170&&px[i+2]<190)dark++;}
      return [img.naturalWidth,img.naturalHeight,colors.size>60,dark>20];
    });
    eq(content,[720,360,true,true],'JPEG contains mountain detail instead of a blank canvas or sky');
    eq(await g.ev('saveData(false).photo'),photo,'snapshot is included in local and cloud save data');
    await g.ev(`CLOUD.lastUp=0; cloudSave(false)`);
    const stored=await g.ev(`JSON.parse(localStorage.getItem('FAKE_DB')).rows.find(r=>r.id===slots.active).save.photo`);
    eq(stored,photo,'online save includes the captured photo');
    await g.ev('loadMine()');
    eq(await g.ev(`CLOUD.own.find(r=>r.id===slots.active).photo`),photo,'own cloud list retrieves only the photo JSON field');
    // Camera capture must not move the real game or keep an offscreen render target bound.
    const fixed=await g.ev(`(() => { const before=JSON.stringify([cam.target.toArray(),cam.az,cam.viewH,camera.position.toArray(),camera.projectionMatrix.elements,renderer.getSize(new THREE.Vector2()).toArray()]); const b=brushMesh.visible,d=draftGroup.visible;brushMesh.visible=true;draftGroup.visible=true;const image=captureResortPhoto();const after=JSON.stringify([cam.target.toArray(),cam.az,cam.viewH,camera.position.toArray(),camera.projectionMatrix.elements,renderer.getSize(new THREE.Vector2()).toArray()]);const restored=brushMesh.visible&&draftGroup.visible;brushMesh.visible=b;draftGroup.visible=d;return [before===after,renderer.getRenderTarget()===null,restored,validResortPhoto(image)]; })()`);
    eq(fixed,[true,true,true,true],'photo capture restores renderer, camera and tool previews');
    await g.ev('activeSlot().photoAt=Date.now(); refreshResortPhoto()');
    eq(await g.ev('activeSlot().photo'),photo,'ordinary UI refresh reuses the captured photo');
    // Inactive and online-only tiles use their own captured photo, not the active mountain's image.
    const tiles=await g.ev(`(() => { const id=slots.active; const row={id:'saved-other',mt:'raven',name:'Other peak',here:true,sum:{lifts:1,trails:2}};slots.list.push({id:row.id,mountain:'raven',photo:activeSlot().photo,thumb:'data:image/jpeg;base64,OLDMAP'});const inactive=slotCard(row,false);const online=slotCard({id:'online-only',mt:'twin',name:'Cloud peak',online:true,sum:{},photo:activeSlot().photo},false);const legacy=slotCard({id:'legacy-only',mt:'maple',name:'Old peak',here:true,sum:{}},false);slots.list=slots.list.filter(s=>s.id===id);return [inactive.includes('alt="Scenic view of Other peak"'),!inactive.includes('OLDMAP'),online.includes('alt="Scenic view of Cloud peak"'),legacy.includes('<canvas')]; })()`);
    eq(tiles,[true,true,true,true],'inactive and cloud tiles use saved photos; older resorts keep scenic fallback');
    const guards=await g.ev(`(() => { const s=activeSlot(),old=s.photo;visiting={id:'someone-else'};refreshResortPhoto(true);const visit=s.photo===old;visiting=null;practice=true;refreshResortPhoto(true);const tutorial=s.photo===old;practice=false;const data=saveData(false);delete data.photo;applySave(data);return [visit,tutorial,state.cash===data.cash,world.lifts.length===data.world.lifts.length]; })()`);
    eq(guards,[true,true,true,true],'visits and tutorial never overwrite photos; old saves retain cash and builds');
    eq(await g.ev(`validResortPhoto('https://example.com/image.jpg') || validResortPhoto('data:image/svg+xml;base64,PHN2Zz4=')`),false,'only bounded JPEG data URLs can appear as saved photos');
    await g.ev('renderSlots()');
    const fits=await g.page.locator('.scard.on').evaluate(el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth;});
    assert(fits,`photo tile fits at ${width}px`);
    eq(g.errors,[],'no browser errors');
    await g.page.close();
  }
}
