import { decodeJet, JET_W, JET_L, JET_H, JET_PALETTE } from '../src/jet-model.js'
import { writeFile } from 'node:fs/promises'

const slices = decodeJet(), rgba = Buffer.alloc(256 * 4), index = new Map()
JET_PALETTE.forEach((row, i) => {
  index.set(row[0], i + 1)
  rgba.set([row[1], row[2], row[3], 255], i * 4)
})
function int(v) { const b = Buffer.alloc(4); b.writeInt32LE(v); return b }
function chunk(id, content, children = Buffer.alloc(0)) {
  return Buffer.concat([Buffer.from(id), int(content.length), int(children.length), content, children])
}
const entries = []
for (let z = 0; z < JET_H; z++) for (let y = 0; y < JET_L; y++) for (let x = 0; x < JET_W; x++) {
  const color = slices[z][y * JET_W + x]
  if (color) entries.push(Buffer.from([x, y, z, index.get(color)]))
}
const children = Buffer.concat([
  chunk('SIZE', Buffer.concat([int(JET_W), int(JET_L), int(JET_H)])),
  chunk('XYZI', Buffer.concat([int(entries.length), ...entries])),
  chunk('RGBA', rgba),
])
const vox = Buffer.concat([Buffer.from('VOX '), int(150), chunk('MAIN', Buffer.alloc(0), children)])
await writeFile(new URL('../models/fighterjet.vox', import.meta.url), vox)
console.log(`Wrote ${entries.length} voxels (${JET_W}x${JET_L}x${JET_H})`)
