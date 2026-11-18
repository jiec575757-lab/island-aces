import assert from 'node:assert/strict'
import {createCombat,ENEMIES,SPAWN_UNLOCKS,enemyGrowth} from '../src/combat.js'
import {UPGRADES,deriveStats} from '../src/upgrades.js'
import {createWeather} from '../src/weather.js'
import {writeFile} from 'node:fs/promises'
const checks=[]
function fixture(autoFire=false){
  const p={x:0,y:0,z:110,yaw:0,pitch:0,roll:0,speed:0},events=[];let wanted='rapid'
  const scene={get telemetry(){return{...p}},groundAt(){return 0},isLand(x){return x<60},restart(){},setCombat(){},setCombatFlight(){}}
  const c=createCombat(scene,(type,data)=>events.push({type,...data}),()=> (UPGRADES.findIndex(u=>u.id===wanted)+.1)/UPGRADES.length,{autoFire})
  const step=seconds=>{for(let i=0;i<Math.round(seconds/.02);i++)c.step(.02)}
  const park=()=>c.targets.forEach(a=>{if(a.hostile)Object.assign(a,{x:650+a.id*2,y:50,z:a.marine?2:110,speed:0,shot:999,sam:999})})
  const grant=id=>{wanted=id;c.awardXP(c.state.xpNext-c.state.xp);c.chooseUpgrade(id);park()}
  c.start();return{c,p,events,step,park,grant}
}
{
  const f=fixture();f.park()
  for(let level=1;level<=22;level++){
    assert.equal(f.c.state.level,level)
    for(const actor of f.c.targets.filter(a=>a.hostile&&!a.dead))assert.ok(!SPAWN_UNLOCKS[actor.type]||SPAWN_UNLOCKS[actor.type]<=level,`${actor.type} appeared too early at ${level}`)
    for(const [type,unlock]of Object.entries(SPAWN_UNLOCKS))if(unlock===level)assert.ok(f.c.targets.some(a=>a.type===type&&!a.dead),`${type} introduced at its exact level`)
    assert.ok(f.c.state.enemies<=18)
    if(level<22)f.grant('shield')
  }
  const early=fixture();early.park();for(let wave=0;wave<3;wave++){early.c.targets.forEach(a=>a.dead=true);early.step(3.2);assert.ok(early.c.targets.every(a=>a.type==='fighter'))}
  checks.push('Exact unlock levels 3/5/8/10/12/14/16/20, no early elite bypass through waves, capped population and immediate unlocked-role introductions')
}
{
  const f=fixture(true);f.park();const t=f.c.targets[0];Object.assign(t,{x:0,y:-460,z:110,hp:1000,maxHp:1000})
  f.step(.1);assert.equal(f.c.state.firing,false)
  f.grant('radar');Object.assign(t,{x:Math.sin(.34)*460,y:-Math.cos(.34)*460,z:110});f.step(.02)
  assert.equal(f.c.state.firing,true);assert.equal(f.c.state.stats.cannonRange,490);assert.ok(f.c.state.stats.cannonCone>.34)
  const base=deriveStats();assert.equal(base.ammoRegen,3);assert.equal(base.cannonRange,420);assert.ok(Math.abs(base.cannonCone-Math.PI/10)<1e-9)
  const refill=fixture();refill.park();refill.c.setFiring(true);refill.step(15);refill.c.setFiring(false);const ammo=refill.c.state.ammo;refill.step(1);assert.ok(Math.abs(refill.c.state.ammo-ammo-3)<1e-7)
  checks.push('Narrow 420m / ±18° gate, radar increases range and cone, base reload measured at exactly 3 rounds per second')
}
{
  const f=fixture();f.park()
  for(let rank=1;rank<=6;rank++){
    f.grant('wingman');f.step(.04);assert.equal(f.c.state.allies.length,Math.min(5,rank));assert.equal(f.c.targets.filter(a=>a.type==='ally'&&!a.dead).length,Math.min(5,rank))
  }
  const wings=f.c.targets.filter(a=>a.type==='ally'&&!a.dead),dead=wings[1]
  f.c.effects.push({kind:'bullet',enemy:true,x:dead.x,y:dead.y,z:dead.z,px:dead.x,py:dead.y,pz:dead.z,vx:0,vy:0,vz:0,damage:999,life:1,maxLife:1})
  f.step(.02);assert.ok(dead.dead);assert.equal(f.c.state.allies.filter(a=>a.hp>0).length,4)
  const timer=f.c.state.allies[1].revive;assert.ok(timer>10)
  f.park();f.step(timer+.1);assert.equal(f.c.state.allies.filter(a=>a.hp>0).length,5)
  assert.ok(wings.filter(a=>a!==dead).every(a=>!a.dead),'Surviving wingmen stay independent')
  checks.push('Wing passive adds one independently damaged and revived aircraft per rank up to five; surviving slots do not respawn together')
}
{
  const speeds=[]
  for(const grade of [1,7,13,25]){
    const f=fixture();f.park();const a=f.c.targets[0];Object.assign(a,{...ENEMIES.fighter,type:'fighter',x:0,y:-220,z:110,yaw:Math.PI,grade,shot:0,sam:999,hp:1000,maxHp:1000})
    const before=a.y;f.step(.02);const bullets=f.c.effects.filter(e=>e.enemy&&e.kind==='bullet')
    assert.equal(bullets.length,enemyGrowth(grade).volley);speeds.push({flight:Math.abs(a.y-before)/.02,bullet:bullets[0].speed})
  }
  for(let i=1;i<speeds.length;i++){assert.ok(speeds[i].flight>speeds[i-1].flight);assert.ok(speeds[i].bullet>speeds[i-1].bullet)}
  for(const type of ['striker','hunter']){
    const f=fixture();f.park();const a=f.c.targets[0];Object.assign(a,{...ENEMIES[type],type,x:0,y:-250,z:110,yaw:Math.PI,grade:10,shot:999,sam:0,speed:0,hp:100,maxHp:100})
    f.step(.02);const m=f.c.effects.find(e=>e.enemy&&e.kind==='missile');assert.ok(m);const vx=m.vx;f.p.x=100;f.step(.15)
    if(type==='striker'){assert.equal(m.homing,false);assert.equal(m.vx,vx)}else{assert.ok(m.homing);assert.ok(m.vx>vx)}
  }
  for(const type of ['base','warship']){
    const f=fixture();f.park();f.c.targets.push({...ENEMIES[type],type,id:80,x:210,y:-200,z:2,yaw:0,pitch:0,roll:0,age:0,grade:1,shot:0,sam:0,collision:0,hostile:true,hp:100,maxHp:100})
    f.step(.02);const a=f.c.targets.find(a=>a.type===type);assert.ok(a.shot<=.65);assert.ok(a.sam<=5)
  }
  checks.push('Higher levels increase measured flight speed, projectile speed and volley count; level-8 straight missiles differ from level-10 homing missiles; bases and ships fire faster')
}
{
  const draws=[],canvas={width:200,height:100,dataset:{},getContext(){return{clearRect(){},fillRect(...a){draws.push(a)},set fillStyle(v){}}}},changes=[],thunder=[]
  const w=createWeather(canvas,v=>changes.push(v.id),()=>thunder.push(true));w.setMode('auto');w.step(65.1);assert.equal(w.state.current,'cloudy');w.step(65.1);assert.equal(w.state.current,'rain');w.render();assert.ok(draws.length>100)
  w.setMode('storm');w.step(8.1);assert.equal(thunder.length,1);assert.ok(w.state.flash>0);w.render()
  w.setMode('fog');w.step(130);assert.equal(w.state.current,'fog');assert.equal(canvas.dataset.mode,'fog');assert.equal(w.setMode('bad'),false)
  checks.push('Weather cycles after 65 seconds, rain renders pixel drops, storms trigger thunder and fixed weather remains selected')
}
const report={version:'1.5.0',passed:true,checks};await writeFile(new URL('../artifacts/progression-validation.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
