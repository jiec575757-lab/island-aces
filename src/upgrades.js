// The first version stays simple: each passive has explicit ranks and predictable values.
export const UPGRADES = [
  ['rapid','连装机炮','机炮射速 +20%，弹药自动补充 +0.65 发/秒'],
  ['speed','矢量引擎','巡航速度 +7%，转向同步提升 5%'],
  ['damage','穿甲弹芯','机炮伤害每级 +25%'],
  ['shield','再生护盾','获得 30 点护盾，6 秒脱战后每秒回复 4×等级'],
  ['crit','精密瞄准','暴击率 +10%，最高 50%'],
  ['critDamage','致命打击','暴击伤害 +25%，基础暴击 1.6 倍'],
  ['missile','猎隼导弹','每 8 秒发射一枚追踪导弹，一级伤害 4.5，升级 +1.5'],
  ['flare','热焰干扰','每 16 秒清空敌方弹幕，升级缩短间隔'],
  ['drone','蜂群无人机','每 14 秒发射一架追踪自爆无人机，一级伤害 6，升级 +2'],
  ['wingman','守望编队','每级增加 1 架僚机（最多 5 架）、15 HP；各自攻击并自动复活，满编后继续强化'],
  ['ground','地面协同','每 24 秒召唤 8 秒地面支援，一级单发 0.4 伤害'],
  ['regen','维修纳米机','每秒回复 0.5×等级 机体生命'],
  ['roll','相位翻滚','翻滚无敌 +0.15 秒，冷却 -0.08 秒'],
  ['vampire','战场回收','每次击杀回复 1.5×等级 机体生命'],
  ['cloak','光学隐形','每 22 秒隐形 3 秒，升级延长持续并缩短间隔'],
  ['secondary','自动副炮','自动瞄准副炮，每发伤害为机炮的 30%，独立开火'],
  ['radar','广域雷达','雷达 +150 米，机炮射程 +70 米，单侧索敌角 +2°（最高 30°）'],
].map(([id,name,description])=>({id,name,description}))
export const upgradeById=Object.fromEntries(UPGRADES.map(u=>[u.id,u]))
export const xpRequired=level=>40+18*(level-1)+2*(level-1)**2
export function deriveStats(r={}){
  const n=id=>r[id]||0, timer=(base,id,step,min)=>Math.max(min,base-step*(Math.max(0,n(id)-1)))
  return {
    fireRate:10.5*(1+.2*n('rapid')), ammoRegen:3+.65*n('rapid'), ammoMax:60,
    speed:1+.07*n('speed'), agility:1.65*(1+.05*n('speed')), damage:1+.25*n('damage'),
    shieldMax:30*n('shield'), shieldRegen:4*n('shield'),
    critChance:Math.min(.5,.1*n('crit')), critMultiplier:1.6+.25*n('critDamage'),
    missileInterval:timer(8,'missile',.8,3), missileDamage:3+1.5*n('missile'),
    flareInterval:timer(16,'flare',2,6),
    droneInterval:timer(14,'drone',1,5), droneDamage:4+2*n('drone'),
    wingHp:35+15*n('wingman'), wingDamage:.25*(1+.1*Math.max(0,n('wingman')-1)), wingRevive:timer(22,'wingman',1.5,10),wingCount:Math.min(5,n('wingman')),
    groundInterval:timer(24,'ground',1,10), groundDuration:Math.min(14,7+n('ground')), groundDamage:.25+.15*n('ground'),
    regen:.5*n('regen'), rollDuration:Math.min(1.5,.45+.15*n('roll')), rollCooldown:Math.max(2.2,2.8-.08*n('roll')),
    killHeal:1.5*n('vampire'), cloakInterval:timer(22,'cloak',2,10), cloakDuration:Math.min(6,2+n('cloak')),
    secondaryInterval:Math.max(.32,1.1-.08*n('secondary')), secondaryDamage:.3*(1+.05*Math.max(0,n('secondary')-1)),
    radarRange:620+150*n('radar'), autoRange:460+50*n('radar'),
    cannonRange:450+70*n('radar'), cannonCone:Math.min(30,25+2*n('radar'))*Math.PI/180
  }
}
