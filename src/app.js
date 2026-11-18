import { createScene, DEFAULT_PARAMS } from './scene.js'
import { createFlameLayer } from './flame-layer.js'
import { createCombat } from './combat.js'
import { upgradeById } from './upgrades.js'

const $ = id => document.getElementById(id)
const root = $('flight'), world = $('world'), flame = $('flame'), ctx = world.getContext('2d', { alpha: false })
const params = { ...DEFAULT_PARAMS, altitude: 110, jetScale: 0.6, pixelSize: 3, intro: false, flameStyle: 'realistic', afterburner: 1 }
let image = null, scale = 4, hiddenUi = false, paused = false, last = performance.now(), frameCount = 0, fpsMark = last
let flameGpu = null, flameFailed = false, audio = null, audioEnabled = false
try { audioEnabled = localStorage.getItem('island-aces-sound') === 'on' } catch {}
const scene = createScene(params), hint = $('hint'), settings = $('settings'), combatHud = $('combat-hud')
const keys = new Set(), controls = { turn: 0, climb: 0, boost: false, thrust: 0, roll: false, view: false, fire: false }
const touchScreen = matchMedia('(pointer: coarse)').matches
if (touchScreen) { root.classList.add('touch'); $('touch-controls').hidden = false; }
if (audioEnabled) $('sound').checked = true

function beep(kind = 'shot') {
  if (!audioEnabled) return
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)()
    if (audio.state === 'suspended') audio.resume()
    const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime
    osc.type = kind === 'shot' ? 'square' : 'sawtooth'
    osc.frequency.setValueAtTime(kind === 'shot' ? 520 : kind === 'hit' ? 180 : 80, now)
    osc.frequency.exponentialRampToValueAtTime(kind === 'shot' ? 145 : 45, now + (kind === 'shot' ? .07 : .3))
    gain.gain.setValueAtTime(kind === 'shot' ? .035 : .09, now); gain.gain.exponentialRampToValueAtTime(.001, now + (kind === 'shot' ? .08 : .31))
    osc.connect(gain).connect(audio.destination); osc.start(now); osc.stop(now + .32)
  } catch {}
}

function showMessage(text, duration = 1800) {
  const el = $('message'); el.textContent = text; el.classList.add('visible')
  clearTimeout(showMessage.timer); showMessage.timer = setTimeout(() => el.classList.remove('visible'), duration)
}
function revealHint() { hint.style.opacity = '1'; clearTimeout(revealHint.timer); revealHint.timer = setTimeout(() => { hint.style.opacity = '0' }, 6000) }
let combat
combat = createCombat(scene, (event, data) => {
  if (event === 'shot') { beep('shot'); return }
  if (event === 'hit') { beep('hit'); $('damage-flash').classList.add('active'); setTimeout(() => $('damage-flash').classList.remove('active'), 90); return }
  if (event === 'kill') { $('score').textContent = String(data.score).padStart(6, '0'); showMessage(`${data.name} 击破 / +${data.xp} XP`, 800); beep('kill'); return }
  if (event === 'upgrade') { clearInputs(); renderUpgrade(); return }
  if (event === 'chosen') { showMessage(`${upgradeById[data.id].name} · Lv.${data.rank}`, 1400); return }
  if (event === 'ability' || event === 'support') { showMessage(data.text, 1500); return }
  if (event === 'wave') { $('wave').textContent = `WAVE ${String(data.wave).padStart(2, '0')}`; showMessage(data.wave === 1 ? '敌机接近 / 开火迎击' : `第 ${data.wave} 波敌机接近`, 1800); return }
  if (event === 'clear') { showMessage('空域清空 / 下一波即将抵达', 2100); return }
  if (event === 'over') {
    $('final-score').textContent = String(data.score).padStart(6, '0')
    $('final-detail').textContent = `击破 ${data.kills} 个目标 · 等级 ${data.level} · 第 ${data.wave} 波 · 最高纪录 ${data.best}`
    $('result-screen').hidden = false
  }
})

function clearInputs(){keys.clear();for(const k of ['fire','pointerFire','padFire','boost','pointerBoost','pointerDown'])controls[k]=false;controls.turn=controls.climb=controls.thrust=0;combat?.setFiring(false);scene.setKeys(0,0,false,0);scene.pointerLeave()}
function roll(){if(paused)return;if(combat.state.active)combat.requestRoll();else scene.roll()}
function renderUpgrade(){
  const s=combat.state;$('upgrade-screen').hidden=!s.selecting;if(!s.selecting)return
  settings.hidden=true;$('pause-screen').hidden=true
  $('upgrade-title').textContent=`等级 ${s.level} · 选择一项被动`
  $('upgrade-subtitle').textContent=`战斗已暂停${s.pending>1?` · 还有 ${s.pending} 次升级`:''}。已有被动可以再次选择。`
  const box=$('upgrade-choices');box.replaceChildren()
  s.choices.forEach((u,i)=>{const b=document.createElement('button');b.className='upgrade-card';b.dataset.upgrade=u.id;b.innerHTML=`<small>0${i+1} / PASSIVE</small><strong>${u.name}</strong><em>${u.rank===1?'获得新被动':`Lv.${u.rank-1} → Lv.${u.rank}`}</em><p>${u.description}</p><span>选择升级 ↗</span>`;b.addEventListener('click',()=>selectUpgrade(u.id));box.append(b)})
  box.firstElementChild?.focus({preventScroll:true})
}
function selectUpgrade(id){if(combat.chooseUpgrade(id)){clearInputs();renderUpgrade();updateCombatHud();last=performance.now();if(!combat.state.selecting)root.focus({preventScroll:true})}}
function updateCombatHud(){
  const s=combat.state;if(!s.active)return
  $('hp-text').textContent=`${Math.ceil(s.hp)}%`;$('hp-bar').style.width=`${s.hp}%`;$('hp-bar').style.background=s.hp>55?'#a8e8c4':s.hp>25?'#f0c373':'#ff755d'
  const elite=combat.targets.filter(a=>a.hostile&&a.elite&&!a.dead).length
  $('enemy-count').textContent=`${s.enemies} 个目标${elite?` / ${elite} 精英`:''}`
  $('level-text').textContent=`LV ${String(s.level).padStart(2,'0')}`;$('xp-text').textContent=`${Math.floor(s.xp)} / ${s.xpNext} XP`;$('xp-bar').style.width=`${s.xp/s.xpNext*100}%`
  $('ammo-text').textContent=`${Math.floor(s.ammo)} / ${s.stats.ammoMax}`;$('ammo-bar').style.width=`${s.ammo/s.stats.ammoMax*100}%`;$('ammo-regen').textContent=`+${s.stats.ammoRegen.toFixed(1)}/s`
  $('shield-text').textContent=s.stats.shieldMax?`${Math.ceil(s.shield)} / ${s.stats.shieldMax}`:'未装配'
  $('roll-status').textContent=s.invulnerable>0?`无敌 ${s.invulnerable.toFixed(1)}s`:s.rollCooldown>0?`Q 冷却 ${s.rollCooldown.toFixed(1)}s`:'Q 翻滚就绪'
  $('support-status').textContent=s.cloak>0?`隐形中 ${s.cloak.toFixed(1)}s`:s.ally?`守望僚机 ${Math.ceil(s.ally.hp)} / ${s.ally.maxHp} HP`:s.ranks.wingman?`僚机重建 ${Math.ceil(s.allyRevive)}s`:'击败敌人获得经验 · 升级三选一'
  const entries=Object.entries(s.ranks),signature=JSON.stringify(entries)
  if(updateCombatHud.signature!==signature){updateCombatHud.signature=signature;$('passive-count').textContent=entries.reduce((n,[,v])=>n+v,0);$('passive-list').replaceChildren();for(const[id,n]of entries){const row=document.createElement('div');row.title=upgradeById[id].description;row.textContent=`${upgradeById[id].name} · ${n}`;$('passive-list').append(row)}if(!entries.length)$('passive-list').textContent='尚未获得被动'}
  $('radar-label').textContent=`RADAR / ${s.stats.radarRange} M`
}

const presetValues = {
  reference: { speed: 92, boost: 1.8, agility: 1.25, bank: 52, altitude: 110, ceiling: 300, clearance: 7, wingmen: 0, spread: 1, jetScale: .6, pixelSize: 3, cameraFollow: .6, chaseDistance: 2.6, chaseAngle: 12, transition: 1.4, timeOfDay: 'day', land: .33, clouds: .45, seed: 7, afterburner: 1, flameStyle: 'realistic', trails: true, shadow: true, intro: false, followPointer: true, invertY: true, stunts: true, view: 'top', bodyColor: '#545969', accentColor: '#f0580e', canopyColor: '#1e8ca0' },
  sunset: { timeOfDay: 'sunset', land: .27, clouds: .35, seed: 89, bodyColor: '#777064', accentColor: '#f48a45', canopyColor: '#2b9da6' },
  night: { timeOfDay: 'night', land: .4, clouds: .6, seed: 231, bodyColor: '#454d64', accentColor: '#ee5d35', canopyColor: '#29bac5', trails: true },
}

function paintSettings() {
  for (const input of settings.querySelectorAll('[data-param]')) {
    const name = input.dataset.param, value = params[name]
    if (input.type === 'checkbox') input.checked = !!value
    else input.value = String(value)
  }
  updateOutputs()
}
function updateOutputs() {
  for (const output of settings.querySelectorAll('[data-value]')) {
    const v = Number(params[output.dataset.value]); output.value = v < 10 && !Number.isInteger(v) ? v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') : String(v)
    output.textContent = output.value
  }
}
function applyPreset(name) {
  Object.assign(params, presetValues[name]); scene.setParams(params); paintSettings(); layout(); setViewLabel()
  settings.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('selected', b.dataset.preset === name))
  if (name === 'reference') showMessage('已恢复示例飞行参数')
  else showMessage(name === 'sunset' ? '落日巡航涂装已载入' : '夜间编队涂装已载入')
}
settings.addEventListener('input', event => {
  const input = event.target.closest('[data-param]'); if (!input) return
  params[input.dataset.param] = input.type === 'checkbox' ? input.checked : input.type === 'range' || input.type === 'number' ? Number(input.value) : input.value
  scene.setParams(params); updateOutputs()
  if (input.dataset.param === 'pixelSize') layout()
  if (input.dataset.param === 'view') { setViewLabel(); revealHint() }
  settings.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('selected'))
})
settings.addEventListener('change', event => { if (event.target.matches('[data-param="seed"],[data-param="land"]')) showMessage('正在生成新的海岛地形…') })
settings.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => applyPreset(b.dataset.preset)))
paintSettings()

function layout() {
  const cw = root.clientWidth, ch = root.clientHeight
  if (!cw || !ch) return
  const px = Math.round(params.pixelSize || Math.min(12, Math.max(2, Math.sqrt(cw * ch / 100000))))
  const lw = Math.ceil(cw / px), lh = Math.ceil(ch / px)
  if (world.width !== lw || world.height !== lh) { world.width = lw; world.height = lh; scene.resize(lw, lh); image = null }
  world.style.width = `${lw * px}px`; world.style.height = `${lh * px}px`
  world.style.left = `${Math.round((cw - lw * px) / 2)}px`; world.style.top = `${Math.round((ch - lh * px) / 2)}px`
  const dpr = Math.min(2, devicePixelRatio || 1), fw = Math.round(lw * px * dpr), fh = Math.round(lh * px * dpr)
  if (flame.width !== fw || flame.height !== fh) { flame.width = fw; flame.height = fh }
  flame.style.width = world.style.width; flame.style.height = world.style.height; flame.style.left = world.style.left; flame.style.top = world.style.top
  scale = px
}
new ResizeObserver(layout).observe(root); layout()

function drawRadar() {
  const canvas = $('radar'), c = canvas.getContext('2d'), s = combat.state
  c.clearRect(0, 0, canvas.width, canvas.height)
  c.strokeStyle = 'rgba(190,229,214,.28)'; c.lineWidth = 1
  c.beginPath(); c.arc(56,56,50,0,Math.PI*2); c.moveTo(6,56); c.lineTo(106,56); c.moveTo(56,6); c.lineTo(56,106); c.moveTo(21,21); c.lineTo(91,91); c.moveTo(91,21); c.lineTo(21,91); c.stroke()
  c.fillStyle = '#d8efd9'; c.beginPath(); c.moveTo(56,46); c.lineTo(62,62); c.lineTo(56,59); c.lineTo(50,62); c.fill()
  const p = scene.telemetry, co = Math.cos(p.yaw), si = Math.sin(p.yaw)
  const range=s.stats.radarRange
  for (const a of combat.targets) { const dx=a.x-p.x,dy=a.y-p.y,d=(dx*dx+dy*dy)**.5,px=(dx*co+dy*si)/range*48,py=(-dx*si+dy*co)/range*48;if(d>range||a.dead)continue;c.fillStyle=!a.hostile?'#73e8e3':a.elite?'#ffce62':'#ff6c52';const r=a.ground?3:2;c.fillRect(Math.round(56+px)-r,Math.round(56+py)-r,r*2,r*2) }
}

function tick(now) {
  const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now
  if (paused || combat.state.selecting || combat.state.over) return
  let turn = 0, climb = 0, boost = false
  for (const key of keys) {
    if (key === 'ArrowLeft' || key === 'KeyA') turn--
    if (key === 'ArrowRight' || key === 'KeyD') turn++
    if (key === 'ArrowUp' || key === 'KeyW') climb++
    if (key === 'ArrowDown' || key === 'KeyS') climb--
    if (key === 'ShiftLeft' || key === 'ShiftRight' || controls.boost) boost = true
  }
  if (controls.boost || controls.pointerBoost) boost = true
  scene.setKeys(turn + controls.turn, climb + controls.climb, boost, controls.thrust)
  scene.step(dt); combat.step(dt)
  const state = combat.state
  const t = scene.telemetry
  $('altitude').textContent = String(Math.round(t.z)).padStart(3, '0')
  $('speed').textContent = String(Math.round(t.speed)).padStart(3, '0')
  $('thrust-label').textContent = t.boost > .55 ? 'BOOST' : t.rolling ? 'ROLL' : 'CRUISE'
  if (state.active) {
    updateCombatHud()
    if (frameCount % 8 === 0) drawRadar()
  }
  const bytes = scene.render()
  if (!image) image = new ImageData(bytes, world.width, world.height)
  ctx.putImageData(image, 0, 0)
  const flames = scene.flames
  if (flames.count && !flameGpu && !flameFailed) {
    flameGpu = createFlameLayer(flame)
    if (!flameGpu) { flameFailed = true; params.flameStyle = 'pixel'; scene.setParams(params) }
  }
  flameGpu?.draw(flames.count, flames.data, flame.width / world.width, now / 1000)
  frameCount++
  if (now - fpsMark > 1000) {
    const fps = Math.round(frameCount * 1000 / (now - fpsMark)); $('performance').textContent = `${fps} FPS · ${world.width}×${world.height} 像素渲染`
    frameCount = 0; fpsMark = now
  }
}
function setViewLabel() {
  const index = params.view === 'top' ? 0 : params.view === 'chase' ? 1 : 2
  $('view-label').textContent = ['俯视', '追尾', '驾驶舱'][index]
  $('view-index').textContent = `${index + 1}/3`
  $('view-toggle').title = `空格切换镜头 · ${$('view-label').textContent}`
  document.querySelector('[data-param="view"]').value = params.view
}
function toggleView() {
  const views = ['top', 'chase', 'cockpit']; params.view = views[(views.indexOf(params.view) + 1) % views.length]
  scene.setParams(params); setViewLabel(); revealHint()
}
setViewLabel()

function setCombat(value) {
  clearInputs();$('upgrade-screen').hidden=true
  if (value && !combat.state.active) {
    combat.start(); combatHud.hidden = false; $('radar-wrap').hidden = false; $('touch-fire').hidden = !root.classList.contains('touch')
    $('score').textContent = '000000'; $('mode-label').textContent = '海岛飞行队 / 原版肉鸽'; $('combat-toggle').innerHTML = '退出空战 <span>C</span>'
    $('passive-panel').hidden=false;updateCombatHud()
    hint.textContent = root.classList.contains('touch') ? '拖动转向 · 按钮射击 / 加速 / 翻滚 · 升级三选一' : '左键加速 · 右键射击 · Q 翻滚无敌 · 击杀升级三选一'
    revealHint(); $('result-screen').hidden = true
  } else if (!value && combat.state.active) {
    combat.stop(); combatHud.hidden = true; $('radar-wrap').hidden = true; $('touch-fire').hidden = true; $('result-screen').hidden = true
    $('passive-panel').hidden=true
    $('mode-label').textContent = '海岛飞行队 / 自由飞行'; $('combat-toggle').innerHTML = '开始空战 <span>C</span>'
    hint.textContent = root.classList.contains('touch') ? '拖动转向 · 轻触翻滚 · 长按加速 · 视角切换' : '移动鼠标转向 · 单击翻滚 · 长按加速 · 空格切换视角'; revealHint(); showMessage('返回自由飞行')
  }
  root.focus({preventScroll:true})
}
$('combat-toggle').addEventListener('click', () => setCombat(!combat.state.active))
$('view-toggle').addEventListener('click', toggleView)
$('settings-toggle').addEventListener('click', () => { settings.hidden = false })
$('settings-close').addEventListener('click', () => { settings.hidden = true; root.focus({preventScroll:true}) })
$('reset-settings').addEventListener('click', () => applyPreset('reference'))
$('fullscreen-toggle').addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.())
$('sound').addEventListener('change', e => { audioEnabled = e.target.checked; localStorage.setItem('island-aces-sound', audioEnabled ? 'on' : 'off'); if (audioEnabled) beep('hit') })
$('pause-toggle').addEventListener('click', () => setPaused(!paused))
$('resume').addEventListener('click', () => setPaused(false))
$('pause-settings').addEventListener('click', () => { $('pause-screen').hidden = true; settings.hidden = false })
$('restart').addEventListener('click', () => { $('result-screen').hidden = true; combat.stop(); setCombat(true); setPaused(false) })
$('free-flight').addEventListener('click', () => { setCombat(false); setPaused(false) })
function setPaused(value) { if(combat.state.selecting||combat.state.over)return;paused=value;$('pause-screen').hidden=!value;$('pause-toggle').textContent=value?'▶':'Ⅱ';if(value)clearInputs();else{last=performance.now();root.focus({preventScroll:true})} }

const FLY = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ShiftLeft: 'boost', ShiftRight: 'boost' }
window.addEventListener('keydown', e => {
  if(combat.state.selecting){if(e.repeat||(e.code!=='Tab'&&e.code!=='Enter'))e.preventDefault();if(['Digit1','Digit2','Digit3','Numpad1','Numpad2','Numpad3'].includes(e.code)&&!e.repeat){const u=combat.state.choices[Number(e.code.slice(-1))-1];if(u)selectUpgrade(u.id)}return}
  if (e.target.closest('input,select,a')) return
  if (e.code === 'Escape' && !settings.hidden) { settings.hidden = true; root.focus({preventScroll:true}); return }
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault()
  if (e.repeat) return
  if (e.code === 'Space') toggleView()
  else if (e.code === 'KeyQ') roll()
  else if (e.code === 'KeyC') setCombat(!combat.state.active)
  else if (e.code === 'KeyP' || e.code === 'Escape') setPaused(!paused)
  else if (e.code === 'KeyF') document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.()
  else if (e.code === 'KeyH') { hiddenUi = !hiddenUi; root.classList.toggle('ui-hidden', hiddenUi) }
  else if (e.code === 'Enter' && combat.state.over) $('restart').click()
  else if (e.code === 'KeyJ' || e.code === 'KeyX') { controls.fire=true; combat.setFiring(true) }
  if (FLY[e.code]) keys.add(e.code)
  revealHint()
})
window.addEventListener('keyup', e => {
  keys.delete(e.code)
  if (e.code === 'KeyJ' || e.code === 'KeyX') { controls.fire=false; combat.setFiring(false) }
})
window.addEventListener('blur', clearInputs)

function pointerPosition(e) { const r = world.getBoundingClientRect(); scene.pointerMove((e.clientX - r.left) / scale, (e.clientY - r.top) / scale) }
root.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') root.focus({preventScroll:true}) })
root.addEventListener('pointermove', e => {
  if (e.target.closest('.ui') || paused || combat.state.selecting || combat.state.over) return
  pointerPosition(e)
  const state = combat.state
  if (controls.pointerDown && Math.hypot(e.clientX-controls.downX,e.clientY-controls.downY)>12) controls.dragged=true
})
root.addEventListener('pointerdown', e => {
  if (e.target.closest('.ui') || paused || combat.state.selecting || combat.state.over) return
  pointerPosition(e); root.focus({preventScroll:true})
  if (e.pointerType === 'touch') {
    root.classList.add('touch'); $('touch-controls').hidden = false; $('touch-fire').hidden = !combat.state.active
    if (controls.touchId !== undefined) return
    controls.touchId=e.pointerId; controls.downX=e.clientX; controls.downY=e.clientY; controls.pointerDown=true; controls.dragged=false; controls.downAt=performance.now()
    try { root.setPointerCapture(e.pointerId) } catch {}
  } else {
    controls.pointerDown=true; controls.downX=e.clientX; controls.downY=e.clientY; controls.downAt=performance.now(); controls.dragged=false
    if (e.button === 0) {if(combat.state.active)controls.pointerBoost=true;else scene.press()}
    if (e.button === 2) { controls.pointerFire=true; combat.setFiring(true) }
    try { root.setPointerCapture(e.pointerId) } catch {}
  }
})
root.addEventListener('pointerup', e => {
  if (e.target.closest('.ui') && e.pointerType !== 'touch') return
  if (e.pointerType === 'touch' && controls.touchId !== e.pointerId) return
  const tap = !controls.dragged && performance.now()-controls.downAt<260
  if (e.pointerType === 'touch' && tap && !combat.state.active) scene.roll()
  else if (e.pointerType !== 'touch') { if(e.button===0){controls.pointerBoost=false;if(!combat.state.active)scene.release()}if(e.button===2){controls.pointerFire=false;combat.setFiring(controls.fire)} }
  controls.pointerDown=false; controls.touchId=undefined
  if (e.pointerType === 'touch') scene.pointerLeave()
})
root.addEventListener('pointercancel', () => {clearInputs();controls.touchId=undefined})
root.addEventListener('contextmenu', e => e.preventDefault())

function holdButton(id, onDown, onUp) {
  const button=$(id); let held=false
  const release=e=>{if(!held)return;held=false;onUp();button.classList.remove('pressed');try{button.releasePointerCapture(e.pointerId)}catch{};root.focus({preventScroll:true})}
  button.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();held=true;button.classList.add('pressed');try{button.setPointerCapture(e.pointerId)}catch{};onDown()})
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release)
}
holdButton('touch-boost',()=>{controls.boost=true;keys.add('TouchBoost')},()=>{controls.boost=false;keys.delete('TouchBoost')})
holdButton('touch-fire',()=>{controls.fire=true;combat.setFiring(true)},()=>{controls.fire=false;combat.setFiring(false)})
$('touch-view').addEventListener('pointerdown',e=>e.stopPropagation());$('touch-roll').addEventListener('pointerdown',e=>{e.stopPropagation();roll()})
$('touch-view').addEventListener('click',toggleView)

const padKind = id => /054c|dualsense|dualshock|playstation/i.test(id) ? 'PlayStation' : '手柄'
let padName = ''
function gamepadStep() {
  if(paused||combat.state.selecting||combat.state.over)return
  let pad
  try { pad = [...navigator.getGamepads()].find(g => g?.connected && g.axes?.length>=2) } catch { return }
  if (!pad) { controls.turn=controls.climb=controls.thrust=0; controls.padFire=false; combat.setFiring(controls.fire || controls.pointerFire); padName=''; return }
  const dead = x => Math.abs(x)<.16 ? 0 : Math.sign(x)*(Math.abs(x)-.16)/.84
  controls.turn=dead(pad.axes[0]); controls.climb=-dead(pad.axes[1]); controls.thrust=pad.buttons[7]?.value||0
  const pressed = i => !!pad.buttons[i]?.pressed
  if (pressed(0) && !controls.padRoll) roll()
  if (pressed(3) && !controls.padView) toggleView()
  controls.padRoll=pressed(0); controls.padView=pressed(3); controls.padFire=pressed(5)
  combat.setFiring(controls.fire||controls.pointerFire||controls.padFire)
  if (padName !== padKind(pad.id)) {padName=padKind(pad.id);showMessage(`${padName} 已连接`,1100)}
}
const originalTick = tick
// Sample gamepads continuously; animation remains driven by the same frame clock.
const tickWithPad = now => { gamepadStep(); originalTick(now); requestAnimationFrame(tickWithPad) }
requestAnimationFrame(tickWithPad)

const splash = $('boot'), canvasTimer = setInterval(() => {
  if (world.width > 0 && world.height > 0) { clearInterval(canvasTimer); splash.style.opacity='0'; setTimeout(()=>splash.remove(),480); root.focus({preventScroll:true}) }
}, 100)

flame.addEventListener('webglcontextlost', e => { e.preventDefault(); flameGpu = null; flameFailed = true; params.flameStyle = 'pixel'; scene.setParams(params); paintSettings() })
if (new URLSearchParams(location.search).has('inspect')) {
  window.flightLab = { scene, combat, params, setCombat, setPaused, applyPreset, controls, keys,
    get paused() { return paused }, snapshot() { return { ...scene.telemetry, combat: combat.state, width: world.width, height: world.height } } }
}
if (touchScreen) hint.textContent = '拖动转向 · 轻触翻滚 · 长按加速 · 视角切换'
