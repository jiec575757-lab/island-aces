import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, relative, isAbsolute } from 'node:path'

const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'dist','github-pages')
const rel=relative(root,out)
if(isAbsolute(rel)||rel.startsWith('..')||rel.replaceAll('\\','/')!=='dist/github-pages')throw new Error('Unexpected Pages output path')
await rm(out,{recursive:true,force:true})
await mkdir(out,{recursive:true})
const files=['index.html','models.html','style.css','src','assets','models','reference','README.md','制作说明.md','肉鸽玩法说明.md','GitHub发布说明.md','.nojekyll']
for(const name of files)await cp(resolve(root,name),resolve(out,name),{recursive:true})
await writeFile(resolve(out,'.nojekyll'),'')
console.log(`GitHub Pages site ready: ${out}`)
