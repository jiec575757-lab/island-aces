import { createScene, DEFAULT_PARAMS } from './scene.js?v=1.5.0'
import { createFlameLayer } from './flame-layer.js'
import { createCombat } from './combat.js?v=1.5.0'
import { upgradeById } from './upgrades.js?v=1.5.0'
import { createPixelHud } from './pixel-hud.js?v=1.5.0'
import { createMobileControls } from './mobile-controls.js?v=1.5.0'
import { createFlightAudio } from './flight-audio.js?v=1.5.0'
import { createWeather } from './weather.js?v=1.5.0'

const $ = id => document.getElementById(id)
const root = $('flight'), world = $('world'), flame = $('flame'), ctx = world.getContext('2d', { alpha: false })
const params = { ...DEFAULT_PARAMS, altitude: 110, jetScale: 0.6, pixelSize: 3, intro: false, flameStyle: 'realistic', afterburner: 1 }
let image = null, scale = 4, hiddenUi = false, paused = false, last = performance.now(), frameCount = 0, fpsMark = last
let flameGpu = null, flameFailed = false
const audio=createFlightAudio()
const scene = createScene(params), hint = $('hint'), settings = $('settings'), combatHud = $('combat-hud')
const weather=createWeather($('weather'),value=>{scene.setWeather(value);$('weather-label').textContent=value.name},()=>audio.play('thunder'))
try{const mode=localStorage.getItem('island-aces-weather')||'auto';weather.setMode(mode);$('weather-mode').value=mode}catch{}
const drawPixelHud=createPixelHud($('pixel-hud'))
const keys = new Set(), controls = { turn: 0, climb: 0, boost: false, thrust: 0, touchLeft:false, touchRight:false,touchUp:false,touchDown:false, tiltTurn:0 }
const touchScreen = matchMedia('(pointer: coarse)').matches
if (touchScreen) { root.classList.add('touch'); $('touch-controls').hidden = false; }
scene.setViewportScale(touchScreen ? .62 : 1)
let mobile
$('sound').checked=audio.state.sfx;$('music').checked=audio.state.music;$('volume').value=audio.state.volume*100;$('volume-label').textContent=`${Math.round(audio.state.volume*100)}%`
const beep=kind=>audio.play(kind)
root.addEventListener('pointerdown',()=>audio.unlock(),{capture:true})
window.addEventListener('keydown',()=>audio.unlock(),{once:true})

function showMessage(text, duration = 1800) {
  const el = $('message'); el.textContent = text; el.classList.add('visible')
  clearTimeout(showMessage.timer); showMessage.timer = setTimeout(() => el.classList.remove('visible'), duration)
}
function revealHint() { hint.style.opacity = '1'; clearTimeout(revealHint.timer); revealHint.timer = setTimeout(() => { hint.style.opacity = '0' }, 6000) }
let combat
combat = createCombat(scene, (event, data) => {
  if (event === 'shot') { beep('shot'); return }
  if (event === 'hit') { beep('hit'); $('damage-flash').classList.add('active'); setTimeout(() => $('damage-flash').classList.remove('active'), 90); return }
  if (event === 'kill') { showMessage(`${data.name} 击破 / +${data.xp} XP`, 800); beep('kill'); return }
  if (event === 'upgrade') { audio.play('upgrade');clearInputs(); renderUpgrade(); return }
  if(event==='detonate'){audio.play('kill');return}
  if (event === 'chosen') { showMessage(`${upgradeById[data.id].name} · Lv.${data.rank}`, 1400); return }
  if(event==='enemy-unlock'){showMessage(`新威胁 / ${data.name} · Lv.${data.level}`,1800);return}
  if(event==='roll'){audio.play('roll');return}
  if (event === 'ability' || event === 'support') { showMessage(data.text, 1500); return }
  if (event === 'wave') { showMessage(data.wave === 1 ? '敌机接近 / 自动开火' : `第 ${data.wave} 波敌机接近`, 1800); return }
  if (event === 'clear') { showMessage('空域清空 / 下一波即将抵达', 2100); return }
  if (event === 'over') {
    $('final-score').textContent = String(data.score).padStart(6, '0')
    $('final-detail').textContent = `击破 ${data.kills} 个目标 · 等级 ${data.level} · 第 ${data.wave} 波 · 最高纪录 ${data.best}`
    $('result-screen').hidden = false
  }
})

function clearInputs(){keys.clear();for(const k of ['boost','pointerBoost','pointerDown','touchLeft','touchRight','touchUp','touchDown'])controls[k]=false;controls.turn=controls.climb=controls.thrust=controls.tiltTurn=0;controls.touchId=undefined;combat?.setFiring(false);scene.setKeys(0,0,false,0);scene.pointerLeave();root.dispatchEvent(new Event('flight-input-reset'));document.querySelectorAll('.pressed').forEach(el=>el.classList.remove('pressed'))}
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
  drawPixelHud({...s,speed:scene.telemetry.speed})
  $('touch-roll').classList.toggle('cooling',s.rollCooldown>0);$('touch-roll').setAttribute('aria-label',s.rollCooldown>0?`翻滚冷却 ${s.rollCooldown.toFixed(1)} 秒`:'翻滚闪避')
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
  const px = touchScreen?Math.max(2,Math.round(params.pixelSize)-1):Math.round(params.pixelSize || Math.min(12, Math.max(2, Math.sqrt(cw * ch / 100000))))
  const lw = Math.ceil(cw / px), lh = Math.ceil(ch / px)
  if (world.width !== lw || world.height !== lh) { world.width = lw; world.height = lh; scene.resize(lw, lh); image = null }
  world.style.width = `${lw * px}px`; world.style.height = `${lh * px}px`
  world.style.left = `${Math.round((cw - lw * px) / 2)}px`; world.style.top = `${Math.round((ch - lh * px) / 2)}px`
  const weatherCanvas=$('weather');if(weatherCanvas.width!==lw||weatherCanvas.height!==lh){weatherCanvas.width=lw;weatherCanvas.height=lh}weatherCanvas.style.cssText=world.style.cssText
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
  audio.step({...scene.telemetry,combat:combat.state.active,paused:paused||combat.state.selecting||combat.state.over||document.hidden})
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
  const touchTurn=(controls.touchRight?1:0)-(controls.touchLeft?1:0)
  const touchClimb=((controls.touchUp?1:0)-(controls.touchDown?1:0))*(params.invertY?-1:1)
  scene.setKeys(turn + controls.turn + (touchTurn||mobile?.turn||0), climb + controls.climb+touchClimb, boost, controls.thrust)
  scene.step(dt); combat.step(dt)
  weather.step(dt);weather.render()
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
    combat.start(); combatHud.hidden = false; $('radar-wrap').hidden = false;root.classList.add('in-combat')
    $('mode-label').textContent = '海岛飞行队 / 原版肉鸽'; $('combat-toggle').innerHTML = '退出空战 <span>C</span>'
    $('passive-panel').hidden=false;updateCombatHud()
    hint.textContent = root.classList.contains('touch') ? '自动开火 · 左侧转向 / 升降 · 右侧翻滚 / 加速' : '自动开火 · 左键 / Q 翻滚 · 右键 / Shift 加速'
    revealHint(); $('result-screen').hidden = true
  } else if (!value && combat.state.active) {
    combat.stop(); combatHud.hidden = true; $('radar-wrap').hidden = true; $('result-screen').hidden = true;root.classList.remove('in-combat')
    $('passive-panel').hidden=true
    $('mode-label').textContent = '海岛飞行队 / 自由飞行'; $('combat-toggle').innerHTML = '开始空战 <span>C</span>'
    hint.textContent = root.classList.contains('touch') ? '拖动转向 · 轻触翻滚 · 长按加速 · 视角切换' : '移动鼠标转向 · 单击翻滚 · 长按加速 · 空格切换视角'; revealHint(); showMessage('返回自由飞行')
  }
  root.focus({preventScroll:true})
}
$('combat-toggle').addEventListener('click', () => {setCombat(!combat.state.active);if(touchScreen){mobile.enable();mobile.landscape()}})
$('view-toggle').addEventListener('click', toggleView)
$('settings-toggle').addEventListener('click', () => { settings.hidden = false })
$('settings-close').addEventListener('click', () => { settings.hidden = true; root.focus({preventScroll:true}) })
$('reset-settings').addEventListener('click', () => applyPreset('reference'))
$('fullscreen-toggle').addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.())
$('sound').addEventListener('change',e=>{audio.configure({sfx:e.target.checked});audio.unlock();if(e.target.checked)audio.play('hit')})
$('music').addEventListener('change',e=>{audio.configure({music:e.target.checked});audio.unlock()})
$('volume').addEventListener('input',e=>{audio.configure({volume:Number(e.target.value)/100});$('volume-label').textContent=`${e.target.value}%`})
$('weather-mode').addEventListener('change',e=>{weather.setMode(e.target.value);try{localStorage.setItem('island-aces-weather',e.target.value)}catch{}})
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
  if (FLY[e.code]) keys.add(e.code)
  revealHint()
})
window.addEventListener('keyup', e => {
  keys.delete(e.code)
})
window.addEventListener('blur', ()=>{clearInputs();mobile?.reset()})
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInputs();audio.step({paused:true})}})

function pointerPosition(e) {const p=mobile.coordinates(e.clientX,e.clientY);scene.pointerMove((p.x-parseFloat(world.style.left||0))/scale,(p.y-parseFloat(world.style.top||0))/scale)}
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
    if(!root.classList.contains('touch')){root.classList.add('touch');scene.setViewportScale(.62);mobile.layout();pointerPosition(e)}
    $('touch-controls').hidden = false
    if (controls.touchId !== undefined) return
    controls.touchId=e.pointerId; controls.downX=e.clientX; controls.downY=e.clientY; controls.pointerDown=true; controls.dragged=false; controls.downAt=performance.now()
    try { root.setPointerCapture(e.pointerId) } catch {}
  } else {
    controls.pointerDown=true; controls.downX=e.clientX; controls.downY=e.clientY; controls.downAt=performance.now(); controls.dragged=false
    if (e.button === 0) {if(combat.state.active)roll();else scene.press()}
    if (e.button === 2) controls.pointerBoost=true
    try { root.setPointerCapture(e.pointerId) } catch {}
  }
})
root.addEventListener('pointerup', e => {
  if(e.target.closest('.ui')&&!controls.pointerDown)return
  if (e.pointerType === 'touch' && controls.touchId !== e.pointerId) return
  const tap = !controls.dragged && performance.now()-controls.downAt<260
  if (e.pointerType === 'touch' && tap && !combat.state.active) scene.roll()
  else if (e.pointerType !== 'touch') {if(e.button===0&&!combat.state.active)scene.release();if(e.button===2)controls.pointerBoost=false}
  controls.pointerDown=false; controls.touchId=undefined
  if (e.pointerType === 'touch') scene.pointerLeave()
})
root.addEventListener('pointercancel', () => {clearInputs();controls.touchId=undefined})
root.addEventListener('contextmenu', e => e.preventDefault())

function holdButton(id, onDown, onUp) {
  const button=$(id); let held=null
  const release=e=>{e.stopPropagation();if(held===null||(e.pointerId!==undefined&&e.pointerId!==held))return;held=null;onUp();button.classList.remove('pressed');try{button.releasePointerCapture(e.pointerId)}catch{};root.focus({preventScroll:true})}
  button.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();if(paused||combat.state.selecting||combat.state.over||held!==null)return;held=e.pointerId;scene.pointerLeave();button.classList.add('pressed');try{button.setPointerCapture(e.pointerId)}catch{};onDown()})
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release)
  root.addEventListener('flight-input-reset',()=>{held=null;button.classList.remove('pressed')})
}
holdButton('touch-boost',()=>{controls.boost=true;keys.add('TouchBoost')},()=>{controls.boost=false;keys.delete('TouchBoost')})
holdButton('touch-left',()=>{controls.touchLeft=true},()=>{controls.touchLeft=false})
holdButton('touch-right',()=>{controls.touchRight=true},()=>{controls.touchRight=false})
holdButton('touch-up',()=>{controls.touchUp=true},()=>{controls.touchUp=false})
holdButton('touch-down',()=>{controls.touchDown=true},()=>{controls.touchDown=false})
$('touch-roll').addEventListener('pointerdown',e=>{e.stopPropagation();roll()})

const padKind = id => /054c|dualsense|dualshock|playstation/i.test(id) ? 'PlayStation' : '手柄'
let padName = ''
function gamepadStep() {
  if(paused||combat.state.selecting||combat.state.over)return
  let pad
  try { pad = [...navigator.getGamepads()].find(g => g?.connected && g.axes?.length>=2) } catch { return }
  if (!pad) { controls.turn=controls.climb=controls.thrust=0;padName=''; return }
  const dead = x => Math.abs(x)<.16 ? 0 : Math.sign(x)*(Math.abs(x)-.16)/.84
  controls.turn=dead(pad.axes[0]); controls.climb=-dead(pad.axes[1]); controls.thrust=pad.buttons[7]?.value||0
  const pressed = i => !!pad.buttons[i]?.pressed
  if (pressed(0) && !controls.padRoll) roll()
  if (pressed(3) && !controls.padView) toggleView()
  controls.padRoll=pressed(0); controls.padView=pressed(3)
  if (padName !== padKind(pad.id)) {padName=padKind(pad.id);showMessage(`${padName} 已连接`,1100)}
}
const originalTick = tick
mobile=createMobileControls(root,controls,clearInputs)
// Sample gamepads continuously; animation remains driven by the same frame clock.
const tickWithPad = now => { gamepadStep(); originalTick(now); requestAnimationFrame(tickWithPad) }
requestAnimationFrame(tickWithPad)

const splash = $('boot'), canvasTimer = setInterval(() => {
  if (world.width > 0 && world.height > 0) { clearInterval(canvasTimer); splash.style.opacity='0'; setTimeout(()=>splash.remove(),480); root.focus({preventScroll:true}) }
}, 100)

flame.addEventListener('webglcontextlost', e => { e.preventDefault(); flameGpu = null; flameFailed = true; params.flameStyle = 'pixel'; scene.setParams(params); paintSettings() })
if (new URLSearchParams(location.search).has('inspect')) {
  window.flightLab = { scene, combat, params, setCombat, setPaused, applyPreset, controls, keys,audio,weather,
    get paused() { return paused }, snapshot() { return { ...scene.telemetry, combat: combat.state, width: world.width, height: world.height } } }
}
if (touchScreen) hint.textContent = '横屏飞行 · 左侧转向 / 升降 · 右侧翻滚 / 加速'
