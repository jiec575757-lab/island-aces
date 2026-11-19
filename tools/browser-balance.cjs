const assert=require('node:assert/strict'),fs=require('node:fs')
const {chromium}=require(process.env.ISLAND_PLAYWRIGHT||'C:/Users/192837465/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const base=process.env.ISLAND_URL||'http://127.0.0.1:4192/',results=[],errors=[]
let browser
;(async()=>{
  browser=await chromium.launch({headless:true,executablePath:process.env.ISLAND_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'})
  for(const mobile of [false,true]){
    const page=await browser.newPage({viewport:mobile?{width:844,height:390}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile})
    page.on('pageerror',e=>errors.push(e.message));await page.clock.install()
    const url=new URL(base);url.searchParams.set('inspect','');url.searchParams.set('v','1.6.3')
    let ready=false,lastError
    for(let attempt=0;attempt<3;attempt++)try{
      const response=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:20000})
      assert.equal(response.status(),200);await page.waitForFunction(()=>!!window.flightLab,{},{timeout:15000});ready=true;break
    }catch(e){lastError=e;console.log(`Connection retry ${attempt+1}: ${e.message.split('\n')[0]}`)}
    if(!ready)throw lastError
    assert.match(await page.locator('script[type=module]').getAttribute('src'),/v=1\.6\.2/)
    await page.locator('#combat-toggle').click();assert.equal(await page.evaluate(()=>flightLab.params.view),'chase')
    await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+50))
    const result=await page.evaluate(async()=>{
      const {createCombat,ENEMIES}=await import('./src/combat.js?v=1.6.3'),scene=flightLab.scene
      const c=createCombat(scene,()=>{},()=>.001,{autoFire:false});c.start()
      const park=()=>{const p=scene.telemetry;c.targets.forEach(a=>{if(a.hostile)Object.assign(a,{x:p.x+650+a.id%28,y:p.y,z:a.ground||a.marine?2:p.z,speed:0,shot:999,sam:999})})}
      const verify=()=>{
        const live=c.targets.filter(a=>a.hostile&&!a.dead),tanks=live.filter(a=>a.type==='tank')
        if(tanks.length>3)throw Error(`Heavy cap exceeded: level ${c.state.level}, wave ${c.state.wave}`)
        for(const a of live)if(a.hp!==ENEMIES[a.type].hp||a.maxHp!==ENEMIES[a.type].hp||a.damage!==ENEMIES[a.type].damage)throw Error(`Enemy stats scaled: ${a.type} at level ${c.state.level}`)
        return tanks.length
      }
      let maxTanks=0,waves=0;park()
      for(let level=1;level<=30;level++){
        maxTanks=Math.max(maxTanks,verify())
        for(let wave=0;wave<2;wave++){
          c.targets.forEach(a=>a.dead=true);const previous=c.state.wave
          for(let i=0;i<70&&c.state.wave===previous;i++)c.step(.05)
          if(c.state.wave!==previous+1)throw Error('Wave did not advance')
          park();maxTanks=Math.max(maxTanks,verify());waves++
        }
        if(level<30){c.awardXP(c.state.xpNext-c.state.xp);if(!c.chooseUpgrade('rapid'))throw Error('Deterministic upgrade missing');park()}
      }
      const shots=[]
      for(const grade of [1,7,13,19,25]){
        const test=createCombat(scene,()=>{},()=>.001,{autoFire:false});test.start()
        const p=scene.telemetry,a=test.targets[0];test.targets.slice(1).forEach(a=>a.dead=true)
        Object.assign(a,{x:p.x,y:p.y-220,z:p.z,yaw:Math.PI,grade,shot:0,sam:999})
        const y=a.y;test.step(.02);const bullets=test.effects.filter(e=>e.enemy&&e.kind==='bullet')
        shots.push({grade,count:bullets.length,damage:bullets.map(b=>b.damage),hp:a.maxHp,flight:Math.abs(a.y-y)/.02,bullet:bullets[0]?.speed})
        test.stop()
      }
      c.stop();flightLab.combat.stop();return{maxTanks,waves,levels:30,shots}
    })
    assert.equal(result.maxTanks,3);assert.equal(result.waves,60)
    assert.deepEqual(result.shots.map(s=>s.count),[1,2,3,4,5])
    for(const s of result.shots){assert.equal(s.hp,3);assert.ok(s.damage.every(d=>d===8))}
    for(let i=1;i<result.shots.length;i++){assert.ok(result.shots[i].flight>result.shots[i-1].flight);assert.ok(result.shots[i].bullet>result.shots[i-1].bullet)}
    results.push({mobile,...result});await page.close()
  }
  assert.deepEqual(errors,[])
  const report={version:'1.6.3',date:new Date().toISOString(),site:base,passed:true,checks:['Desktop and phone served modules: 30 levels and 60 waves each, maximum three heavy fighters, all enemy HP and damage fixed','Actual grade 1/7/13/19/25 cannon volleys contain 1/2/3/4/5 bullets with unchanged 8 damage; measured flight and projectile speeds increase'],results,errors}
  fs.writeFileSync(process.env.ISLAND_REPORT||__dirname+'/../artifacts/balance-browser-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close()
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1})
