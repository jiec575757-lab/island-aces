import assert from 'node:assert/strict'
import { createCombat, ENEMIES } from '../src/combat.js'
import { UPGRADES, deriveStats } from '../src/upgrades.js'
import { UNIT_MODELS } from '../src/unit-models.js'
import { decodeJet } from '../src/jet-model.js'
import { createScene, DEFAULT_PARAMS } from '../src/scene.js'
import { flightCoordinates, tiltAxis } from '../src/mobile-controls.js'
import { writeFile, mkdir } from 'node:fs/promises'
await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true})
const checks=[]
assert.equal(decodeJet().reduce((n,s)=>n+s.filter(Boolean).length,0),2564)
for(const mesh of Object.values(UNIT_MODELS))assert.ok(mesh.length>50)
checks.push('Original v1.0 fighter preserved, four original replacement voxel props')
{
 const s=createScene({...DEFAULT_PARAMS,intro:false,stunts:false});s.resize(427,267);s.setCombatFlight({speed:1,agility:1.65});s.setKeys(1,0,false,0)
 for(let i=0;i<15;i++)s.step(.02);assert.ok(s.telemetry.turn>1.2)
 s.setKeys(0,0,false,0);for(let i=0;i<20;i++)s.step(.02);assert.ok(Math.abs(s.telemetry.turn)<.04)
 checks.push('Combat steering reaches full turn promptly and releases smoothly without long drift')
}
function fixture(){
 const p={x:0,y:0,z:110,yaw:0,pitch:0,roll:0,speed:0,rolling:false},events=[];let wanted='rapid',flight
 const scene={get telemetry(){return {...p}},groundAt(){return 0},isLand(){return true},roll(){if(p.rolling)return false;p.rolling=true;return true},restart(){p.rolling=false},setCombat(){},setCombatFlight(f){flight=f}}
 const c=createCombat(scene,(type,data)=>events.push({type,...data}),()=> (UPGRADES.findIndex(u=>u.id===wanted)+.1)/UPGRADES.length,{autoFire:false})
 const tick=s=>{for(let i=0;i<Math.round(s/.02);i++)c.step(.02)}
 const park=()=>c.targets.forEach((a,i)=>{if(a.hostile)Object.assign(a,{x:650+i*3,y:0,z:110,speed:0,shot:999,sam:999})})
 const grant=id=>{wanted=id;c.awardXP(c.state.xpNext-c.state.xp);assert.ok(c.state.choices.some(u=>u.id===id));assert.equal(c.chooseUpgrade(id),true);park()}
 c.start()
 return{c,p,events,tick,park,grant,get flight(){return flight}}
}
{
 const rect={left:0,top:0,right:390,bottom:844}
 assert.deepEqual(flightCoordinates(340,170,rect,true),{x:170,y:50})
 assert.deepEqual(flightCoordinates(170,50,rect,false),{x:170,y:50})
 assert.ok(tiltAxis(20,0,90)>19.9&&tiltAxis(-20,0,90)<-19.9)
 assert.ok(tiltAxis(20,0,270)<-19.9);assert.equal(tiltAxis(0,15,0),15)
 checks.push('Rotated phone pointer transform and tilt axes work in both landscape orientations')
}
{
 const p={x:0,y:0,z:110,yaw:0,pitch:0,speed:0},scene={get telemetry(){return p},groundAt(){return 0},setCombat(){},setCombatFlight(){}}
 const c=createCombat(scene);c.start();c.targets.forEach(a=>Object.assign(a,{x:600,y:-600,speed:0,shot:999,sam:999}));c.step(.02)
 assert.equal(c.state.firing,true);assert.ok(c.state.ammo<60&&c.effects.some(e=>e.kind==='bullet'&&!e.enemy))
 c.setFiring(false);assert.equal(c.state.firing,true)
 c.awardXP(25);assert.equal(c.state.firing,false);const time=c.state.elapsed;c.step(.05);assert.equal(c.state.elapsed,time)
 c.chooseUpgrade(c.state.choices[0].id);assert.equal(c.state.firing,true)
 checks.push('Automatic cannon needs no input, survives release, freezes for upgrade and resumes after choice')
}
{
 const f=fixture(),angles=f.c.targets.map(a=>(Math.atan2(a.x,-a.y)+Math.PI*2)%(Math.PI*2)).sort((a,b)=>a-b)
 assert.equal(angles.length,4)
 const gaps=angles.map((v,i)=>(angles[(i+1)%4]+(i===3?Math.PI*2:0))-v)
 assert.ok(Math.min(...gaps)>1.3&&Math.max(...gaps)<1.85)
 for(const a of f.c.targets){const to=Math.atan2(-a.x,a.y);assert.ok(Math.abs(to-a.yaw)<.001)}
 checks.push('Four actual spawn positions surround player and all face inward')
}
{
 const f=fixture();f.park();f.c.awardXP(25);assert.equal(f.c.state.level,2);assert.equal(f.c.state.choices.length,3);assert.equal(new Set(f.c.state.choices.map(u=>u.id)).size,3)
 const time=f.c.state.elapsed,choices=f.c.state.choices;f.tick(2);assert.equal(f.c.state.elapsed,time);assert.deepEqual(f.c.state.choices,choices);assert.equal(f.c.chooseUpgrade('invalid'),false)
 f.c.chooseUpgrade(choices[0].id);assert.equal(f.c.state.enemies,5);assert.ok(f.c.targets.every(a=>a.grade===2))
 f.c.awardXP(500);const pending=f.c.state.pending;assert.ok(pending>3);for(let i=0;i<pending;i++)f.c.chooseUpgrade(f.c.state.choices[0].id)
 assert.equal(f.c.state.selecting,false);assert.equal(f.c.state.pending,0)
 checks.push('Fixed unique three choices, full pause, invalid selection rejected, XP queue and level scaling')
}
{
 const f=fixture();f.park();f.tick(2);assert.equal(f.c.requestRoll(),true);assert.equal(f.c.damage(30),false);f.tick(.5);assert.equal(f.p.rolling,true);assert.equal(f.c.damage(30),true);assert.equal(f.c.state.hp,70)
 f.p.rolling=false;assert.equal(f.c.requestRoll(),false);f.tick(2.4);assert.equal(f.c.requestRoll(),true)
 checks.push('Timed roll protection is independent from animation and enforced by cooldown')
}
{
 const f=fixture();f.park();const a=f.c.targets[0];Object.assign(a,{x:0,y:-120,z:110,hp:1e6,maxHp:1e6,speed:0,shot:999});f.c.setFiring(true);f.tick(30)
 assert.ok(f.c.state.ammo<2&&a.hp<1e6);f.c.setFiring(false);f.tick(4);assert.ok(f.c.state.ammo>26&&f.c.state.ammo<=60)
 f.c.damage(20);const hp=f.c.state.hp;f.tick(7);assert.equal(f.c.state.hp,hp)
 checks.push('Actual cannon hits, sustained ammo depletion, automatic refill, no default health regeneration')
}
{
 const f=fixture();f.park();f.grant('shield');f.tick(2);f.c.damage(40);assert.equal(f.c.state.hp,90);assert.equal(f.c.state.shield,0);f.tick(5);assert.equal(f.c.state.shield,0);f.tick(2);assert.ok(f.c.state.shield>3)
 f.grant('regen');const before=f.c.state.hp;f.tick(1);assert.ok(f.c.state.hp>before+.45);f.grant('roll');f.grant('roll');assert.equal(f.c.state.ranks.roll,2);assert.ok(f.c.state.stats.rollDuration>.7)
 checks.push('Shield absorption and 6-second recharge delay, unlock health repair, repeatable upgrades')
}
{
 const f=fixture();f.park();for(const id of ['rapid','speed','damage','crit','critDamage','radar'])f.grant(id)
 const s=f.c.state.stats;assert.ok(s.fireRate>10.5&&s.ammoRegen>7&&s.speed>1&&s.damage>1&&s.critChance>0&&s.critMultiplier>1.6&&s.radarRange>500)
 assert.equal(f.flight.speed,s.speed);assert.ok(f.flight.agility>1.65)
 checks.push('Fire rate, flight speed, cannon damage, critical stats and radar growth apply')
}
for(const [id,kind]of [['missile','missile'],['drone','drone'],['secondary','bullet']]){
 const f=fixture();f.park();f.grant(id);const a=f.c.targets[0];Object.assign(a,{x:60,y:-160,z:110,hp:1000,maxHp:1000,speed:0});f.tick(1.1)
 assert.ok(f.c.effects.some(e=>e.kind===kind&&!e.enemy),id+' launches');assert.equal(f.c.state.ammo,60);f.tick(2);assert.ok(a.hp<1000,id+' hits')
 checks.push(id+' auto-launches and hits without consuming cannon ammo')
}
{
 const f=fixture();f.park();f.grant('flare');f.c.effects.push({kind:'missile',enemy:true,x:0,y:-300,z:110,px:0,py:-300,pz:110,vx:0,vy:0,vz:0,speed:0,damage:4,life:10,maxLife:10});f.tick(1.1);assert.equal(f.c.effects.filter(e=>e.enemy).length,0)
 f.grant('cloak');f.tick(1.1);assert.ok(f.c.state.cloak>0);const a=f.c.targets[0];Object.assign(a,{x:0,y:-180,z:110,shot:0,sam:0,yaw:Math.PI,speed:0});f.tick(.1);assert.equal(f.c.effects.filter(e=>e.enemy).length,0);f.tick(3.2);assert.equal(f.c.state.cloak,0)
 checks.push('Flares clear enemy projectiles; cloak prevents targeting and expires')
}
{
 const f=fixture();f.park();f.grant('wingman');f.tick(.1);assert.ok(f.c.state.ally);const a=f.c.targets[0];Object.assign(a,{x:20,y:-140,z:110,hp:100,maxHp:100,speed:0});f.tick(1.5);assert.ok(a.hp<100&&a.hp>98.5,'Wingman must contribute low supporting damage')
 const ally=f.c.targets.find(a=>a.type==='ally');f.c.effects.push({kind:'bullet',enemy:true,x:ally.x,y:ally.y,z:ally.z,px:ally.x,py:ally.y,pz:ally.z,vx:0,vy:0,vz:0,damage:1000,life:1,maxLife:1});f.tick(.02);assert.equal(f.c.state.ally,null);f.park();f.tick(23);assert.ok(f.c.state.ally)
 checks.push('Reduced allied damage measured through real hits; ally HP, death and automatic resurrection')
}
{
 const f=fixture();f.park();f.grant('ground');const a=f.c.targets[0];Object.assign(a,{x:0,y:-180,z:110,hp:100,maxHp:100,speed:0});f.tick(1.1);assert.ok(f.c.targets.some(a=>a.type==='support'));f.tick(2);assert.ok(a.hp<100&&a.hp>98,'Ground support damage stays modest');f.tick(7);assert.equal(f.c.targets.filter(a=>a.type==='support').length,0)
 checks.push('Reduced allied ground support deploys, hits and expires')
}
{
 const f=fixture();f.park();for(let i=0;i<6;i++)f.grant('shield');const types=new Set(f.c.targets.filter(a=>a.hostile).map(a=>a.type));for(const type of Object.keys(ENEMIES))assert.ok(types.has(type),type)
 const base=f.c.targets.find(a=>a.type==='base');Object.assign(base,{x:0,y:-230,z:2,shot:0,sam:0});f.tick(.02)
 const bullets=f.c.effects.filter(e=>e.enemy),cannon=bullets.find(e=>e.kind==='bullet'),sam=bullets.find(e=>e.kind==='missile')
 assert.ok(cannon&&sam);assert.ok(cannon.damage<6);assert.equal(sam.damage,7);assert.ok(base.shot>.8&&base.sam>=6.9)
 f.p.x=100;f.tick(.2);assert.ok(sam.vx>0);assert.ok(sam.pitch>0&&Number.isFinite(sam.pitch))
 checks.push('All elites spawn, low-damage AA cannon and SAM fire with longer intervals; live homing')
}
{
 const f=fixture();f.park();f.grant('vampire');f.tick(2);f.c.damage(20);f.tick(.5);const a=f.c.targets[0];Object.assign(a,{x:0,y:-45,z:110,hp:.1,maxHp:3,speed:0});f.c.setFiring(true);f.tick(.2);assert.ok(f.c.state.kills>=1);assert.equal(f.c.state.hp,81.5);assert.ok(f.c.state.xp>0)
 f.park();f.tick(3);f.c.damage(9999);assert.equal(f.c.state.over,true);const time=f.c.state.elapsed;f.tick(2);assert.equal(f.c.state.elapsed,time);f.c.stop();assert.equal(f.c.targets.length,0);assert.equal(f.c.effects.length,0);f.c.start();assert.equal(f.c.state.hp,100);assert.equal(f.c.state.ammo,60);assert.equal(f.c.state.level,1);assert.deepEqual(f.c.state.ranks,{})
 checks.push('Kill healing and XP, death freeze, restart and mode cleanup')
}
{
 const f=fixture();f.park();f.tick(2);const a=f.c.targets[0];Object.assign(a,{x:0,y:0,z:110,hp:100,maxHp:100});f.tick(.02);assert.equal(f.c.state.hp,78);assert.equal(a.hp,98);f.tick(.2);assert.equal(f.c.state.hp,78)
 checks.push('Actual collision damage with contact cooldown')
}
{
 const f=fixture();for(const u of UPGRADES)f.grant(u.id)
 for(let t=0;t<12000;t++){if(f.c.state.over)f.c.start();while(f.c.state.selecting)f.c.chooseUpgrade(f.c.state.choices[0].id);f.p.y-=1.4;f.p.yaw=Math.sin(t*.001);f.p.rolling=false;if(t%160===0)f.c.requestRoll();f.c.setFiring(true);f.c.step(.02);for(const key of ['hp','shield','ammo','elapsed','xp'])assert.ok(Number.isFinite(f.c.state[key]),key);assert.ok(f.c.targets.length<40&&f.c.effects.length<1000)}
 checks.push('Four-minute mixed-system simulation has bounded actors and finite state')
}
const report={passed:true,baseVersion:'1.0.0',upgradeCount:UPGRADES.length,checks};assert.equal(UPGRADES.length,17);await writeFile(new URL('../artifacts/combat-validation.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
