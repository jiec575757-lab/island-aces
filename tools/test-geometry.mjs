import assert from 'node:assert/strict'
import { buildVoxelMesh } from '../src/voxel-mesh.js'
import { drawVoxelMesh } from '../src/voxel-renderer.js'
import { UNIT_MODELS } from '../src/unit-models.js'
import { createCombat, ENEMIES } from '../src/combat.js'
import { writeFile } from 'node:fs/promises'
const checks=[]
const cube=[];for(let z=0;z<4;z++)for(let y=0;y<4;y++)for(let x=0;x<4;x++)cube.push([x,y,z,[170,170,170]])
const mesh=buildVoxelMesh(cube);assert.equal(mesh.faces.length,6,'A solid block merges to exactly six faces without internal faces')
for(const [id,voxels]of Object.entries(UNIT_MODELS)){
  const m=buildVoxelMesh(voxels)
  assert.equal(new Set(m.faces.map(f=>f.normal.join(','))).size,6,id+' has top, underside and all four sides')
  assert.ok(m.bounds[2][1]-m.bounds[2][0]>=10,id+' has real height')
  assert.ok(m.faces.length<voxels.length*6)
}
checks.push('All 11 unit volumes have six-sided geometry and actual height; hidden faces are removed and coplanar faces merged')
const W=100,H=90,basis=[[1,0,0],[0,1,0],[0,0,1]],camera={x:0,y:0,z:0,cos:Math.cos(.7),sin:Math.sin(.7),q:.003,scale:9,tan:.65,cx:50,cy:56}
const draw=objects=>{const fb=new Uint32Array(W*H),zb=new Float32Array(W*H).fill(1e9);for(const o of objects)drawVoxelMesh(mesh,o,basis,1,camera,fb,zb,W,H);return fb}
const lit=draw([{x:0,y:0,z:0}]);assert.ok(new Set([...lit].filter(Boolean)).size>=3,'Top and side faces receive different lighting')
assert.deepEqual(draw([{x:0,y:0,z:0},{x:0,y:6,z:0}]),draw([{x:0,y:6,z:0},{x:0,y:0,z:0}]),'Depth occlusion is independent of draw order')
checks.push('Filled surfaces receive directional light and perspective depth occlusion works in either draw order')
const p={x:0,y:0,z:110,yaw:0,pitch:0,roll:0,speed:0},events=[]
const scene={get telemetry(){return {...p}},groundAt(){return 0},isLand(x){return x<60},restart(){},setCombat(){},setCombatFlight(){}}
const combat=createCombat(scene,(type,data)=>events.push({type,...data}),()=>.99,{autoFire:false}),step=n=>{for(let i=0;i<n;i++)combat.step(.02)}
combat.start();combat.targets.forEach(a=>Object.assign(a,{x:-600,y:0,speed:0,shot:999,sam:999}))
for(const enemy of [false,true]){
  combat.effects.push({kind:'missile',enemy,x:240,y:120,z:140,px:240,py:120,pz:140,vx:100,vy:0,vz:0,speed:100,damage:7,life:.03,maxLife:6})
  step(2)
  const event=events.at(-1);assert.equal(event.type,'detonate');assert.equal(event.reason,'timeout');assert.equal(event.x,242)
  assert.ok(combat.effects.some(e=>e.kind==='blast'&&e.x===242&&e.y===120&&e.z===140&&e.size===17))
}
assert.equal(combat.effects.filter(e=>e.kind==='missile').length,0)
const explosions=events.filter(e=>e.type==='detonate').length;step(10);assert.equal(events.filter(e=>e.type==='detonate').length,explosions,'Each expired missile explodes once')
combat.effects.push({kind:'missile',enemy:true,x:240,y:120,z:140,life:0,maxLife:6});step(1);assert.equal(events.filter(e=>e.type==='detonate').length,explosions,'Flare-cleared missiles do not explode')
checks.push('Enemy and friendly missed missiles detonate once at their final position on timeout; flares remain safe')
// Force level-ups through actual upgrade flow: both naval types must enter live encounters.
for(let i=0;i<19;i++){combat.awardXP(combat.state.xpNext);combat.chooseUpgrade(combat.state.choices[0].id)}
for(const type of ['gunboat','warship']){
  const ship=combat.targets.find(a=>a.type===type);assert.ok(ship,type+' spawns')
  assert.ok(ship.x>=60&&ship.z<3,'Ships spawn only on ocean at sea level')
  Object.assign(ship,{x:210,y:-120,z:2,shot:0,sam:0,yaw:0})
  const before={x:ship.x,y:ship.y};step(1)
  assert.ok(Math.hypot(ship.x-before.x,ship.y-before.y)>0,'Ship patrol moves')
  assert.ok(ship.z<3&&ship.x>=60,'Ship remains at sea level on water')
  assert.ok(combat.effects.some(e=>e.enemy&&e.kind==='bullet'),'Naval cannon fires')
  if(type==='warship')assert.ok(combat.effects.some(e=>e.enemy&&e.kind==='missile'),'Frigate SAM fires')
  assert.ok(ENEMIES[type].xp>ENEMIES.fighter.xp,'Naval enemies award extra XP')
}
const ship=combat.targets.find(a=>a.type==='warship');Object.assign(ship,{x:210,y:-120,z:2,shot:999,sam:999,hp:1,maxHp:65,speed:0})
combat.targets.filter(a=>a!==ship).forEach(a=>Object.assign(a,{x:650,y:200,shot:999,sam:999,speed:0}))
combat.effects.push({kind:'bullet',enemy:false,x:ship.x,y:ship.y,z:12,px:ship.x,py:ship.y,pz:12,vx:0,vy:0,vz:0,damage:100,life:1,maxLife:1})
step(1);assert.ok(ship.dead,'Naval hull accepts player fire');assert.ok(combat.state.kills>0);assert.ok(combat.state.xp>0||combat.state.selecting)
checks.push('Both sea enemies spawn, patrol, fire, accept hull hits and grant XP; frigate launches homing SAMs')
const report={version:'1.6.3',passed:true,checks};await writeFile(new URL('../artifacts/geometry-validation.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
