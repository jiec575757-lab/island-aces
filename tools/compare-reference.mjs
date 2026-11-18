import { readFile, writeFile, mkdir } from 'node:fs/promises'
await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true})
import assert from 'node:assert/strict'
import { createScene } from '../src/scene.js'
let original = await readFile(new URL('../reference/scene.runtime.js', import.meta.url), 'utf8')
original = original.replace(/'\.\/jet-model\.ts\?v=[a-f\d]+'/g, JSON.stringify(new URL('../reference/jet-model.runtime.js', import.meta.url).href))
original = original.replace(/'\.\/cockpit\.ts\?v=[a-f\d]+'/g, JSON.stringify(new URL('../reference/cockpit.runtime.js', import.meta.url).href))
const { createScene: referenceScene } = await import('data:text/javascript;base64,'+Buffer.from(original).toString('base64'))
const metadata=JSON.parse(await readFile(new URL('../reference/share-metadata.json',import.meta.url),'utf8'))
const params={...metadata.fragment.variants[0].story.values}
const local=createScene(params),reference=referenceScene(params),results=[]
local.resize(427,267);reference.resize(427,267)
for(const view of ['top','chase','cockpit']) {
  params.view=view;local.setParams(params);reference.setParams(params)
  for(let i=0;i<150;i++){local.step(1/60);reference.step(1/60)}
  const a=local.render(),b=reference.render();let different=0
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])different++
  assert.equal(different,0,`${view} must preserve every reference scene pixel in free flight`)
  assert.deepEqual(local.flames,reference.flames)
  results.push({view,comparedBytes:a.length,differentBytes:different,flameGeometryIdentical:true})
}
const report={passed:true,note:'Canvas scene pixels and flame geometry; local HUD and combat are separate additions.',results}
await writeFile(new URL('../artifacts/reference-comparison.json',import.meta.url),JSON.stringify(report,null,2))
console.log(JSON.stringify(report,null,2))
