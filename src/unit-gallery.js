import { UNIT_MODELS } from './unit-models.js'
const definitions=[['missile','M-12 / 猎隼追踪导弹','锥形导引头 · 橙色弹体环 · 四片后掠尾翼'],['drone','D-04 / 蜂群无人机','宽翼低矮机身 · 青色传感器 · 橙色尾喷口'],['base','AA-02 / 岛链防空基地','双联高射炮 · 侧置导弹发射箱 · 装甲基座'],['support','GS-01 / 地面协同','小型双联炮组 · 青色友军识别面板']]
let rotation=30,view='iso'
const gallery=document.querySelector('#unit-gallery')
for(const [id,title,note] of definitions){
  const card=document.createElement('article');card.className='unit-card'
  card.innerHTML=`<canvas width="288" height="210" data-unit="${id}" aria-label="${title}"></canvas><h3>${title}</h3><p>${note}</p><div class="model-links"><a href="models/${id}.vox" download>下载 .vox</a><a href="models/${id}.json" download>下载 JSON</a></div>`
  gallery.append(card)
}
function draw(){
  for(const canvas of gallery.querySelectorAll('canvas')){
    const ctx=canvas.getContext('2d'),mesh=UNIT_MODELS[canvas.dataset.unit],w=canvas.width,h=canvas.height
    ctx.fillStyle='#16394b';ctx.fillRect(0,0,w,h)
    ctx.strokeStyle='#a9d4df13';for(let x=0;x<w;x+=18){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=18){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
    const a=rotation*Math.PI/180,cs=Math.cos(a),sn=Math.sin(a)
    const points=mesh.map(([x,y,z,c])=>{
      const rx=x*cs-y*sn,ry=x*sn+y*cs
      return view==='top'?{x,y,depth:z,c}:view==='side'?{x:y,y:-z,depth:x,c}:{x:(rx-ry)*.65,y:(rx+ry)*.32-z*.8,depth:rx+ry+z*.5,c}
    }).sort((a,b)=>a.depth-b.depth)
    const minX=Math.min(...points.map(v=>v.x)),maxX=Math.max(...points.map(v=>v.x)),minY=Math.min(...points.map(v=>v.y)),maxY=Math.max(...points.map(v=>v.y))
    const scale=Math.min(7,(w-52)/(maxX-minX+1),(h-48)/(maxY-minY+1)),ox=w/2-(minX+maxX)*scale/2,oy=h/2-(minY+maxY)*scale/2
    for(const p of points){ctx.fillStyle=`rgb(${p.c.join(',')})`;ctx.fillRect(Math.round(ox+p.x*scale),Math.round(oy+p.y*scale),Math.ceil(scale*1.05),Math.ceil(scale*1.05))}
  }
}
document.querySelector('#unit-rotation').addEventListener('input',e=>{rotation=Number(e.target.value);draw()})
document.querySelectorAll('[data-unit-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.unitView;document.querySelectorAll('[data-unit-view]').forEach(v=>v.classList.toggle('selected',v===b));draw()}))
draw()
