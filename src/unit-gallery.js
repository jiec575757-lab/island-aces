import { UNIT_MODELS } from './unit-models.js?v=1.4.0'
import { buildVoxelMesh } from './voxel-mesh.js'
import { drawVoxelMesh } from './voxel-renderer.js'
const definitions=[
  ['fighter','F-07 / 巡逻战机','原机体积重建 · 立体座舱 · 双发喷口'],
  ['fast','F-09 / 疾风截击机','窄身机背 · 高垂尾 · 黄色识别带'],
  ['tank','A-12 / 重甲攻击机','腹部装甲 · 机背肩甲 · 翼下挂载'],
  ['hunter','H-08 / 猎手战机','双侧立体导弹挂架 · 橙色识别带'],
  ['ally','W-01 / 守望僚机','原机翼型 · 青色友军涂装'],
  ['missile','M-12 / 猎隼追踪导弹','八棱弹体 · 四片立体尾翼 · 凹入式喷口'],
  ['drone','D-04 / 蜂群无人机','厚实中央机身 · 双尾翼 · 双发动机吊舱'],
  ['base','AA-02 / 岛链防空基地','装甲堡垒 · 双联高射炮 · 六联发射箱 · 雷达塔'],
  ['support','GS-01 / 地面协同','分层装甲 · 双联炮组 · 青色友军面板'],
  ['warship','FF-06 / 苍礁导弹护卫舰','收尖舰艏 · 舰桥 · 雷达桅杆 · 前后炮塔 · 垂直发射井'],
  ['gunboat','PB-03 / 海狼快速炮艇','折角船体 · 独立舰桥 · 艏部双联炮'],
]
const meshes=Object.fromEntries(Object.entries(UNIT_MODELS).map(([id,v])=>[id,buildVoxelMesh(v)]))
let rotation=30,view='iso'
const gallery=document.querySelector('#unit-gallery')
for(const [id,title,note]of definitions){
  const card=document.createElement('article');card.className='unit-card'
  card.innerHTML=`<canvas width="288" height="210" data-unit="${id}" aria-label="${title}"></canvas><h3>${title}</h3><p>${note}</p><div class="model-links"><a href="models/${id}.vox" download>下载 .vox</a><a href="models/${id}.json" download>下载 JSON</a></div>`
  gallery.append(card)
}
function draw(){
  for(const canvas of gallery.querySelectorAll('canvas')){
    const ctx=canvas.getContext('2d'),mesh=meshes[canvas.dataset.unit],w=canvas.width,h=canvas.height
    const image=ctx.createImageData(w,h),frame=new Uint32Array(image.data.buffer),depth=new Float32Array(w*h)
    frame.fill(0xff4b3916);depth.fill(1e9)
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x%18===0||y%18===0)frame[y*w+x]=0xff51401c
    const a=rotation*Math.PI/180,c=view==='iso'?Math.cos(a):1,s=view==='iso'?Math.sin(a):0,tn=view==='iso'?.55:0
    const basis=view==='top'?[[1,0,0],[0,0,-1],[0,-1,0]]:view==='side'?[[0,1,0],[1,0,0],[0,0,1]]:[[1,0,0],[0,1,0],[0,0,1]]
    const points=[]
    for(const x of mesh.bounds[0])for(const y of mesh.bounds[1])for(const z of mesh.bounds[2]){
      const wx=basis[0][0]*x+basis[1][0]*y+basis[2][0]*z,wy=basis[0][1]*x+basis[1][1]*y+basis[2][1]*z,wz=basis[0][2]*x+basis[1][2]*y+basis[2][2]*z
      points.push([wx*c-wy*s,-wz+tn*(wx*s+wy*c)])
    }
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys)
    const scale=Math.min((w-44)/(maxX-minX),(h-40)/(maxY-minY))
    const faces=drawVoxelMesh(mesh,{x:0,y:0,z:0},basis,1,{x:0,y:0,z:0,cos:c,sin:s,q:0,scale,tan:tn,cx:w/2-(minX+maxX)*scale/2,cy:h/2-(minY+maxY)*scale/2},frame,depth,w,h)
    canvas.dataset.faces=faces;ctx.putImageData(image,0,0)
  }
}
document.querySelector('#unit-rotation').addEventListener('input',e=>{rotation=Number(e.target.value);draw()})
document.querySelectorAll('[data-unit-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.unitView;document.querySelectorAll('[data-unit-view]').forEach(v=>v.classList.toggle('selected',v===b));draw()}))
draw()
