const clamp=(v,a,b)=>Math.max(a,Math.min(b,v))
export function flightCoordinates(x,y,rect,rotated){
  return rotated?{x:y-rect.top,y:rect.right-x}:{x:x-rect.left,y:y-rect.top}
}
export function tiltAxis(beta,gamma,angle){
  const r=angle*Math.PI/180
  return gamma*Math.cos(r)+beta*Math.sin(r)
}
export function createMobileControls(root,controls,clearInputs){
  let enabled=false,baseline=null,angle=0,lastSample=0,enabling=false
  const touch=()=>root.classList.contains('touch'),button=document.querySelector('#tilt-toggle')
  function reset(){baseline=null;controls.tiltTurn=0}
  function layout(){
    const rotated=touch()&&innerHeight>innerWidth
    root.classList.toggle('portrait-landscape',rotated)
    const reported=Number(screen.orientation?.angle??window.orientation??0)
    angle=rotated?90:touch()&&innerWidth>innerHeight&&reported%180===0?90:reported
    reset();clearInputs()
  }
  async function enable(){
    if(!touch()||enabled||enabling)return
    if(!window.DeviceOrientationEvent){button.title='此设备不支持倾斜转向';return}
    enabling=true
    try{
      if(typeof DeviceOrientationEvent.requestPermission==='function'&&await DeviceOrientationEvent.requestPermission()!=='granted'){button.title='倾斜未授权，可继续使用摇杆';return}
      enabled=true;button.textContent='倾斜 开';button.setAttribute('aria-pressed','true');button.title='关闭倾斜转向';reset()
    }catch{button.title='倾斜未启用，可继续使用摇杆'}finally{enabling=false}
  }
  function disable(){enabled=false;reset();button.textContent='倾斜 关';button.setAttribute('aria-pressed','false');button.title='启用倾斜转向'}
  window.addEventListener('deviceorientation',e=>{
    if(!enabled||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return
    const value=tiltAxis(e.beta,e.gamma,angle)
    baseline??=value;lastSample=performance.now()
    const delta=value-baseline
    controls.tiltTurn=Math.abs(delta)<3?0:clamp(Math.sign(delta)*(Math.abs(delta)-3)/20,-1,1)
  })
  button.addEventListener('click',()=>enabled?disable():enable())
  window.addEventListener('resize',layout);screen.orientation?.addEventListener('change',layout)
  document.addEventListener('visibilitychange',reset)
  layout()
  return{enable,reset,layout,get active(){return enabled},get turn(){return enabled&&performance.now()-lastSample<1000?controls.tiltTurn||0:0},async landscape(){if(touch())try{await screen.orientation?.lock?.('landscape')}catch{}},coordinates(x,y){return flightCoordinates(x,y,root.getBoundingClientRect(),root.classList.contains('portrait-landscape'))}}
}
