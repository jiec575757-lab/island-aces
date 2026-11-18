const assert=require('node:assert/strict'),fs=require('node:fs')
const {chromium}=require('C:/Users/192837465/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const base=process.env.ISLAND_URL||'http://127.0.0.1:4192/',out=__dirname+'/../artifacts',checks=[],visuals=[],errors=[]
let browser
;(async()=>{
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
  for(const size of [{width:1280,height:800},{width:844,height:390},{width:390,height:844},{width:740,height:320}]){
    const mobile=size.width!==1280,p=await browser.newPage({viewport:size,isMobile:mobile,hasTouch:mobile})
    p.on('pageerror',e=>errors.push(e.stack));if(mobile)await p.addInitScript(()=>{DeviceOrientationEvent.requestPermission=async()=> 'granted'});await p.clock.install();await p.goto(base+'?inspect',{waitUntil:'networkidle'});await p.clock.runFor(1200)
    await p.locator('#combat-toggle').click();assert.equal(await p.evaluate(()=>flightLab.params.view),'chase');assert.equal(await p.locator('#view-label').textContent(),'追尾')
    await p.evaluate(()=>{const f=flightLab;f.params.followPointer=false;f.scene.setParams(f.params);const p=f.scene.telemetry;f.combat.targets.forEach(a=>Object.assign(a,{x:p.x+650,y:p.y,z:p.z,hp:1e6,maxHp:1e6,shot:999,sam:999,speed:0}))})
    await p.clock.runFor(2200);assert.equal(await p.evaluate(()=>flightLab.scene.view),'chase')
    if(mobile){
      const layout=await p.locator('#tilt-toggle').evaluate(el=>({parent:el.parentElement.tagName,x:el.offsetLeft,w:el.offsetWidth,topbar:el.closest('.topbar').offsetTop}));assert.equal(layout.parent,'NAV');assert.ok(layout.topbar<20)
      assert.equal(await p.locator('.stick-forward,.stick-back').count(),0)
      await p.locator('#tilt-toggle').tap();assert.equal(await p.locator('#tilt-toggle').getAttribute('aria-pressed'),'true')
      await p.evaluate(()=>{window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:0,gamma:0}));window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:22,gamma:0}))});assert.ok(await p.evaluate(()=>flightLab.controls.tiltTurn>.8))
      await p.locator('#tilt-toggle').tap();assert.equal(await p.locator('#tilt-toggle').getAttribute('aria-pressed'),'false')
      await p.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:-22,gamma:0})));assert.equal(await p.evaluate(()=>flightLab.controls.tiltTurn),0)
      // Starting another sortie must honor the chosen off state.
      await p.locator('#combat-toggle').tap();await p.locator('#combat-toggle').tap();assert.equal(await p.locator('#tilt-toggle').getAttribute('aria-pressed'),'false')
      await p.locator('#tilt-toggle').tap();await p.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:12,gamma:0})));assert.equal(await p.evaluate(()=>flightLab.controls.tiltTurn),0);await p.locator('#tilt-toggle').tap()
      await p.screenshot({path:out+`/compact-controls-${size.width}x${size.height}.png`})
    }
    await p.evaluate(()=>flightLab.combat.awardXP(flightLab.combat.state.xpNext));await p.clock.runFor(50)
    const frozen=await p.evaluate(()=>({scene:flightLab.scene.telemetry.time,combat:flightLab.combat.state.elapsed,level:flightLab.combat.state.level,xp:flightLab.combat.state.xp,pending:flightLab.combat.state.pending}))
    const ids=()=>p.locator('.upgrade-card').evaluateAll(els=>els.map(el=>el.dataset.upgrade))
    for(let i=0;i<2;i++){
      const old=await ids();if(i===1&&!mobile)await p.keyboard.press('r');else await p.locator('#upgrade-refresh').click()
      const next=await ids();assert.equal(new Set(next).size,3);assert.ok(next.every(id=>!old.includes(id)));await p.clock.runFor(400)
      assert.deepEqual(await p.evaluate(()=>({scene:flightLab.scene.telemetry.time,combat:flightLab.combat.state.elapsed,level:flightLab.combat.state.level,xp:flightLab.combat.state.xp,pending:flightLab.combat.state.pending})),frozen)
    }
    assert.equal(await p.locator('#upgrade-refresh').getAttribute('data-remaining'),'0');assert.equal(await p.locator('#upgrade-refresh').isDisabled(),true)
    assert.equal((await p.locator('#upgrade-refresh').textContent()).trim(),'');assert.equal(await p.locator('.upgrade-actions small,#upgrade-subtitle,.upgrade-dialog footer,.upgrade-dialog>small,.upgrade-card>small').count(),0)
    const exhausted=await ids();await p.keyboard.press('r');assert.deepEqual(await ids(),exhausted)
    const bounds=await p.locator('#upgrade-refresh').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=size.width+1&&bounds.y+bounds.height<=size.height+1)
    await p.screenshot({path:out+`/refresh-${size.width}x${size.height}.png`})
    const chosen=(await ids())[1];await p.locator('.upgrade-card').nth(1).click();assert.equal(await p.evaluate(id=>flightLab.combat.state.ranks[id],chosen),1);assert.equal(await p.locator('#upgrade-screen').isVisible(),false)
    await p.evaluate(()=>{const f=flightLab;f.params.view='cockpit';f.scene.setParams(f.params);for(let i=0;i<100;i++)f.combat.step(.05);f.combat.damage(99999)})
    await p.locator('#restart').click();assert.equal(await p.evaluate(()=>flightLab.params.view),'chase');assert.equal(await p.locator('#view-label').textContent(),'追尾')
    await p.clock.pauseAt(new Date(await p.evaluate(()=>Date.now())+50))
    await p.locator('#flame').evaluate(el=>el.style.visibility='hidden')
    for(const view of ['chase','cockpit'])for(const timeOfDay of ['day','night']){
      await p.locator('#settings-toggle').click();await p.locator('[data-param=view]').selectOption(view);await p.locator('#settings-close').click()
      const result=await p.evaluate(({view,timeOfDay})=>{
        const s=flightLab.scene;s.setParams({...flightLab.params,view,timeOfDay,stunts:false});s.setKeys(0,0,false,0);s.pointerLeave();for(let i=0;i<170;i++)s.step(.02)
        const p=s.telemetry,sn=Math.sin(p.yaw),cs=Math.cos(p.yaw),effects=[];s.setCombat([],effects)
        const before=new Uint8Array(s.render()),put=(right,ahead,enemy)=>effects.push({kind:'bullet',enemy,x:p.x+cs*right+sn*ahead,y:p.y+sn*right-cs*ahead,z:p.z+8,px:p.x+cs*right+sn*(ahead-8),py:p.y+sn*right-cs*(ahead-8),pz:p.z+8,vx:sn*430,vy:-cs*430,vz:0,life:2,maxLife:2.4})
        for(const [i,ahead]of [90,200,350].entries())put(-20-i*12,ahead,false)
        const friendly=new Uint8Array(s.render());let friendlyPixels=0,redPixels=0,cyanPixels=0;for(let i=0;i<friendly.length;i+=4)if(friendly[i]!==before[i]||friendly[i+1]!==before[i+1]||friendly[i+2]!==before[i+2])friendlyPixels++
        for(let i=0;i<friendly.length;i+=4){if(friendly[i]===211&&friendly[i+1]===45&&friendly[i+2]===38)redPixels++;if(friendly[i]===48&&friendly[i+1]===169&&friendly[i+2]===184)cyanPixels++}
        for(const [i,ahead]of [100,210,350].entries())put(30+i*12,ahead,true)
        const bytes=s.render();let enemyPixels=0;for(let i=0;i<bytes.length;i+=4)if(bytes[i]!==friendly[i]||bytes[i+1]!==friendly[i+1]||bytes[i+2]!==friendly[i+2])enemyPixels++
        document.querySelector('#world').getContext('2d').putImageData(new ImageData(bytes,s.width,s.height),0,0)
        return{view,timeOfDay,friendlyPixels,enemyPixels,redPixels,cyanPixels}
      },{view,timeOfDay})
      assert.ok(result.friendlyPixels>=30&&result.enemyPixels>=45&&result.redPixels>=4&&result.cyanPixels===0,JSON.stringify({size,...result}));visuals.push({size,...result})
      await p.screenshot({path:out+`/tracers-${size.width}x${size.height}-${view}-${timeOfDay}.png`})
    }
    await p.close()
  }
  checks.push('Desktop and three phone sizes: default chase camera on entry and restart, icon/R refresh changes all three cards twice per level, disables when exhausted, keeps both clocks frozen and grants only the chosen new card; top-right tilt switch toggles on/off with recalibration; joystick has no explanatory text')
  checks.push('Actual chase/cockpit frames on desktop and phones show red friendly and enemy tracer pixels with no cyan tails at near, middle and far distances during day and night')
  assert.deepEqual(errors,[]);const report={version:'1.6.1',site:base,passed:true,checks,visuals,errors};fs.writeFileSync(out+'/combat-update-browser-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close()
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1})
