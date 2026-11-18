import { decodeJet, JET_W, JET_L, JET_PALETTE } from './jet-model.js'

// Solid voxel volumes, using the original fighter's stepped forms and palette.
const G=[91,99,111],D=[45,52,62],L=[153,163,174],O=[235,91,31],C=[40,172,187],K=[24,30,39],Y=[229,184,92]
const volume=parts=>{
  const map=new Map()
  const box=(x,y,z,w,l,h,c)=>{for(let k=0;k<h;k++)for(let j=0;j<l;j++)for(let i=0;i<w;i++)map.set(`${x+i},${y+j},${z+k}`,[x+i,y+j,z+k,c])}
  parts(box)
  return [...map.values()]
}
const jetPalette=new Map(JET_PALETTE.map(([id,r,g,b,f])=>[id,{rgb:[r,g,b],family:f}]))
const fighter=type=>volume(b=>{
  const accent=type==='fast'?Y:type==='tank'?[163,120,186]:type==='ally'?C:O
  decodeJet().forEach((slice,z)=>{
    for(let y=0;y<JET_L;y++)for(let x=0;x<JET_W;x++){
      const entry=jetPalette.get(slice[y*JET_W+x]);if(!entry)continue
      const brightness=Math.max(...entry.rgb)/255
      const color=entry.family===1?accent.map(v=>Math.round(v*brightness)):entry.family===2?(type==='ally'?C:Y).map(v=>Math.round(v*brightness)):entry.rgb
      b(x-17,y-25,z-5,1,1,1,color)
    }
  })
  // Different elite silhouettes, built on the actual original airframe volume.
  if(type==='tank'){
    b(-5,-7,-2,11,20,3,D);b(-5,-6,4,3,12,2,G);b(3,-6,4,3,12,2,G)
    for(const x of [-10,8]){b(x,0,-2,3,13,3,D);b(x,1,1,3,3,1,accent)}
  }
  if(type==='hunter')for(const x of [-11,9]){b(x,-7,-2,3,13,3,L);b(x,-8,-1,3,2,1,K);b(x,-2,1,3,2,1,O)}
  if(type==='fast'){b(-1,-13,2,3,5,2,L);b(0,6,7,1,8,3,accent)}
})
const turret=(b,x,y,z)=>{
  b(x-4,y-4,z,9,9,2,D);b(x-3,y-3,z+2,7,7,4,G);b(x-2,y-3,z+6,5,6,1,L)
  for(const dx of [-2,2]){b(x+dx,y-14,z+3,1,12,2,D);b(x+dx,y-14,z+4,1,9,1,L);b(x+dx,y-15,z+3,1,1,2,K)}
  b(x-3,y,z+5,7,2,1,O)
}

export const UNIT_MODELS={
  fighter:fighter('fighter'),fast:fighter('fast'),tank:fighter('tank'),hunter:fighter('hunter'),ally:fighter('ally'),
  missile:volume(b=>{
    // Octagonal body, rounded seeker, cruciform fins and recessed nozzle.
    for(let y=-16;y<=13;y++){
      const r=y<-14?0:y<-11?1:y<-8?2:y>11?2:3
      for(let z=-r;z<=r;z++)for(let x=-r;x<=r;x++)if(Math.abs(x)+Math.abs(z)<=r*1.6+.2)
        b(x,y,z,1,1,1,y<-12?K:y<-9?C:y===-6||y===-5?O:z===r?L:G)
    }
    for(let y=4;y<=12;y++){
      const span=3+Math.floor((y-4)/2)
      b(-span,y,0,span*2+1,1,1,y>10?O:D);b(0,y,-span,1,1,span*2+1,y>10?O:D)
    }
    b(-1,13,-1,3,1,3,K);b(0,14,0,1,1,1,Y)
    for(const x of [-4,4])b(x,-3,0,1,5,1,L)
  }),
  drone:volume(b=>{
    for(let y=-14;y<=11;y++){
      const w=y<-10?1:y<-5?2:y>7?2:3,h=y<-9?2:y>7?3:5
      b(-w,y,-2,w*2+1,1,h,y%6===0?L:G)
    }
    for(let x=4;x<=16;x++){
      const y=-5+Math.floor((x-4)*.65),len=Math.max(3,8-Math.floor((x-4)/3))
      b(x,y,0,1,len,2,x>13?D:G);b(-x,y,0,1,len,2,x>13?D:G)
    }
    b(-2,-10,3,5,7,2,C);b(-1,-9,5,3,4,1,L)
    b(-2,4,3,1,7,5,D);b(2,4,3,1,7,5,D);b(-2,7,8,5,3,1,O)
    for(const x of [-7,5]){b(x,1,-3,3,10,4,D);b(x,10,-2,3,1,2,O)}
    b(-1,12,-1,3,2,3,K);b(0,13,0,1,1,1,O)
  }),
  base:volume(b=>{
    for(let z=0;z<5;z++){const r=z<2?17:15;for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(Math.abs(x)+Math.abs(y)<r*1.75)b(x,y,z,1,1,1,z===4?L:D)}
    b(-10,-7,5,21,20,6,G);b(-9,-6,11,19,18,1,L);b(-10,3,8,21,2,2,O)
    b(-5,8,5,11,6,4,D);b(-4,13,5,9,1,3,K);b(-3,13,9,7,1,1,L)
    turret(b,0,-2,12)
    for(const x of [-15,11]){
      b(x,-9,5,5,16,3,D)
      for(let i=0;i<3;i++){b(x,-8+i*5,8,5,4,4,G);b(x,-8+i*5,12,5,4,1,L);b(x,-9+i*5,9,5,1,2,K);b(x,-7+i*5,11,5,1,1,O)}
    }
    b(9,9,12,2,2,13,D);b(5,9,22,10,2,5,G);b(6,8,23,8,1,3,C)
    b(-14,12,5,3,3,4,O);b(12,12,5,3,3,4,O)
  }),
  support:volume(b=>{
    b(-10,-10,0,21,21,2,D);b(-8,-8,2,17,17,3,G);b(-7,-7,5,15,15,1,L)
    turret(b,0,-1,6);b(-7,5,6,15,3,2,C);b(-6,6,8,13,1,1,L)
    for(const x of [-10,8])b(x,4,2,3,6,5,D)
  }),
  warship:volume(b=>{
    for(let y=-43;y<=39;y++){
      const half=Math.min(13,Math.floor((y+47)*.48),Math.floor((44-y)*1.2))
      for(let z=-4;z<=6;z++){const w=Math.max(1,half-(z<0?3:0));b(-w,y,z,w*2+1,1,1,z===6?L:z===3?O:z<1?K:D)}
    }
    for(const x of [-12,12])b(x,-19,7,1,42,1,L)
    b(-8,-2,7,17,21,5,G);b(-6,0,12,13,16,4,D);b(-5,1,16,11,12,3,L)
    b(-6,0,14,13,1,2,C);b(-6,2,14,1,8,2,C);b(6,2,14,1,8,2,C)
    b(-2,8,19,5,5,8,D);b(-1,7,27,3,3,5,G);b(-7,7,30,15,2,3,L);b(-6,6,31,13,1,1,C)
    turret(b,0,-26,7);turret(b,0,27,7)
    for(const x of [-9,5])for(let y=-15;y<=-6;y+=5){b(x,y,7,5,4,4,D);b(x,y,11,5,4,1,G);b(x+1,y+1,12,3,2,1,O)}
    b(-5,20,7,11,4,4,G);b(-4,21,11,9,2,1,K)
    b(-4,34,7,9,4,1,L);b(-1,33,8,3,6,1,C)
  }),
  gunboat:volume(b=>{
    for(let y=-25;y<=22;y++){
      const half=Math.min(9,Math.floor((y+28)*.62),25-y)
      for(let z=-3;z<=4;z++){const w=Math.max(1,half-(z<0?2:0));b(-w,y,z,w*2+1,1,1,z===4?L:z===2?O:K)}
    }
    b(-5,0,5,11,13,5,G);b(-4,1,10,9,10,2,L);b(-5,0,8,11,1,2,C)
    b(0,8,12,1,2,9,D);b(-4,8,19,9,1,2,G);turret(b,0,-12,5)
    for(const x of [-7,5]){b(x,13,5,3,6,3,D);b(x,14,8,3,3,1,O)}
  }),
}

export const UNIT_STYLES={
  fighter:{airframe:true},fast:{airframe:true},tank:{airframe:true},hunter:{airframe:true},ally:{airframe:true},
  missile:{scale:.48},drone:{scale:.68},base:{scale:1.35},support:{scale:1.25},warship:{scale:1.1},gunboat:{scale:1.1},
}
