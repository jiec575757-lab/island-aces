import { UNIT_MODELS } from '../src/unit-models.js'
import { writeFile } from 'node:fs/promises'
const int=v=>{const b=Buffer.alloc(4);b.writeInt32LE(v);return b}
const chunk=(id,data,children=Buffer.alloc(0))=>Buffer.concat([Buffer.from(id),int(data.length),int(children.length),data,children])
for(const [id,voxels] of Object.entries(UNIT_MODELS)){
  const min=[0,1,2].map(i=>Math.min(...voxels.map(v=>v[i]))),max=[0,1,2].map(i=>Math.max(...voxels.map(v=>v[i])))
  const size=max.map((v,i)=>v-min[i]+1),colors=[...new Set(voxels.map(v=>v[3].join(',')))],rgba=Buffer.alloc(1024)
  colors.forEach((c,i)=>rgba.set([...c.split(',').map(Number),255],i*4))
  const entries=voxels.map(([x,y,z,c])=>Buffer.from([x-min[0],y-min[1],z-min[2],colors.indexOf(c.join(','))+1]))
  const children=Buffer.concat([chunk('SIZE',Buffer.concat(size.map(int))),chunk('XYZI',Buffer.concat([int(entries.length),...entries])),chunk('RGBA',rgba)])
  await writeFile(new URL(`../models/${id}.vox`,import.meta.url),Buffer.concat([Buffer.from('VOX '),int(150),chunk('MAIN',Buffer.alloc(0),children)]))
  await writeFile(new URL(`../models/${id}.json`,import.meta.url),JSON.stringify({name:id,source:'Original v1.2 voxel prop; matches the fighter palette',size,origin:min,voxels}))
  console.log(`${id}: ${entries.length} surface voxels, ${size.join('×')}`)
}
