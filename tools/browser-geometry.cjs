const assert=require('node:assert/strict'),fs=require('node:fs')
const {chromium}=require(process.env.ISLAND_PLAYWRIGHT||'C:/Users/192837465/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const base=process.env.ISLAND_URL||'http://127.0.0.1:4192/',out=__dirname+'/../artifacts',results=[],errors=[]
let browser
;(async()=>{
  browser=await chromium.launch({headless:true,executablePath:process.env.ISLAND_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'})
  for(const mobile of [false,true]){
    const page=await browser.newPage({viewport:mobile?{width:844,height:390}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile})
    page.on('pageerror',e=>errors.push(e.stack));await page.clock.install();await page.goto(base+'?inspect',{waitUntil:'networkidle'});await page.clock.runFor(2000);await page.locator('#combat-toggle').click();await page.clock.runFor(100)
    await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+100))
    const gate=await page.evaluate(()=>{
      const c=flightLab.combat,s=flightLab.scene;c.start();const p=s.telemetry,t=c.targets[0],put=(a,d)=>Object.assign(t,{x:p.x+Math.sin(p.yaw+a)*d,y:p.y-Math.cos(p.yaw+a)*d,z:p.z,hp:10000,maxHp:10000,speed:0,shot:999,sam:999})
      c.targets.forEach(a=>Object.assign(a,{x:p.x+Math.cos(p.yaw)*800,y:p.y+Math.sin(p.yaw)*800,z:p.z,speed:0,shot:999,sam:999}));put(.25,400);c.step(.02);const expanded=c.state.firing
      put(.55,200);c.step(.02);const outside=c.state.firing
      put(0,710);c.step(.02);const distant=c.state.firing
      c.effects.push({kind:'missile',enemy:true,x:p.x+70,y:p.y+70,z:p.z,px:p.x+70,py:p.y+70,pz:p.z,vx:0,vy:0,vz:0,speed:0,damage:7,life:.01,maxLife:6});c.step(.02)
      const timeout=c.effects.some(e=>e.kind==='blast'&&e.size===17&&e.x===p.x+70&&e.y===p.y+70&&e.z===p.z)
      return{expanded,outside,distant,timeout}
    });assert.deepEqual(gate,{expanded:true,outside:false,distant:false,timeout:true})
    for(const view of ['top','chase','cockpit']){
      const r=await page.evaluate(async({view,mobile})=>{
        const {ENEMIES}=await import('./src/combat.js?v=1.6.1'),s=flightLab.scene,c=flightLab.combat
        s.setParams({...flightLab.params,view,land:.2,clouds:.15});s.setKeys(0,0,false,0);for(let i=0;i<130;i++)s.step(.02)
        const p=s.telemetry,sn=Math.sin(p.yaw),cs=Math.cos(p.yaw),pos=(right,ahead,z=p.z)=>({x:p.x+cs*right+sn*ahead,y:p.y+sn*right-cs*ahead,z})
        const candidates=[]
        for(let ahead=view==='top'?90:280;ahead<=650;ahead+=30)for(let right=-150;right<=150;right+=30){const q=pos(right,ahead,2);if([-50,0,50].every(a=>[-18,0,18].every(b=>{const v=pos(right+b,ahead+a);return !s.isLand(v.x,v.y)})))candidates.push(q)}
        const chosen=[];for(const q of candidates)if(chosen.every(v=>Math.hypot(q.x-v.x,q.y-v.y)>105)){chosen.push(q);if(chosen.length===2)break}
        const actors=c.targets;actors.splice(0,actors.length)
        for(const [i,type]of ['warship','gunboat'].entries()){const q=chosen[i];if(!q)continue;actors.push({...ENEMIES[type],...q,type,id:100+i,grade:1,shot:999,sam:999,collision:0,yaw:p.yaw+.5,pitch:0,roll:0,age:4,stunt:-1,hostile:true,hp:ENEMIES[type].hp,maxHp:ENEMIES[type].hp,dead:false})}
        for(const [i,type]of ['tank','hunter','drone'].entries())actors.push({...ENEMIES[type],...pos(-65+i*70,75+i*30),type,id:110+i,grade:1,age:4,shot:999,sam:999,collision:0,yaw:p.yaw+.8,pitch:.15,roll:.3,stunt:-1,hostile:true,hp:10,maxHp:10,dead:false})
        const effects=c.effects;effects.splice(0,effects.length);s.setCombat(actors,effects)
        const before=new Uint8Array(s.render())
        for(const [i,kind]of ['bullet','bullet','missile'].entries()){
          const q=pos(-35+i*38,50+i*28,p.z+12),prev=pos(-35+i*38,42+i*28,p.z+12)
          effects.push({...q,kind,enemy:true,px:prev.x,py:prev.y,pz:prev.z,vx:sn*200,vy:-cs*200,vz:0,yaw:p.yaw,pitch:0,life:4,maxLife:6})
        }
        const bytes=s.render()
        let different=0;for(let i=0;i<bytes.length;i+=4)if(bytes[i]!==before[i]||bytes[i+1]!==before[i+1]||bytes[i+2]!==before[i+2])different++
        document.querySelector('#world').getContext('2d').putImageData(new ImageData(bytes,s.width,s.height),0,0)
        return{device:mobile?'phone':'desktop',view,navalUnits:chosen.length,navalOnWater:actors.filter(a=>a.marine).every(a=>!s.isLand(a.x,a.y)),faces:s.combatGeometry.faces,ordnancePixels:different}
      },{view,mobile})
      assert.equal(r.navalUnits,2);assert.ok(r.navalOnWater);assert.ok(r.faces>300);assert.ok(r.ordnancePixels>20,JSON.stringify(r));results.push(r)
      await page.screenshot({path:out+`/fleet-${mobile?'phone':'desktop'}-${view}.png`})
    }
    await page.close()
  }
  assert.deepEqual(errors,[]);const report={version:'1.6.1',site:base,passed:true,results,errors};fs.writeFileSync(out+'/fleet-browser-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close()
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1})
