const pack=(r,g,b)=>(255<<24)|((Math.min(255,b)|0)<<16)|((Math.min(255,g)|0)<<8)|(Math.min(255,r)|0)

// Filled 3D faces with directional lighting and a perspective-correct depth buffer.
// Shared by the game and model inspector so the inspector shows the real geometry.
export function drawVoxelMesh(mesh,origin,basis,size,camera,frame,depth,width,height,light=[-.5,-.32,1.1],night=false){
  const {cos:c,sin:s,q,scale:S,tan:tn,cx,cy}=camera
  const dx=origin.x-camera.x,dy=origin.y-camera.y,U=dx*c-dy*s,V=-(dx*s+dy*c),Z=origin.z-camera.z
  const den0=1+q*V
  if(den0<.12)return 0
  const radius=Math.max(...mesh.bounds.flat().map(Math.abs))*size*S/Math.max(.12,den0)*2
  const x0=cx+S/den0*U,y0=cy-S/den0*(Z+tn*V)
  if(x0+radius<0||x0-radius>width||y0+radius<0||y0-radius>height)return 0
  const [right,back,up]=basis,lightLength=Math.hypot(...light),view=q>1e-6?[-U,-1/q-V,tn/q-Z]:[0,-1,tn]
  let drawn=0
  const triangle=(a,b,c,color)=>{
    const area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)
    if(Math.abs(area)<1e-8)return
    const minX=Math.max(0,Math.ceil(Math.min(a.x,b.x,c.x)-.5)),maxX=Math.min(width-1,Math.floor(Math.max(a.x,b.x,c.x)-.5))
    const minY=Math.max(0,Math.ceil(Math.min(a.y,b.y,c.y)-.5)),maxY=Math.min(height-1,Math.floor(Math.max(a.y,b.y,c.y)-.5))
    const inverse=1/area
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const px=x+.5,py=y+.5
      const w1=((b.x-px)*(c.y-py)-(b.y-py)*(c.x-px))*inverse
      const w2=((c.x-px)*(a.y-py)-(c.y-py)*(a.x-px))*inverse,w3=1-w1-w2
      if(w1<-.00001||w2<-.00001||w3<-.00001)continue
      const reciprocal=w1*a.i+w2*b.i+w3*c.i
      const z=(w1*a.d*a.i+w2*b.d*b.i+w3*c.d*c.i)/reciprocal,at=y*width+x
      if(z<=depth[at]+.001){frame[at]=color;depth[at]=z}
    }
  }
  for(const face of mesh.faces){
    const [nx,ny,nz]=face.normal
    const wx=right[0]*nx+back[0]*ny+up[0]*nz,wy=right[1]*nx+back[1]*ny+up[1]*nz,wz=right[2]*nx+back[2]*ny+up[2]*nz
    if((wx*c-wy*s)*view[0]-(wx*s+wy*c)*view[1]+wz*view[2]<=0)continue
    const vertices=[]
    for(const [x,y,z]of face.vertices){
      const vx=(right[0]*x+back[0]*y+up[0]*z)*size,vy=(right[1]*x+back[1]*y+up[1]*z)*size,vz=(right[2]*x+back[2]*y+up[2]*z)*size
      const depth=V-vx*s-vy*c,den=1+q*depth
      if(den<.12)break
      const m=S/den
      vertices.push({x:cx+m*(U+vx*c-vy*s),y:cy-m*(Z+vz+tn*depth),d:depth,i:1/den})
    }
    if(vertices.length!==4)continue
    const diffuse=(wx*light[0]+wy*light[1]+wz*light[2])/lightLength
    const shade=Math.max(.28,(night?.4:.62)+diffuse*(night?.4:.55)),col=pack(...face.color.map(v=>v*shade))
    triangle(vertices[0],vertices[1],vertices[2],col);triangle(vertices[0],vertices[2],vertices[3],col);drawn++
  }
  return drawn
}
