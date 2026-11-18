const {stickPoint,stickEvent}=require('./browser-stick.cjs')
const assert=require('node:assert/strict'),fs=require('node:fs')
const {chromium}=require('C:/Users/192837465/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const base=process.env.ISLAND_URL||'http://127.0.0.1:4192/',out=__dirname+'/../artifacts',checks=[],errors=[]
let browser
;(async()=>{
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
  const desktop=await browser.newPage({viewport:{width:1280,height:800}});desktop.on('pageerror',e=>errors.push(e.stack));await desktop.clock.install();await desktop.goto(base+'?inspect',{waitUntil:'networkidle'});await desktop.clock.runFor(1000)
  assert.equal(await desktop.evaluate(()=>flightLab.audio.state.context),'locked')
  await desktop.locator('#combat-toggle').click();await desktop.waitForFunction(()=>flightLab.audio.state.context==='running');await desktop.clock.runFor(100)
  const audio=await desktop.evaluate(()=>{const a=flightLab.audio;a.step({combat:true});a.play('hit');const active=a.state;a.configure({sfx:false,music:false,volume:.2});a.play('hit');a.step({combat:true});return{active,muted:a.state,saved:localStorage.getItem('island-aces-volume')}})
  assert.ok(audio.active.notes>0&&audio.active.effects>0&&audio.active.engine);assert.equal(audio.muted.effects,audio.active.effects);assert.equal(audio.muted.music,false);assert.equal(audio.saved,'0.2')
  await desktop.evaluate(()=>flightLab.audio.configure({sfx:true,music:true,volume:.35}))
  checks.push('Audio starts after user interaction, live AudioContext schedules music and effects, independent mute and persisted volume work')
  await desktop.locator('#settings-toggle').click();await desktop.locator('#weather-mode').selectOption('rain');await desktop.locator('#settings-close').click();await desktop.clock.runFor(200)
  const rain=await desktop.evaluate(()=>({weather:flightLab.weather.state,alpha:[...document.querySelector('#weather').getContext('2d').getImageData(0,0,427,267).data].filter((v,i)=>i%4===3&&v>0).length,label:document.querySelector('#weather-label').textContent}))
  assert.equal(rain.weather.current,'rain');assert.ok(rain.alpha>2000);assert.equal(rain.label,'阵雨');await desktop.screenshot({path:out+'/weather-rain-desktop.png'})
  await desktop.evaluate(()=>{flightLab.weather.setMode('storm');flightLab.weather.step(8.1)});await desktop.clock.runFor(50);assert.equal(await desktop.evaluate(()=>flightLab.weather.state.current),'storm')
  await desktop.evaluate(()=>flightLab.setPaused(true));await desktop.clock.runFor(100);const frozen=await desktop.evaluate(()=>({t:flightLab.weather.state.elapsed,notes:flightLab.audio.state.notes}));await desktop.clock.runFor(500);assert.deepEqual(await desktop.evaluate(()=>({t:flightLab.weather.state.elapsed,notes:flightLab.audio.state.notes})),frozen);assert.equal(await desktop.evaluate(()=>flightLab.audio.state.running),false)
  await desktop.locator('#resume').click();await desktop.clock.runFor(100);assert.ok(await desktop.evaluate(t=>flightLab.weather.state.elapsed>t,frozen.t))
  await desktop.evaluate(()=>flightLab.weather.setMode('fog'));await desktop.clock.runFor(50);await desktop.screenshot({path:out+'/weather-fog-desktop.png'})
  checks.push('Real weather canvas shows rain and fog, storm mode is selectable, music and weather freeze with pause and resume')
  await desktop.locator('#settings-toggle').click()
  assert.match(await desktop.locator('.environment-note').textContent(),/自动轮换只改变天气/)
  const palettes=[]
  for(const time of ['day','sunset','night']){
    await desktop.locator('[data-param=timeOfDay]').selectOption(time);await desktop.locator('#weather-mode').selectOption(time==='night'?'fog':'rain');await desktop.clock.runFor(60)
    palettes.push(await desktop.evaluate(()=>{const b=flightLab.scene.render();return Array.from(b.slice(0,120))}))
    assert.equal(await desktop.evaluate(()=>flightLab.params.timeOfDay),time)
    assert.equal(await desktop.evaluate(()=>flightLab.weather.state.current),time==='night'?'fog':'rain')
  }
  assert.notDeepEqual(palettes[0],palettes[1]);assert.notDeepEqual(palettes[1],palettes[2])
  await desktop.evaluate(()=>{flightLab.weather.setMode('auto');flightLab.weather.step(65.1)});assert.equal(await desktop.evaluate(()=>flightLab.params.timeOfDay),'night')
  await desktop.locator('#weather-mode').selectOption('fog');await desktop.locator('#settings-close').click();await desktop.clock.runFor(100);await desktop.screenshot({path:out+'/weather-night-fog-desktop.png'})
  checks.push('Day, sunset and night each retain distinct rendered palettes alongside rain/fog; automatic weather changes preserve the chosen time of day and settings explain this')
  for(const size of [{width:844,height:390},{width:390,height:844},{width:667,height:375},{width:740,height:320}]){
    const p=await browser.newPage({viewport:size,isMobile:true,hasTouch:true});p.on('pageerror',e=>errors.push(e.stack));await p.clock.install();await p.goto(base+'?inspect',{waitUntil:'networkidle'});await p.clock.runFor(1000);await p.locator('#combat-toggle').tap();await p.clock.runFor(100)
    // Park enemies to observe input and layout without a level-up pausing the fixture.
    await p.evaluate(()=>{flightLab.combat.targets.forEach(a=>Object.assign(a,{hp:1e6,maxHp:1e6,shot:999,sam:999,speed:0}));flightLab.params.followPointer=false;flightLab.scene.setParams(flightLab.params)})
    const layout=await p.evaluate(()=>{const f=document.querySelector('#flight'),box=id=>{const el=document.getElementById(id);return{x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight}},hud=box('combat-hud'),radar=box('radar-wrap');return{hud,radar,identity:getComputedStyle(document.querySelector('.identity')).display,rollParent:document.querySelector('#touch-roll').parentElement.className,view:!!document.querySelector('#touch-view'),stick:!!document.querySelector('#flight-stick'),oldButtons:!!document.querySelector('#touch-up,#touch-down,#touch-left,#touch-right'),speed:document.querySelector('#pixel-hud').dataset.speed,w:f.clientWidth,h:f.clientHeight}})
    assert.equal(layout.identity,'none');assert.equal(layout.rollParent,'touch-right');assert.equal(layout.view,false);assert.ok(layout.stick&&!layout.oldButtons);assert.ok(layout.radar.w>=96);assert.ok(layout.radar.y>=layout.hud.y+layout.hud.h);assert.ok(layout.radar.x<30);assert.ok(Number(layout.speed)>0)
    for(const id of ['flight-stick','tilt-toggle','touch-roll','touch-boost']){const b=await p.locator('#'+id).boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=size.width+1&&b.y+b.height<=size.height+1,JSON.stringify({id,size,b}))}
    // Real browser touch input must capture drags outside the stick and keep boost independent.
    const cdp=await p.context().newCDPSession(p),center=await stickPoint(p),backRight=await stickPoint(p,.72,.72),boostBox=await p.locator('#touch-boost').boundingBox(),boost={x:boostBox.x+boostBox.width/2,y:boostBox.y+boostBox.height/2,id:2}
    const touch=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(q=>({...q,radiusX:2,radiusY:2,force:1}))})
    for(const invert of [true,false]){
      await p.evaluate(invert=>{flightLab.params.invertY=invert;flightLab.scene.setParams(flightLab.params)},invert)
      const before=await p.evaluate(()=>flightLab.scene.telemetry)
      await touch('touchStart',[{...center,id:1}]);await touch('touchMove',[{...backRight,id:1}]);await touch('touchStart',[{...backRight,id:1},boost]);await p.clock.runFor(700)
      const up=await p.evaluate(()=>({z:flightLab.scene.telemetry.z,yaw:flightLab.scene.telemetry.yaw,speed:flightLab.scene.telemetry.speed,hud:Number(document.querySelector('#pixel-hud').dataset.speed),held:flightLab.controls.stickClimb>.5&&flightLab.controls.stickTurn>.5&&flightLab.controls.boost}))
      assert.ok(up.z>before.z+8&&up.yaw>before.yaw+.1,JSON.stringify({size,invert,before,up}));assert.ok(up.held&&up.speed>140);assert.ok(Math.abs(up.hud-up.speed)<2)
      await p.screenshot({path:out+`/stick-diagonal-${size.width}x${size.height}.png`})
      // A second touch on the stick cannot steal the first finger or reset its axes.
      await stickEvent(p,'pointerdown',999,-1,-1);await stickEvent(p,'pointerup',999);assert.ok(await p.evaluate(()=>flightLab.controls.stickTurn>.5&&flightLab.controls.stickClimb>.5))
      const outside=await stickPoint(p,1.8,0);await touch('touchMove',[{...outside,id:1},boost]);await p.clock.runFor(32);const clamped=await p.evaluate(()=>({turn:flightLab.controls.stickTurn,climb:flightLab.controls.stickClimb,active:flightLab.controls.stickActive}));assert.ok(clamped.turn>.98&&Math.abs(clamped.climb)<.03,JSON.stringify({size,invert,outside,clamped}));await touch('touchEnd',[{...outside,id:1}]);await p.clock.runFor(32);const released=await p.evaluate(()=>({active:flightLab.controls.stickActive,boost:flightLab.controls.boost,turn:flightLab.controls.stickTurn}));assert.ok(!released.active&&released.boost,JSON.stringify({size,invert,released}));await touch('touchEnd',[])
      const frontLeft=await stickPoint(p,-.72,-.72),high=await p.evaluate(()=>flightLab.scene.telemetry)
      await touch('touchStart',[{...center,id:3}]);await touch('touchMove',[{...frontLeft,id:3}]);await p.clock.runFor(1100)
      const down=await p.evaluate(()=>flightLab.scene.telemetry);assert.ok(down.z<high.z-8&&down.yaw<high.yaw-.1,JSON.stringify({size,invert,high,down}));await touch('touchCancel',[])
      assert.ok(await p.evaluate(()=>!flightLab.controls.stickActive&&!flightLab.controls.stickClimb&&!flightLab.controls.stickTurn&&!flightLab.controls.boost));assert.equal(await p.locator('#flight-stick').evaluate(el=>el.classList.contains('engaged')),false)
    }
    // Holding the center suppresses the tilt sensor; pause and blur release stick state.
    await p.evaluate(()=>{window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:0,gamma:0}));window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:22,gamma:0}))});await stickEvent(p,'pointerdown',80,0,0);await p.clock.runFor(600);assert.ok(await p.evaluate(()=>Math.abs(flightLab.scene.telemetry.turn)<.04));await p.evaluate(()=>flightLab.setPaused(true));assert.ok(await p.evaluate(()=>!flightLab.controls.stickActive));await p.locator('#resume').click()
    await stickEvent(p,'pointerdown',81,1,1);await p.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.ok(await p.evaluate(()=>!flightLab.controls.stickActive&&flightLab.controls.stickTurn===0&&flightLab.controls.stickClimb===0))
    await p.evaluate(()=>flightLab.weather.setMode('rain'));await p.clock.runFor(100);await p.screenshot({path:out+`/systems-phone-${size.width}x${size.height}.png`});await p.close()
  }
  checks.push('Four phone sizes, both invert-Y settings: real touch drags climb on pull-back, descend on push-forward and turn diagonally; pointer capture, analog clamp, multitouch boost, extra-finger rejection, sensor override, release/cancel/pause/blur resets; compact HUD and radar fit')
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/systems-browser-validation.json',JSON.stringify({version:'1.6.0',site:base,passed:true,checks,errors},null,2));console.log(JSON.stringify({checks,errors,passed:true},null,2));await browser.close()
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1})
