import { UPGRADES, upgradeById, deriveStats, xpRequired } from './upgrades.js?v=1.6.2'
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), angle=a=>a-Math.PI*2*Math.round(a/(Math.PI*2))
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)
const segment=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/(dx*dx+dy*dy+dz*dz||1),0,1);return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t,p.z-a.z-dz*t)}
export const ENEMIES={
  fighter:{name:'巡逻战机',hp:3,speed:68,damage:8,xp:10,scale:1,model:'fighter'},
  fast:{name:'疾风精英',hp:5,speed:105,damage:5,xp:22,scale:.82,elite:true,model:'fast'},
  tank:{name:'重甲精英',hp:16,speed:45,damage:11,xp:30,scale:1.18,elite:true,model:'tank'},
  striker:{name:'火箭突击机',hp:7,speed:65,damage:8,xp:26,scale:1,elite:true,model:'hunter'},
  hunter:{name:'猎手精英',hp:9,speed:63,damage:10,xp:30,scale:1,elite:true,model:'hunter'},
  drone:{name:'自爆无人机',hp:2,speed:96,damage:16,xp:16,scale:.7,elite:true,model:'drone'},
  base:{name:'防空基地',hp:30,speed:0,damage:4,xp:45,scale:1,elite:true,model:'base',ground:true},
  gunboat:{name:'海狼快速炮艇',hp:22,speed:24,damage:4,xp:38,scale:1,elite:true,model:'gunboat',marine:true,hitRadius:25},
  warship:{name:'苍礁导弹护卫舰',hp:65,speed:13,damage:5,xp:85,scale:1,elite:true,model:'warship',marine:true,hitRadius:42},
}
// Stronger units unlock by level; early encounters stay readable for new players.
export const SPAWN_UNLOCKS={fast:3,tank:5,striker:8,hunter:10,drone:12,gunboat:14,base:16,warship:20}
export const ENEMY_LIMITS={tank:3}
const TYPES_BY_STRENGTH=['fighter','fast','tank','striker','hunter','drone','gunboat','base','warship']
const unlockedTypes=level=>TYPES_BY_STRENGTH.filter(type=>type==='fighter'||SPAWN_UNLOCKS[type]<=level)
export const enemyGrowth=level=>({move:Math.min(2,1+.025*(level-1)),projectile:Math.min(1.9,1+.025*(level-1)),volley:Math.min(5,1+Math.floor((level-1)/6))})
export function createCombat(scene,onEvent=()=>{},random=Math.random,{autoFire=true}={}){
  let S={},actors=[],effects=[],ranks={},stats=deriveStats(),timers={},sequence=0,offers=[],pending=0,refreshes=0,wingSlots=[],nextWave=0,manualFire=false
  const livingWings=()=>wingSlots.map(s=>s.actor).filter(a=>a&&!a.dead)
  let best=0;try{best=Number(localStorage.getItem('island-aces-best')||0)}catch{}
  const emit=(type,data={})=>onEvent(type,data)
  const sync=()=>{updateFiring();scene.setCombat(actors,effects);scene.setCombatFlight?.(S.active?{speed:stats.speed,agility:stats.agility,shield:S.shield>0,invulnerable:S.invulnerable>0,cloaked:S.cloak>0}:null)}
  const blast=(p,size=6,kind='blast')=>effects.push({kind,x:p.x,y:p.y,z:p.z,size,life:.48,maxLife:.48})
  const save=()=>{if(S.score>best){best=S.score;try{localStorage.setItem('island-aces-best',String(best))}catch{}}}
  function landPos(p,min=130,bearing=p.yaw){
    for(let i=0;i<160;i++){const a=bearing+i*2.399,d=min+(i%10)*32,x=p.x+Math.sin(a)*d,y=p.y-Math.cos(a)*d
      if((!scene.isLand||scene.isLand(x,y))&&!actors.some(a=>a.ground&&!a.dead&&Math.hypot(a.x-x,a.y-y)<65))return{x,y,z:scene.groundAt(x,y)+2}}
    return null
  }
  function clearWater(x,y,r=55,yaw=0){
    if(!scene.isLand)return true
    const sn=Math.sin(yaw),cs=Math.cos(yaw)
    for(const ahead of [-r,0,r])for(const side of [-18,0,18])if(scene.isLand(x+sn*ahead+cs*side,y-cs*ahead+sn*side))return false
    return true
  }
  function seaPos(p,min,bearing,r){
    for(let i=0;i<180;i++){
      const a=bearing+i*2.399,d=min+(i%12)*35,x=p.x+Math.sin(a)*d,y=p.y-Math.cos(a)*d
      if(clearWater(x,y,r,a)&&!actors.some(v=>v.marine&&!v.dead&&Math.hypot(v.x-x,v.y-y)<110))return{x,y,z:2}
    }
    return null
  }
  function spawn(type='fighter',bearing,distance=185+(sequence%5)*24,replacing=null){
    // Apply the same cap to waves and level-up reinforcements; relocation keeps its own slot.
    if(ENEMY_LIMITS[type]&&actors.filter(a=>a!==replacing&&a.hostile&&!a.dead&&a.type===type).length>=ENEMY_LIMITS[type])type='fighter'
    const p=scene.telemetry,id=sequence++,def=ENEMIES[type],a=bearing??p.yaw+id*2.399
    let pos={x:p.x+Math.sin(a)*distance,y:p.y-Math.cos(a)*distance,z:p.z+((id%3)-1)*12}
    if(def.ground){pos=landPos(p,Math.max(130,distance),a);if(!pos)return null}
    if(def.marine){pos=seaPos(p,Math.max(210,distance),a,type==='gunboat'?32:55);if(!pos)return null}
    if(!def.ground&&!def.marine)pos.z=Math.max(scene.groundAt(pos.x,pos.y)+18,pos.z)
    const grade=S.level,hp=def.hp
    return{...pos,id,type,...def,maxHp:hp,hp,grade,hostile:true,yaw:Math.atan2(p.x-pos.x,-(p.y-pos.y)),roll:0,pitch:0,stunt:-1,stuntDelay:0,shot:2.5+id%3*.6,sam:5+id%2,age:0,collision:0,dead:false}
  }
  function makeWave(){
    const p=scene.telemetry,count=Math.min(18,4+(S.level-1)+(S.wave-1)),offset=S.wave*.31,spread=Math.PI*2/count
    for(let i=0;i<count;i++){
      const pool=unlockedTypes(S.level),type=pool.length===1||i%3===0?'fighter':pool[1+(i+S.wave)%(pool.length-1)]
      const a=spawn(type,p.yaw+offset+i*spread+(i%2?.08:-.08),185+(i*43%4)*27);if(a){a.sector=i;actors.push(a)}
    }
    nextWave=0;emit('wave',{wave:S.wave,level:S.level})
  }
  function start(){
    actors=[];effects=[];ranks={};stats=deriveStats();timers={};sequence=0;offers=[];pending=0;refreshes=0;wingSlots=[];nextWave=0;manualFire=false
    S={active:true,over:false,hp:100,shield:0,score:0,kills:0,wave:1,level:1,xp:0,elapsed:0,firing:false,shotClock:0,ammo:60,recovery:0,grace:1.8,invulnerable:0,rollCooldown:0,cloak:0}
    scene.release?.();scene.restart?.();makeWave();sync()
  }
  function stop(){save();S.active=false;S.over=false;S.firing=false;actors=[];effects=[];offers=[];pending=0;refreshes=0;wingSlots=[];sync()}
  function offer(exclude=[]){
    if(!pending||offers.length)return
    if(!exclude.length)refreshes=2
    const pool=UPGRADES.filter(u=>!exclude.includes(u.id));offers=[]
    for(let i=0;i<3;i++)offers.push(pool.splice(Math.floor(random()*pool.length),1)[0].id)
    S.firing=false;emit('upgrade',{level:S.level,choices:offers.slice()})
  }
  function refreshUpgrades(){
    if(!S.active||S.over||!pending||!offers.length||refreshes<=0)return false
    const previous=offers;refreshes--;offers=[];offer(previous);return true
  }
  function awardXP(value){
    if(!S.active||S.over||value<=0)return
    S.xp+=value
    while(S.xp>=xpRequired(S.level)){S.xp-=xpRequired(S.level);S.level++;pending++}
    offer()
  }
  function chooseUpgrade(id){
    if(!offers.includes(id)||!S.active||S.over)return false
    ranks[id]=(ranks[id]||0)+1;stats=deriveStats(ranks);pending--;offers=[]
    if(id==='shield')S.shield=Math.min(stats.shieldMax,S.shield+30)
    if(['missile','flare','drone','ground','cloak','secondary'].includes(id))timers[id]=Math.min(timers[id]??1,1)
    if(id==='wingman')for(const ally of livingWings()){ally.maxHp=stats.wingHp;ally.hp=Math.min(ally.maxHp,ally.hp+15)}
    const grade=S.level
    for(const a of actors)if(a.hostile&&a.grade<grade)a.grade=grade
    const desired=Math.min(18,4+(S.level-1)+(S.wave-1)),count=actors.filter(a=>a.hostile&&!a.dead).length
    if(count===0&&!nextWave){nextWave=3;emit('clear',{wave:S.wave})}
    if(count>0)for(let i=count;i<desired;i++){const pool=unlockedTypes(S.level),type=pool.length===1?pool[0]:pool[1+(i+sequence)%(pool.length-1)],a=spawn(type);if(a)actors.push(a)}
    // Introduce each new unlocked role during the level-up, even at the actor cap.
    for(const [type,level]of Object.entries(SPAWN_UNLOCKS))if(S.level>=level&&!actors.some(a=>a.type===type&&!a.dead)){
      const a=spawn(type);if(!a)continue
      const hostiles=actors.filter(v=>v.hostile&&!v.dead)
      if(hostiles.length>=desired){const old=hostiles.find(v=>v.type==='fighter')||hostiles.find(v=>hostiles.filter(t=>t.type===v.type).length>1);if(!old)continue;old.dead=true}
      actors.push(a);emit('enemy-unlock',{name:a.name,level})
    }
    emit('chosen',{id,rank:ranks[id]});offer();sync();return true
  }
  function damage(amount){
    if(!S.active||S.over||offers.length||S.grace>0||S.invulnerable>0)return false
    const absorbed=Math.min(S.shield,amount);S.shield-=absorbed;S.hp=Math.max(0,S.hp-(amount-absorbed));S.recovery=0;S.grace=.45
    emit('hit',{hp:S.hp,shield:S.shield})
    if(S.hp<=0){S.over=true;S.firing=false;save();blast(scene.telemetry,20);emit('over',{...S,best})}
    return true
  }
  function kill(a,credit=true){
    if(a.dead)return;a.dead=true;blast(a,a.marine?32:a.ground?23:12)
    if(!credit)return
    S.kills++;S.score+=Math.round(a.xp*10*(1+.06*(a.grade-1)));S.hp=Math.min(100,S.hp+stats.killHeal);save()
    const xp=Math.round(a.xp*(1+.12*(a.grade-1)))
    emit('kill',{score:S.score,kills:S.kills,name:a.name,xp});awardXP(xp)
  }
  function hit(a,amount,canCrit=true){if(a.dead)return;const critical=canCrit&&random()<stats.critChance;a.hp-=amount*(critical?stats.critMultiplier:1);blast(a,critical?4:2);if(a.hp<=0)kill(a)}
  function allyDamage(ally,amount){if(!ally||ally.dead)return;ally.hp=Math.max(0,ally.hp-amount);if(ally.hp<=0){ally.dead=true;blast(ally,9);wingSlots[ally.slot].revive=stats.wingRevive;emit('support',{text:`僚机 ${ally.slot+1} 被击落 / 正在重建`})}}
  function nearest(p,range=stats.autoRange,cone=Math.PI){
    let target=null,best=range
    for(const a of actors){if(!a.hostile||a.dead||a.hp<=0)continue;const d=dist(p,a),bearing=Math.atan2(a.x-p.x,-(a.y-p.y));if(d<best&&Math.abs(angle(bearing-p.yaw))<=cone){target=a;best=d}}
    return target
  }
  function updateFiring(){
    if(!S.active||S.over||offers.length){S.firing=false;return null}
    const target=nearest(scene.telemetry,stats.cannonRange,stats.cannonCone)
    S.firing=autoFire?!!target:manualFire
    return target
  }
  function projectile(p,target,{enemy=false,kind='bullet',speed=450,damage=stats.damage,life=2.4,homing=true,offset=0}={}){
    let yaw=p.yaw,pitch=p.pitch*.65||0
    if(target){const travel=kind==='bullet'?dist(p,target)/speed*.7:0;const dx=target.x+Math.sin(target.yaw||0)*(target.speed||0)*travel-p.x,dy=target.y-Math.cos(target.yaw||0)*(target.speed||0)*travel-p.y;yaw=Math.atan2(dx,-dy);pitch=Math.atan2(target.z-p.z,Math.hypot(dx,dy))}
    yaw+=offset
    const cp=Math.cos(pitch),ox=Math.sin(yaw)*cp,oy=-Math.cos(yaw)*cp,oz=Math.sin(pitch),off=p.ground||p.marine?4:13
    effects.push({kind,enemy,damage,target,homing,playerTarget:enemy&&target?.type!=='ally',speed,yaw,pitch,x:p.x+ox*off,y:p.y+oy*off,z:p.z+oz*off,px:p.x+ox*off,py:p.y+oy*off,pz:p.z+oz*off,vx:ox*speed,vy:oy*speed,vz:oz*speed,life,maxLife:life})
  }
  function requestRoll(){if(!S.active||S.over||offers.length||S.rollCooldown>0||scene.telemetry.rolling)return false;if(scene.roll?.()===false)return false;S.invulnerable=stats.rollDuration;S.rollCooldown=stats.rollCooldown;emit('roll');sync();return true}
  function periodic(id,interval,action){if(!ranks[id])return;timers[id]=(timers[id]??1)-S.dt;if(timers[id]<=0&&action()!==false)timers[id]=interval}
  function support(dt,p){
    for(let i=0;i<stats.wingCount;i++){
      const slot=wingSlots[i]??=( {actor:null,revive:0} ),side=i%2? -1:1,row=Math.floor(i/2),across=side*(28+row*18),behind=18+row*22
      const x=p.x+Math.cos(p.yaw)*across-Math.sin(p.yaw)*behind,y=p.y+Math.sin(p.yaw)*across+Math.cos(p.yaw)*behind
      let ally=slot.actor
      if(!ally||ally.dead){slot.revive-=dt;if(slot.revive<=0){ally=slot.actor={x,y,z:p.z-3-row*2,yaw:p.yaw,roll:0,pitch:0,stunt:-1,stuntDelay:0,type:'ally',model:'ally',slot:i,hostile:false,scale:.62,hp:stats.wingHp,maxHp:stats.wingHp,shot:i*.08};actors.push(ally);emit('support',{text:`守望僚机 ${i+1} 已就位`})}}
      else{
        ally.x+=(x-ally.x)*Math.min(1,dt*3);ally.y+=(y-ally.y)*Math.min(1,dt*3);ally.z+=(p.z-3-row*2-ally.z)*Math.min(1,dt*2);ally.yaw=p.yaw;ally.roll=p.roll;ally.pitch=p.pitch;ally.shot-=dt
        const t=nearest(ally);if(t&&ally.shot<=0){projectile(ally,t,{damage:stats.wingDamage});ally.shot=.42/(1+.1*ranks.wingman)}
        for(const a of actors)if(a.hostile&&!a.ground&&!a.marine&&!a.dead&&dist(a,ally)<13&&(a.collision||0)<=0){allyDamage(ally,18);a.collision=1;hit(a,1.5,false)}
      }
    }
    periodic('missile',stats.missileInterval,()=>{const t=nearest(p);if(!t)return false;projectile(p,t,{kind:'missile',speed:190,damage:stats.missileDamage,life:7})})
    periodic('secondary',stats.secondaryInterval,()=>{const t=nearest(p);if(!t)return false;projectile(p,t,{damage:stats.damage*stats.secondaryDamage,speed:490})})
    periodic('drone',stats.droneInterval,()=>{const t=nearest(p);if(!t)return false;projectile({...p,x:p.x+3},t,{kind:'drone',speed:130,damage:stats.droneDamage,life:9})})
    periodic('flare',stats.flareInterval,()=>{for(const e of effects)if(e.enemy)e.life=0;for(const a of actors)if(a.hostile&&a.type==='drone'&&!a.dead){blast(a,8);a.dead=true}blast(p,90,'flare');emit('ability',{text:'干扰弹 / 敌方弹幕已清空'})})
    periodic('cloak',stats.cloakInterval,()=>{S.cloak=stats.cloakDuration;emit('ability',{text:'光学隐形 / 敌人失去锁定'})})
    periodic('ground',stats.groundInterval,()=>{const pos=landPos(p,70);if(!pos)return false;actors.push({...pos,type:'support',model:'support',ground:true,hostile:false,yaw:p.yaw,life:stats.groundDuration,shot:0,hp:1,maxHp:1});emit('support',{text:'地面支援已部署'})})
  }
  function step(dt){
    if(!S.active||S.over||offers.length)return
    dt=clamp(dt,0,.05);S.dt=dt;S.elapsed+=dt;S.recovery+=dt
    for(const key of ['grace','invulnerable','rollCooldown','cloak'])S[key]=Math.max(0,S[key]-dt)
    S.shotClock=Math.max(-dt,S.shotClock-dt);S.ammo=Math.min(stats.ammoMax,S.ammo+stats.ammoRegen*dt);S.hp=Math.min(100,S.hp+stats.regen*dt)
    if(S.recovery>=6)S.shield=Math.min(stats.shieldMax,S.shield+stats.shieldRegen*dt)
    const p=scene.telemetry
    const cannonTarget=updateFiring()
    if(S.firing&&S.shotClock<=0&&S.ammo>=1){projectile(p,cannonTarget,{speed:430+p.speed*.15});S.ammo--;S.shotClock+=1/stats.fireRate;emit('shot')}
    support(dt,p)
    for(const a of actors){
      if(a.dead)continue
      if(!a.hostile){
        if(a.ground){a.life-=dt;a.shot-=dt;if(a.life<=0){a.dead=true;continue}const t=nearest(a,stats.autoRange+200);if(t&&a.shot<=0){projectile({...a,z:a.z+8},t,{kind:'missile',speed:240,damage:stats.groundDamage,life:5});a.shot=1.2}}
        continue
      }
      a.age+=dt;a.shot-=dt;a.sam-=dt;a.collision=Math.max(0,a.collision-dt)
      const target=S.cloak>0?(livingWings()[0]||null):p,dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy),growth=enemyGrowth(a.grade)
      if(d>(a.marine?1400:950)){const n=spawn(a.type,undefined,undefined,a);if(n)Object.assign(a,n,{hp:a.hp,maxHp:a.maxHp});continue}
      let desired=target?Math.atan2(target.x-a.x,-(target.y-a.y)):a.yaw+.35
      if(target&&!a.ground&&!a.marine&&a.type!=='drone'){
        // Each fighter has a distinct pass lane. Separation prevents a train of identical pursuers.
        const side=a.id%2?1:-1,lane=24+(a.id%4)*13
        let tx=target.x+Math.cos(target.yaw||0)*side*lane,ty=target.y+Math.sin(target.yaw||0)*side*lane
        for(const other of actors)if(other!==a&&other.hostile&&!other.ground&&!other.marine&&!other.dead){const sx=a.x-other.x,sy=a.y-other.y,dd=Math.hypot(sx,sy);if(dd>0&&dd<58){tx+=sx/dd*(58-dd)*2;ty+=sy/dd*(58-dd)*2}}
        desired=Math.atan2(tx-a.x,-(ty-a.y));if(d<58)desired+=side*.9
      }
      const delta=angle(desired-a.yaw),turn=clamp(delta,-(a.type==='drone'?2.1:1),a.type==='drone'?2.1:1)
      if(a.marine){
        // Ships patrol on water; aim their weapons independently of their course.
        a.yaw+=Math.sin(a.age*.14+a.id)*dt*.13
        const speed=a.speed*growth.move,step=speed*dt,nx=a.x+Math.sin(a.yaw)*step,ny=a.y-Math.cos(a.yaw)*step,r=a.type==='warship'?55:32
        if(clearWater(nx,ny,r,a.yaw)){a.x=nx;a.y=ny}else a.yaw+=dt*1.1
        a.z=2+Math.sin(a.age*1.1+a.id)*.3;a.roll=Math.sin(a.age*.7)*.018;a.pitch=Math.sin(a.age*.9)*.012
      }else{a.yaw+=turn*dt;a.roll+=(turn*.65-a.roll)*Math.min(1,dt*4)}
      if(!a.ground&&!a.marine){const speed=a.speed*growth.move;a.x+=Math.sin(a.yaw)*speed*dt;a.y-=Math.cos(a.yaw)*speed*dt;const altitude=Math.max(scene.groundAt(a.x,a.y)+14,(target?.z??p.z)+Math.sin(a.age*.5+a.id)*8);a.pitch=clamp((altitude-a.z)*.012,-.35,.35);a.z+=(altitude-a.z)*Math.min(1,dt*(a.type==='drone'?1.7:.75))}
      else if(a.ground){a.z=scene.groundAt(a.x,a.y)+2;a.roll=0;a.pitch=0}
      if(target&&a.type!=='drone'&&dist(a,target)<(a.marine?700:a.ground?600:360)){
        if(a.shot<=0&&(a.ground||a.marine||Math.abs(delta)<.34)){
          for(let i=0;i<growth.volley;i++)projectile({...a,z:a.z+(a.marine?16:a.ground?18:0)},target,{enemy:true,speed:(a.ground||a.marine?220:200)*growth.projectile,damage:a.damage,life:3.6,offset:(i-(growth.volley-1)/2)*.115})
          a.shot=Math.max(.42,(a.marine?(a.type==='warship'?.65:.8):a.ground?.5:a.type==='fast'?2.8:2.2)/(1+.025*(a.grade-1)))
        }
        if((a.type==='striker'||a.type==='hunter'||a.ground||a.type==='warship')&&a.sam<=0){projectile({...a,z:a.z+(a.marine?20:a.ground?18:0)},target,{enemy:true,kind:'missile',homing:a.type!=='striker',speed:(a.ground||a.marine?130:145)*growth.projectile,damage:a.ground||a.marine?7:10,life:6});a.sam=a.marine?5:a.ground?4:8}
      }
      if(!a.ground&&!a.marine&&dist(a,p)<(a.type==='drone'?13:15)&&a.collision<=0){if(a.type==='drone'){damage(a.damage);kill(a,false)}else{const got=damage(22);a.collision=1;if(got)hit(a,2,false)}}
      if(a.marine&&p.z<a.z+30&&Math.hypot(p.x-a.x,p.y-a.y)<a.hitRadius&&a.collision<=0){damage(22);a.collision=1}
      if(S.over||offers.length)break
    }
    if(!S.over&&!offers.length)for(const e of [...effects]){
      if(e.life<=0)continue // A flare removes ordnance without detonating it.
      e.life-=dt
      if(e.life<=0){
        if(e.kind==='missile'||e.kind==='drone'){blast(e,e.kind==='missile'?17:20);emit('detonate',{kind:e.kind,reason:'timeout',x:e.x,y:e.y,z:e.z})}
        continue
      }
      if(!['bullet','missile','drone'].includes(e.kind))continue
      e.px=e.x;e.py=e.y;e.pz=e.z
      if(e.kind!=='bullet'){
        if(e.playerTarget)e.target=S.cloak>0?null:p
        if(e.target?.dead)e.target=e.enemy?(S.cloak<=0?p:livingWings()[0]):nearest(e)
        const t=e.target;if(t&&e.homing!==false){const d=dist(e,t)||1,blend=Math.min(1,dt*(e.kind==='drone'?3.5:2.8));e.vx+=((t.x-e.x)/d*e.speed-e.vx)*blend;e.vy+=((t.y-e.y)/d*e.speed-e.vy)*blend;e.vz+=((t.z-e.z)/d*e.speed-e.vz)*blend}
        e.yaw=Math.atan2(e.vx,-e.vy);e.pitch=Math.atan2(e.vz,Math.hypot(e.vx,e.vy))
      }
      e.x+=e.vx*dt;e.y+=e.vy*dt;e.z+=e.vz*dt
      if(e.z<scene.groundAt(e.x,e.y)){e.life=0;blast(e,4);continue}
      const prev={x:e.px,y:e.py,z:e.pz},r=e.kind==='bullet'?8:11
      if(e.enemy){if(segment(p,prev,e)<r){damage(e.damage);e.life=0;blast(e,3)}else{const ally=livingWings().find(a=>segment(a,prev,e)<10);if(ally){allyDamage(ally,e.damage);e.life=0;blast(e,3)}}}
      else for(const a of actors)if(a.hostile&&!a.dead&&segment({...a,z:a.z+(a.marine?10:a.ground?12:0)},prev,e)<(a.hitRadius||(a.ground?22:r+2))){hit(a,e.damage);e.life=0;if(e.kind!=='bullet')blast(e,16);break}
      if(S.over||offers.length)break
    }
    actors=actors.filter(a=>!a.dead);effects=effects.filter(e=>e.life>0)
    if(!S.over&&!offers.length&&!actors.some(a=>a.hostile)){if(!nextWave){nextWave=3;emit('clear',{wave:S.wave})}nextWave-=dt;if(nextWave<=0){S.wave++;makeWave()}}
    sync()
  }
  S={active:false,over:false,hp:100,shield:0,score:0,kills:0,wave:1,level:1,xp:0,elapsed:0,ammo:60,rollCooldown:0,invulnerable:0,cloak:0}
  return{start,stop,step,damage,requestRoll,chooseUpgrade,refreshUpgrades,awardXP,
    setFiring(v){manualFire=!!v;updateFiring()},
    get state(){const wings=livingWings(),waiting=wingSlots.filter(s=>!s.actor||s.actor.dead).map(s=>Math.max(0,s.revive));return{...S,best,enemies:actors.filter(a=>a.hostile&&!a.dead).length,selecting:offers.length>0,choices:offers.map(id=>({...upgradeById[id],rank:(ranks[id]||0)+1})),pending,refreshesRemaining:offers.length?refreshes:0,ranks:{...ranks},stats:{...stats},xpNext:xpRequired(S.level),timers:{...timers},ally:wings[0]?{hp:wings[0].hp,maxHp:wings[0].maxHp}:null,allies:wingSlots.map((s,i)=>({slot:i,hp:s.actor&&!s.actor.dead?s.actor.hp:0,maxHp:stats.wingHp,revive:Math.max(0,s.revive)})),allyRevive:waiting.length?Math.min(...waiting):0,unlocked:unlockedTypes(S.level)}},
    get targets(){return actors},get effects(){return effects},
  }
}
