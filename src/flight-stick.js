import { flightCoordinates } from './mobile-controls.js'

// Positive y means pulling the stick toward the pilot: climb, regardless of invertY.
export function stickAxes(dx,dy,radius,deadZone=.1){
  const length=Math.hypot(dx,dy),limit=Math.max(1,radius),distance=Math.min(1,length/limit)
  const strength=distance<=deadZone?0:(distance-deadZone)/(1-deadZone)
  return{turn:length?dx/length*strength:0,climb:length?dy/length*strength:0,x:length?dx/length*distance*limit:0,y:length?dy/length*distance*limit:0}
}

export function createFlightStick(element,root,controls,canControl=()=>true,onEngage=()=>{}){
  let held=null
  const local=(x,y)=>flightCoordinates(x,y,element.getBoundingClientRect(),root.classList.contains('portrait-landscape'))
  function update(event){
    const point=local(event.clientX,event.clientY),radius=element.clientWidth*.34
    const axes=stickAxes(point.x-element.clientWidth/2,point.y-element.clientHeight/2,radius)
    controls.stickTurn=axes.turn;controls.stickClimb=axes.climb
    element.style.setProperty('--stick-x',`${axes.x.toFixed(2)}px`);element.style.setProperty('--stick-y',`${axes.y.toFixed(2)}px`)
    element.dataset.turn=axes.turn.toFixed(3);element.dataset.climb=axes.climb.toFixed(3)
  }
  function reset(){
    const pointer=held;held=null;controls.stickActive=false;controls.stickTurn=controls.stickClimb=0
    element.classList.remove('engaged');element.style.setProperty('--stick-x','0px');element.style.setProperty('--stick-y','0px');element.dataset.turn=element.dataset.climb='0'
    if(pointer!==null)try{element.releasePointerCapture(pointer)}catch{}
  }
  function release(event){event.stopPropagation();if(event.pointerId!==held)return;reset()}
  element.addEventListener('pointerdown',event=>{
    event.stopPropagation();event.preventDefault()
    if(held!==null||!canControl()||event.button>0)return
    held=event.pointerId;controls.stickActive=true;element.classList.add('engaged');onEngage()
    try{element.setPointerCapture(held)}catch{}
    update(event)
  })
  element.addEventListener('pointermove',event=>{event.stopPropagation();if(event.pointerId!==held)return;event.preventDefault();update(event)})
  for(const name of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(name,release)
  root.addEventListener('flight-input-reset',reset)
  return{reset}
}
