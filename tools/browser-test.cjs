const {stickEvent}=require('./browser-stick.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let playwright;
try{playwright=require(process.env.ISLAND_PLAYWRIGHT||'playwright')}catch{playwright=require('C:/Users/192837465/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')}
const base=process.env.ISLAND_URL||'http://127.0.0.1:4192/';
const out=path.join(__dirname,'..','artifacts');fs.mkdirSync(out,{recursive:true});
let browser;
(async()=>{
 browser=await playwright.chromium.launch({headless:true,executablePath:process.env.ISLAND_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],bad=[],external=[],checks=[];
 const observe=p=>{p.on('pageerror',e=>errors.push(e.stack));p.on('response',r=>{if(r.status()>=400)bad.push({url:r.url(),status:r.status()})});p.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:'))external.push(r.url())})};observe(page);
 await page.clock.install();await page.goto(base+'?inspect',{waitUntil:'networkidle'});await page.clock.runFor(2000);
 assert.equal(await page.evaluate(()=>flightLab.scene.width),427);
 const start=await page.evaluate(()=>flightLab.snapshot());
 await page.keyboard.down('d');await page.clock.runFor(500);await page.keyboard.up('d');
 assert.ok(await page.evaluate(y=>flightLab.scene.telemetry.yaw>y,start.yaw));
 await page.keyboard.down('Shift');await page.clock.runFor(800);assert.ok(await page.evaluate(()=>flightLab.scene.telemetry.speed>140));await page.keyboard.up('Shift');
 await page.keyboard.press('q');assert.ok(await page.evaluate(()=>flightLab.scene.telemetry.rolling));await page.clock.runFor(1000);assert.equal(await page.evaluate(()=>flightLab.scene.telemetry.rolling),false);
 checks.push('WASD turning, boost, roll start and completion');
 await page.screenshot({path:out+'/desktop-free.png'});
 for(const [name,index]of [['chase',1],['cockpit',2],['top',0]]){await page.keyboard.press('Space');await page.clock.runFor(2300);assert.equal(await page.evaluate(()=>flightLab.scene.view),name);assert.equal(await page.locator('#view-index').textContent(),`${index+1}/3`);if(name!=='top')await page.screenshot({path:out+`/desktop-${name}.png`})}
 checks.push('Three continuous camera transitions and matching controls');
 await page.locator('#settings-toggle').click();
 await page.locator('[data-param=pixelSize]').fill('4');await page.clock.runFor(80);assert.equal(await page.evaluate(()=>flightLab.scene.width),320);
 await page.locator('[data-param=view]').selectOption('cockpit');await page.clock.runFor(100);assert.equal(await page.locator('#view-label').textContent(),'驾驶舱');
 await page.locator('[data-preset=sunset]').click();await page.clock.runFor(300);assert.equal(await page.evaluate(()=>flightLab.params.timeOfDay),'sunset');
 await page.screenshot({path:out+'/desktop-settings.png'});await page.locator('#reset-settings').click();await page.clock.runFor(100);await page.locator('#settings-close').click();
 checks.push('Live pixel resize, camera settings and palette/world presets');
 await page.keyboard.press('p');const frozen=await page.evaluate(()=>flightLab.scene.telemetry.time);await page.clock.runFor(1000);assert.equal(await page.evaluate(()=>flightLab.scene.telemetry.time),frozen);await page.locator('#resume').click();await page.clock.runFor(100);assert.ok(await page.evaluate(t=>flightLab.scene.telemetry.time>t,frozen));
 checks.push('Pause freezes simulation and resume restores keyboard focus');
 // Start without advancing time: assert the actual opening positions surround the pilot.
 const spawn=await page.evaluate(()=>{flightLab.setCombat(true);const p=flightLab.scene.telemetry;return flightLab.combat.targets.map(a=>Math.atan2(a.x-p.x,-(a.y-p.y)))});
 assert.equal(await page.evaluate(()=>flightLab.params.view),'chase');assert.equal(await page.locator('#view-label').textContent(),'追尾');assert.equal(spawn.length,4);const sorted=spawn.map(a=>(a+Math.PI*2)%(Math.PI*2)).sort((a,b)=>a-b);assert.ok(sorted.every((a,i)=>(sorted[(i+1)%4]+(i===3?Math.PI*2:0)-a)>1.3));
 await page.mouse.move(640,400);await page.mouse.down();assert.ok(await page.evaluate(()=>flightLab.combat.state.invulnerable>0));await page.mouse.up();await page.clock.runFor(1000);
 await page.mouse.down({button:'right'});await page.clock.runFor(350);assert.ok(await page.evaluate(()=>flightLab.scene.telemetry.boost>.8));assert.equal(await page.evaluate(()=>flightLab.scene.telemetry.rolling),false);await page.mouse.up({button:'right'});assert.equal(await page.evaluate(()=>flightLab.controls.pointerBoost),false);
 await page.clock.runFor(2000);await page.keyboard.press('q');assert.ok(await page.evaluate(()=>flightLab.combat.state.invulnerable>0));assert.equal(await page.evaluate(()=>flightLab.combat.damage(10)),false);await page.clock.runFor(520);assert.equal(await page.evaluate(()=>flightLab.combat.state.invulnerable),0);assert.ok(await page.evaluate(()=>flightLab.combat.state.rollCooldown>0));await page.clock.runFor(550);
 checks.push('Four opening sectors, left-click roll, right-click boost release, Q timed protection');
 const targetFire=await page.evaluate(()=>{
   const c=flightLab.combat,step=n=>{for(let i=0;i<n;i++)c.step(.02)};
   c.start();const p=flightLab.scene.telemetry,sn=Math.sin(p.yaw),cs=Math.cos(p.yaw),t=c.targets[0];c.targets.forEach(a=>Object.assign(a,{x:p.x+cs*650,y:p.y+sn*650,z:p.z,speed:0,shot:999,sam:999,hp:10000,maxHp:10000}));
   step(15);const idle={ammo:c.state.ammo,firing:c.state.firing};
   Object.assign(t,{x:p.x+sn*200,y:p.y-cs*200});step(20);const aimed={ammo:c.state.ammo,firing:c.state.firing};
   Object.assign(t,{x:p.x-sn*180,y:p.y+cs*180});step(15);const behind={ammo:c.state.ammo,firing:c.state.firing};
   Object.assign(t,{x:p.x+sn*800,y:p.y-cs*800});step(5);const far={ammo:c.state.ammo,firing:c.state.firing};
   Object.assign(t,{x:p.x+sn*200,y:p.y-cs*200,dead:true});step(5);const dead={ammo:c.state.ammo,firing:c.state.firing};
   c.start();return{idle,aimed,behind,far,dead}
 });assert.deepEqual(targetFire.idle,{ammo:60,firing:false});assert.ok(targetFire.aimed.firing&&targetFire.aimed.ammo<60,JSON.stringify(targetFire));assert.ok(!targetFire.behind.firing&&targetFire.behind.ammo>targetFire.aimed.ammo);assert.equal(targetFire.far.firing,false);assert.equal(targetFire.dead.firing,false);
 checks.push('Live cannon fires only at a frontal target within range; empty sky, rear, distant and dead targets preserve ammo');
 await page.evaluate(()=>{const p=flightLab.scene.telemetry,s=Math.sin(p.yaw),c=Math.cos(p.yaw);flightLab.combat.targets.forEach((a,i)=>Object.assign(a,{x:p.x+s*(i?850:115)+c*(i?i*15:0),y:p.y-c*(i?850:115)+s*(i?i*15:0),z:p.z,yaw:p.yaw,speed:0,hp:i?100:1,shot:999,sam:999}))});
 await page.clock.runFor(450);assert.ok(await page.evaluate(()=>flightLab.combat.state.kills>=1));assert.ok(await page.evaluate(()=>flightLab.combat.state.score>=100));assert.equal(await page.evaluate(()=>flightLab.combat.state.firing),false);
 const hud=await page.evaluate(()=>{const h=document.querySelector('#combat-hud'),c=document.querySelector('#pixel-hud'),style=getComputedStyle(h),ctx=c.getContext('2d'),bytes=ctx.getImageData(0,0,c.width,c.height).data;return {children:h.children.length,border:style.borderTopWidth,background:style.backgroundColor,height:h.getBoundingClientRect().height,alpha:[...new Set(Array.from(bytes).filter((_,i)=>i%4===3))],label:c.getAttribute('aria-label'),ammo:Number(c.dataset.ammo)}});assert.equal(hud.children,2);assert.equal(hud.border,'0px');assert.equal(hud.background,'rgba(0, 0, 0, 0)');assert.ok(hud.height<=76);assert.deepEqual(hud.alpha.sort((a,b)=>a-b),[0,255]);assert.match(hud.label,/血量.*弹药.*等级.*经验/);assert.equal(hud.ammo,await page.evaluate(()=>Math.floor(flightLab.combat.state.ammo)));assert.ok(hud.ammo<=60);
 await page.screenshot({path:out+'/desktop-combat.png'});
 // A valid target keeps automatic fire active across mouse release.
 await page.evaluate(()=>{const p=flightLab.scene.telemetry,a=flightLab.combat.targets[0];Object.assign(a,{x:p.x+Math.sin(p.yaw)*200,y:p.y-Math.cos(p.yaw)*200,z:p.z,hp:10000,maxHp:10000,speed:0,shot:999,sam:999})});
 await page.mouse.move(640,400);await page.mouse.down({button:'right'});await page.clock.runFor(100);assert.equal(await page.evaluate(()=>flightLab.combat.state.firing),true);await page.mouse.up({button:'right'});await page.clock.runFor(40);assert.equal(await page.evaluate(()=>flightLab.combat.state.firing),true);
 // Upgrade modal freezes both clocks, retains choices and accepts keyboard/card selection.
 await page.evaluate(()=>flightLab.combat.awardXP(flightLab.combat.state.xpNext));await page.clock.runFor(80);assert.ok(await page.locator('#upgrade-screen').isVisible());assert.equal(await page.locator('.upgrade-card').count(),3);
 const frozenRun=await page.evaluate(()=>({scene:flightLab.scene.telemetry.time,combat:flightLab.combat.state.elapsed,choices:flightLab.combat.state.choices}));await page.clock.runFor(1200);assert.deepEqual(await page.evaluate(()=>({scene:flightLab.scene.telemetry.time,combat:flightLab.combat.state.elapsed,choices:flightLab.combat.state.choices})),frozenRun);
 await page.keyboard.press('Escape');assert.ok(await page.locator('#upgrade-screen').isVisible());await page.screenshot({path:out+'/desktop-upgrade.png'});await page.keyboard.press('1');assert.equal(await page.locator('#upgrade-screen').isVisible(),false);assert.equal(await page.evaluate(()=>Object.values(flightLab.combat.state.ranks).reduce((a,b)=>a+b,0)),1);assert.ok(await page.evaluate(()=>flightLab.combat.state.enemies>=5));
 await page.evaluate(()=>flightLab.combat.awardXP(150));const queued=await page.evaluate(()=>flightLab.combat.state.pending);assert.ok(queued>1);for(let i=0;i<queued;i++)await page.locator('.upgrade-card').nth(1).click();assert.equal(await page.evaluate(()=>flightLab.combat.state.pending),0);
 checks.push('XP HUD, unique fixed three choices, full freeze, no Escape skip, keyboard/card choice and queued levels');
 // Offscreen arrows are pixels on the final rendered frame in all three cameras.
 for(const view of ['top','chase','cockpit']){
   const markers=await page.evaluate(view=>{const s=flightLab.scene;s.setParams({...flightLab.params,view});for(let i=0;i<100;i++)s.step(.02);const p=s.telemetry,targets=flightLab.combat.targets;targets.forEach((a,i)=>{a.x=p.x+Math.sin(i*Math.PI/2)*2000;a.y=p.y-Math.cos(i*Math.PI/2)*2000;a.z=p.z});const bytes=s.render();document.querySelector('#world').getContext('2d').putImageData(new ImageData(bytes,s.width,s.height),0,0);let pixels=0;for(let i=0;i<bytes.length;i+=4)if((bytes[i]===255&&bytes[i+1]===103&&bytes[i+2]===72)||(bytes[i]===190&&bytes[i+1]===162&&bytes[i+2]===235)||(bytes[i]===255&&bytes[i+1]===207&&bytes[i+2]===95))pixels++;return{markers:s.combatIndicators,pixels}},view);
   assert.ok(markers.markers>=2&&markers.pixels>=12,JSON.stringify({view,...markers}));
   await page.screenshot({path:out+`/offscreen-${view}.png`});
 }
 await page.evaluate(()=>flightLab.scene.setParams({...flightLab.params,view:'top'}));
 checks.push('Actual final-frame offscreen direction icons appear in top, chase and cockpit cameras');
 // Let spawn protection expire, then prove result and restart UI are connected.
 await page.evaluate(()=>{const c=flightLab.combat,p=flightLab.scene.telemetry;while(c.state.selecting)c.chooseUpgrade(c.state.choices[0].id);c.targets.forEach(a=>Object.assign(a,{x:p.x+Math.cos(p.yaw)*800,y:p.y+Math.sin(p.yaw)*800,speed:0,shot:999,sam:999}));for(let i=0;i<65;i++)c.step(.05);c.damage(9999)});await page.clock.runFor(500);assert.ok(await page.locator('#result-screen').isVisible());assert.match(await page.locator('#final-score').textContent(),/^\d{6}$/);
 await page.locator('#restart').click();await page.clock.runFor(50);assert.equal(await page.evaluate(()=>flightLab.combat.state.score),0);assert.equal(await page.evaluate(()=>flightLab.combat.state.hp),100);assert.equal(await page.evaluate(()=>flightLab.combat.state.level),1);assert.equal(await page.locator('#pixel-hud').getAttribute('data-hp'),'100');
 checks.push('Automatic cannon kills without input, five-field borderless bitmap HUD, death and restart');
 // Freeze RAF while capturing art; incomplete display-only actors must not enter simulation.
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+100));
 // Arrange a still-life from the live unit definitions to inspect new art in the actual renderer.
 for(const view of ['top','chase','cockpit']){
   await page.evaluate(async view=>{
     const {ENEMIES}=await import('./src/combat.js'),s=flightLab.scene;s.setParams({...flightLab.params,view});s.setKeys(0,0,false,0);for(let i=0;i<110;i++)s.step(.02)
     const p=s.telemetry,sn=Math.sin(p.yaw),cs=Math.cos(p.yaw),pos=(right,ahead,z=p.z)=>({x:p.x+cs*right+sn*ahead,y:p.y+sn*right-cs*ahead,z})
     const actors=flightLab.combat.targets;actors.splice(0,actors.length)
     for(const [i,type]of ['fast','tank','hunter','drone'].entries())actors.push({...ENEMIES[type],...pos((i%2?1:-1)*(48+i*13),85+i*23),type,hostile:true,hp:ENEMIES[type].hp,maxHp:ENEMIES[type].hp,yaw:p.yaw+Math.PI,pitch:0,roll:0,stunt:-1,dead:false})
     actors.push({...pos(28,-15),type:'ally',hostile:false,hp:50,maxHp:50,yaw:p.yaw,scale:.62,pitch:0,roll:0,stunt:-1})
     const ground=[];for(let ahead=60;ahead<=190;ahead+=20)for(let right=-100;right<=100;right+=20){const q=pos(right,ahead);if(s.isLand(q.x,q.y))ground.push(q)}
     for(const [i,type]of ['base','support'].entries()){const q=ground[i?Math.max(0,ground.length-1):0]||pos(i?90:-90,120);actors.push({...ENEMIES.base,...q,z:s.groundAt(q.x,q.y)+2,yaw:p.yaw,model:type,type,hostile:!i,hp:30,maxHp:30,ground:true,dead:false})}
     const effects=flightLab.combat.effects;effects.splice(0,effects.length)
     for(const [i,kind]of ['missile','drone','missile'].entries()){const q=pos(-15+i*25,40+i*28,p.z+(i-1)*7),pitch=(i-1)*.2;effects.push({...q,kind,enemy:i===2,px:q.x-sn*6,py:q.y+cs*6,pz:q.z-1,yaw:p.yaw,pitch,vx:sn*190,vy:-cs*190,vz:Math.sin(pitch)*190,life:4,maxLife:7})}
     const bytes=s.render();document.querySelector('#world').getContext('2d').putImageData(new ImageData(bytes,s.width,s.height),0,0)
   },view);
   await page.screenshot({path:out+`/units-${view}.png`});
 }
 checks.push('New missile, drone, AA base, ground support, allied and elite art renders in all three cameras');
 await page.keyboard.press('c');
 for(const [w,h]of [[1366,768],[1280,720],[390,844],[320,740],[844,390]]){await page.setViewportSize({width:w,height:h});await page.clock.runFor(100);const layout=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));assert.ok(layout.sw<=layout.w&&layout.sh<=layout.h,JSON.stringify(layout));await page.locator('#settings-toggle').click();const box=await page.locator('#settings').boundingBox();assert.ok(box.x>=-1&&box.x+box.width<=w+1&&box.y+box.height<=h+1);await page.locator('#settings-close').click()}
 checks.push('Five desktop, portrait and landscape sizes without page scrolling');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});observe(mobile);await mobile.clock.install();await mobile.goto(base+'?inspect',{waitUntil:'networkidle'});await mobile.clock.runFor(2000);assert.ok(await mobile.locator('#touch-controls').isVisible());assert.ok(await mobile.locator('#flight').evaluate(el=>el.classList.contains('portrait-landscape')));await mobile.screenshot({path:out+'/mobile-free.png'});
 const phone=await mobile.evaluate(()=>({width:document.querySelector('#flight').clientWidth,height:document.querySelector('#flight').clientHeight,renderWidth:flightLab.scene.width,hudWidth:document.querySelector('#pixel-hud').width}));assert.equal(phone.width,844);assert.equal(phone.height,390);assert.ok(phone.renderWidth>=422);
 await mobile.locator('#combat-toggle').tap();await mobile.clock.runFor(500);assert.equal(await mobile.evaluate(()=>flightLab.combat.state.active),true);await mobile.screenshot({path:out+'/mobile-combat.png'});
 await mobile.locator('#touch-boost').dispatchEvent('pointerdown',{pointerId:33,pointerType:'touch'});await mobile.clock.runFor(600);assert.ok(await mobile.evaluate(()=>flightLab.scene.telemetry.boost>.8));await mobile.locator('#touch-boost').dispatchEvent('pointercancel',{pointerId:33,pointerType:'touch'});assert.equal(await mobile.evaluate(()=>flightLab.controls.boost),false);
 // Dragging the rotated playfield maps the touch to the correct landscape pixel coordinates.
 await mobile.evaluate(()=>{const scene=flightLab.scene,original=scene.pointerMove;scene.pointerMove=(x,y)=>{window.lastMappedTouch={x,y};original(x,y)}});
 await mobile.locator('#world').dispatchEvent('pointerdown',{pointerId:51,pointerType:'touch',clientX:180,clientY:320});await mobile.locator('#world').dispatchEvent('pointermove',{pointerId:51,pointerType:'touch',clientX:200,clientY:340});const mapped=await mobile.evaluate(()=>window.lastMappedTouch);assert.ok(Math.abs(mapped.x-170)<=1&&Math.abs(mapped.y-95)<=1,JSON.stringify(mapped));await mobile.locator('#world').dispatchEvent('pointerup',{pointerId:51,pointerType:'touch',clientX:200,clientY:340});
 // Multiple fingers can boost and move the stick independently; focus loss releases both.
 await mobile.locator('#touch-boost').dispatchEvent('pointerdown',{pointerId:52,pointerType:'touch'});await stickEvent(mobile,'pointerdown',53,-1,0);assert.ok(await mobile.evaluate(()=>flightLab.controls.boost&&flightLab.controls.stickTurn<-.9));await stickEvent(mobile,'pointercancel',53);assert.ok(await mobile.evaluate(()=>flightLab.controls.boost&&!flightLab.controls.stickActive));await mobile.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.ok(await mobile.evaluate(()=>!flightLab.controls.boost&&!flightLab.controls.stickActive));await mobile.locator('#touch-boost').dispatchEvent('pointerdown',{pointerId:54,pointerType:'touch'});assert.equal(await mobile.evaluate(()=>flightLab.controls.boost),true);await mobile.locator('#touch-boost').dispatchEvent('pointerup',{pointerId:54,pointerType:'touch'});
 const yawBefore=await mobile.evaluate(()=>flightLab.scene.telemetry.yaw);await stickEvent(mobile,'pointerdown',34,-1,0);await mobile.clock.runFor(300);assert.ok(await mobile.evaluate(y=>flightLab.scene.telemetry.yaw<y,yawBefore));await stickEvent(mobile,'pointerup',34);assert.equal(await mobile.evaluate(()=>flightLab.controls.stickActive),false);
 const leftYaw=await mobile.evaluate(()=>flightLab.scene.telemetry.yaw);await stickEvent(mobile,'pointerdown',35,1,0);await mobile.clock.runFor(400);assert.ok(await mobile.evaluate(y=>flightLab.scene.telemetry.yaw>y,leftYaw));await stickEvent(mobile,'pointercancel',35);assert.equal(await mobile.evaluate(()=>flightLab.controls.stickTurn),0);
 // Sensor events use the real handler, including calibration and landscape axis mapping.
 await mobile.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:0,gamma:0})));await mobile.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:22,gamma:0})));await mobile.clock.runFor(250);assert.ok(await mobile.evaluate(()=>flightLab.controls.tiltTurn>.8));
 await mobile.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:-22,gamma:0})));await mobile.clock.runFor(250);assert.ok(await mobile.evaluate(()=>flightLab.controls.tiltTurn<-.8));
 await mobile.locator('#tilt-toggle').tap();await mobile.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:5,gamma:0})));assert.equal(await mobile.evaluate(()=>flightLab.controls.tiltTurn),0);
 await mobile.locator('#touch-roll').dispatchEvent('pointerdown',{pointerId:36,pointerType:'touch'});assert.ok(await mobile.evaluate(()=>flightLab.combat.state.invulnerable>0));await mobile.locator('#touch-roll').dispatchEvent('pointerup',{pointerId:36,pointerType:'touch'});
 await mobile.locator('#view-toggle').tap();await mobile.clock.runFor(100);assert.equal(await mobile.evaluate(()=>flightLab.scene.view),'cockpit');
 await mobile.evaluate(()=>flightLab.combat.awardXP(flightLab.combat.state.xpNext));await mobile.clock.runFor(60);assert.ok(await mobile.locator('#upgrade-screen').isVisible());const mobileCards=await mobile.locator('.upgrade-card').evaluateAll(els=>els.map(el=>({left:el.offsetLeft,top:el.offsetTop,width:el.offsetWidth})));assert.ok(mobileCards[0].left<mobileCards[1].left&&mobileCards[1].left<mobileCards[2].left);assert.ok(mobileCards.every(c=>c.top===mobileCards[0].top));await mobile.screenshot({path:out+'/mobile-upgrade.png'});await mobile.locator('.upgrade-card').nth(2).tap();assert.equal(await mobile.locator('#upgrade-screen').isVisible(),false);assert.equal(await mobile.evaluate(()=>flightLab.combat.state.selecting),false);
 await mobile.setViewportSize({width:844,height:390});await mobile.clock.runFor(120);assert.equal(await mobile.locator('#flight').evaluate(el=>el.classList.contains('portrait-landscape')),false);await mobile.screenshot({path:out+'/mobile-landscape.png'});
 for(const [width,height]of [[740,320],[667,375],[932,430],[320,740]]){await mobile.setViewportSize({width,height});await mobile.clock.runFor(80);const layout=await mobile.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));assert.ok(layout.sw<=layout.w&&layout.sh<=layout.h,JSON.stringify(layout));for(const id of ['flight-stick','touch-roll','touch-boost','combat-toggle','settings-toggle']){const b=await mobile.locator('#'+id).boundingBox();assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.width<=width+1&&b.y+b.height<=height+1,JSON.stringify({id,b,width,height}))}}
 checks.push('Phone landscape and rotated portrait, reduced view scale, automatic fire, multitouch turn/roll/boost, tilt sensor and calibration, compact upgrade cards');
 // Devices that deny motion permission still have fully functional touch controls.
 const denied=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});observe(denied);await denied.addInitScript(()=>{DeviceOrientationEvent.requestPermission=async()=> 'denied'});await denied.clock.install();await denied.goto(base+'?inspect',{waitUntil:'networkidle'});await denied.clock.runFor(1000);await denied.locator('#combat-toggle').tap();assert.equal(await denied.locator('#tilt-toggle').textContent(),'使用摇杆');await stickEvent(denied,'pointerdown',41,1,0);await denied.clock.runFor(100);assert.equal(await denied.evaluate(()=>flightLab.controls.stickTurn>.9),true);await stickEvent(denied,'pointerup',41);await denied.close();checks.push('Denied phone motion permission retains touch steering');
 await page.setViewportSize({width:1280,height:800});await page.goto(base+'models.html',{waitUntil:'networkidle'});assert.equal(await page.locator('#vox-count').textContent(),'2,564');await page.screenshot({path:out+'/model-viewer.png'});
 await page.locator('[data-view=top]').click();await page.locator('#layer').fill('4');assert.match(await page.locator('#layer-out').textContent(),/第 5 层/);
 const vox=await page.request.get(base+'models/fighterjet.vox');assert.equal(vox.status(),200);assert.equal((await vox.body()).subarray(0,4).toString(),'VOX ');
 for(const file of ['assets/fighter-slices.png','assets/fighter-reconstructed-four-views.png','models/fighter-slices.json'])assert.equal((await page.request.get(base+file)).status(),200);
 assert.equal(await page.locator('[data-unit]').count(),11);await page.locator('#unit-gallery').screenshot({path:out+'/unit-models.png'});await page.locator('[data-unit-view=top]').click();await page.locator('#unit-gallery').screenshot({path:out+'/unit-models-top.png'});await page.locator('[data-unit-view=side]').click();await page.locator('#unit-gallery').screenshot({path:out+'/unit-models-side.png'});
 for(const id of ['fighter','fast','tank','hunter','ally','missile','drone','base','support','warship','gunboat']){const vox=await page.request.get(base+`models/${id}.vox`);assert.equal(vox.status(),200);assert.equal((await vox.body()).subarray(0,4).toString(),'VOX ');const data=await (await page.request.get(base+`models/${id}.json`)).json();assert.ok(data.voxels.length>100)}
 for(const file of ['README.md','制作说明.md','肉鸽玩法说明.md'])assert.equal((await page.request.get(base+encodeURI(file))).status(),200);
 checks.push('Interactive model inspector, MagicaVoxel and PNG/JSON assets');
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);assert.deepEqual(external,[]);
 const result={date:new Date().toISOString(),version:'1.6.0',base:'1.0.0',checks,errors,bad,external,passed:true};fs.writeFileSync(out+'/validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1});
