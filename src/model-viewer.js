import { decodeJet, JET_W, JET_L, JET_H, JET_PALETTE } from './jet-model.js'

const canvas = document.querySelector('#model'), ctx = canvas.getContext('2d')
const slices = decodeJet(), palette = new Map(JET_PALETTE.map(([i,r,g,b]) => [i, `rgb(${r},${g},${b})`]))
const state = { view: 'iso', layer: 6, rotation: 32, zoom: 1, drag: false, lastX: 0 }
const entries = []
for (let z = 0; z < JET_H; z++) for (let y = 0; y < JET_L; y++) for (let x = 0; x < JET_W; x++) {
  const color = slices[z][y * JET_W + x]
  if (color) entries.push({x,y,z,color})
}
document.querySelector('#vox-count').textContent = entries.length.toLocaleString()
for (const [,r,g,b] of JET_PALETTE) {
  const swatch = document.createElement('i')
  swatch.style.background = `rgb(${r},${g},${b})`; swatch.title = `RGB ${r}, ${g}, ${b}`
  document.querySelector('#palette').append(swatch)
}

function draw() {
  const w = canvas.width, h = canvas.height
  ctx.fillStyle = '#16394b'; ctx.fillRect(0,0,w,h)
  ctx.strokeStyle = 'rgba(199,224,225,.11)'; ctx.lineWidth = 1
  for (let x=0;x<w;x+=32) {ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
  for (let y=0;y<h;y+=32) {ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  if (state.view === 'iso') {
    const a=state.rotation*Math.PI/180, cs=Math.cos(a), sn=Math.sin(a), scale=state.zoom*7.7
    const points=entries.map(p => {
      const x=p.x-(JET_W-1)/2,y=p.y-(JET_L-1)/2,z=p.z-(JET_H-1)/2
      const rx=x*cs-y*sn,ry=x*sn+y*cs
      return {x:w/2+(rx-ry)*scale*.62,y:h/2+(rx+ry)*scale*.3-z*scale*.78,depth:rx+ry+z,color:p.color}
    }).sort((a,b)=>a.depth-b.depth)
    for (const p of points) {
      ctx.fillStyle=palette.get(p.color)
      ctx.fillRect(Math.round(p.x),Math.round(p.y),Math.ceil(scale*.82),Math.ceil(scale*.82))
    }
    return
  }
  const columns=state.view==='top'||state.view==='front'?JET_W:JET_L
  const rows=state.view==='top'?JET_L:JET_H
  const scale=Math.max(2,Math.floor(state.zoom*Math.min((w-100)/columns,(h-85)/rows)))
  const ox=(w-columns*scale)/2,oy=(h-rows*scale)/2
  const pixels=new Uint8Array(columns*rows)
  if (state.view==='top') pixels.set(slices[state.layer])
  else {
    const sorted=[...entries].sort(state.view==='front'?(a,b)=>b.y-a.y:(a,b)=>a.x-b.x)
    for(const p of sorted) pixels[(JET_H-1-p.z)*columns+(state.view==='front'?p.x:p.y)]=p.color
  }
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++) {
    const color=pixels[y*columns+x]
    if(color) {ctx.fillStyle=palette.get(color);ctx.fillRect(ox+x*scale,oy+y*scale,scale,scale)}
  }
}

function updateLayer() {
  document.querySelector('#layer-out').textContent=`第 ${state.layer+1} 层 / 共 ${JET_H} 层`
  draw()
}
document.querySelector('#layer').addEventListener('input',e=>{state.layer=Number(e.target.value);state.view='top';updateButtons();updateLayer()})
document.querySelector('#rotation').addEventListener('input',e=>{state.rotation=Number(e.target.value);state.view='iso';updateButtons();draw()})
document.querySelector('#zoom').addEventListener('input',e=>{state.zoom=Number(e.target.value);draw()})
function updateButtons() {document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',state.view===b.dataset.view))}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;updateButtons();draw()}))
canvas.addEventListener('pointerdown',e=>{state.drag=true;state.lastX=e.clientX;canvas.setPointerCapture(e.pointerId)})
canvas.addEventListener('pointermove',e=>{
  if(!state.drag||state.view!=='iso')return
  state.rotation=(state.rotation+(e.clientX-state.lastX)*.8+360)%360;state.lastX=e.clientX
  document.querySelector('#rotation').value=state.rotation;draw()
})
canvas.addEventListener('pointerup',()=>state.drag=false)
canvas.addEventListener('pointercancel',()=>state.drag=false)
draw()
