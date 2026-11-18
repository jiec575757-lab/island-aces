// Chunky, low-poly voxel props in the same grey/orange/cyan palette as the fighter.
const mesh=(parts)=>{
  const map=new Map()
  const box=(x,y,z,w,l,h,c)=>{for(let k=0;k<h;k++)for(let j=0;j<l;j++)for(let i=0;i<w;i++)map.set(`${x+i},${y+j},${z+k}`,[x+i,y+j,z+k,c])}
  parts(box)
  return [...map.values()].filter(([x,y,z])=>[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].some(([a,b,c])=>!map.has(`${x+a},${y+b},${z+c}`)))
}
const G=[91,99,111],D=[45,52,62],L=[139,148,153],O=[235,91,31],C=[40,172,187],K=[28,34,43],Y=[211,171,92]
export const UNIT_MODELS={
  missile:mesh(b=>{
    // Tapered seeker, cylindrical stepped body, four swept tail fins, orange band and nozzle.
    for(let y=-12;y<=9;y++){
      const radius=y<-10?.5:y<-7?1:y>7?1.25:2
      for(let z=-2;z<=2;z++)for(let x=-2;x<=2;x++)if(x*x+z*z<=radius*radius+.2)
        b(x,y,z,1,1,1,y<-8?D:y===-5||y===-4?O:z>0?L:G)
    }
    for(let y=1;y<=8;y++){const span=2+Math.floor((y-1)/2);b(-span,y,0,span*2+1,1,1,D);b(0,y,-span,1,1,span*2+1,D)}
    b(-1,-2,2,2,5,1,L);b(0,-11,0,1,2,1,C);b(-1,9,-1,3,2,3,K);b(0,10,0,1,2,1,Y)
  }),
  drone:mesh(b=>{b(0,-10,1,1,2,1,L);b(-1,-8,1,3,3,2,G);b(-2,-5,1,5,10,3,G);b(-1,5,1,3,3,2,D);
    for(let x=3;x<=11;x++){const y=-3+Math.floor((x-3)*.6);b(x,y,2,1,4,1,x>9?D:G);b(-x,y,2,1,4,1,x>9?D:G)}
    b(-6,5,1,13,2,1,D);b(-1,-6,4,3,5,1,C);b(-2,-1,3,5,2,1,L);b(-1,7,1,3,2,2,O)}),
  base:mesh(b=>{b(-11,-11,0,23,23,1,D);b(-9,-9,1,19,19,2,G);b(-7,-7,3,15,15,3,L);b(-5,-5,6,11,11,2,D);
    b(-4,-5,8,9,8,3,G);b(-4,-5,11,9,2,1,O);b(-2,1,11,5,2,1,C);
    b(-4,-17,9,2,13,2,D);b(3,-17,9,2,13,2,D);b(-4,-17,10,2,1,1,K);b(3,-17,10,2,1,1,K);
    b(-9,-6,6,3,10,3,G);b(7,-6,6,3,10,3,G);b(-9,-6,8,3,2,1,O);b(7,-6,8,3,2,1,O);
    b(-9,7,3,2,2,4,G);b(8,7,3,2,2,4,G)}),
  support:mesh(b=>{b(-8,-8,0,17,17,1,D);b(-6,-6,1,13,13,2,G);b(-4,-3,3,9,8,2,L);b(-5,-2,5,11,2,1,O);b(-3,3,4,7,2,2,C);
    b(-3,-11,4,2,10,2,D);b(2,-11,4,2,10,2,D);b(-3,-11,5,2,1,1,K);b(2,-11,5,2,1,1,K)}),
}
