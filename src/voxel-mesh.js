// Exposed, greedily merged quads from solid voxels; no billboards or sprites.
export function buildVoxelMesh(voxels){
  const occupied=new Map(voxels.map(v=>[`${v[0]},${v[1]},${v[2]}`,v])),faces=[]
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
    const u=(axis+1)%3,v=(axis+2)%3,layers=new Map()
    for(const voxel of voxels){
      const next=voxel.slice(0,3);next[axis]+=sign
      if(occupied.has(next.join(',')))continue
      let layer=layers.get(voxel[axis]);if(!layer)layers.set(voxel[axis],layer=new Map())
      layer.set(`${voxel[u]},${voxel[v]}`,{u:voxel[u],v:voxel[v],color:voxel[3],key:voxel[3].join(',')})
    }
    for(const [depth,layer]of layers){
      for(const cell of [...layer.values()].sort((a,b)=>a.v-b.v||a.u-b.u)){
        if(!layer.has(`${cell.u},${cell.v}`))continue
        const same=(a,b)=>layer.get(`${a},${b}`)?.key===cell.key
        let width=1,height=1
        while(same(cell.u+width,cell.v))width++
        outer:while(true){for(let i=0;i<width;i++)if(!same(cell.u+i,cell.v+height))break outer;height++}
        for(let j=0;j<height;j++)for(let i=0;i<width;i++)layer.delete(`${cell.u+i},${cell.v+j}`)
        const vertices=[[0,0],[width,0],[width,height],[0,height]].map(([a,b])=>{const p=[];p[axis]=depth+sign*.5;p[u]=cell.u-.5+a;p[v]=cell.v-.5+b;return p})
        const normal=[0,0,0];normal[axis]=sign
        faces.push({vertices,normal,color:cell.color})
      }
    }
  }
  const bounds=[0,1,2].map(i=>[Math.min(...voxels.map(v=>v[i]))-.5,Math.max(...voxels.map(v=>v[i]))+.5])
  return {faces,bounds}
}
