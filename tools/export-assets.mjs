import { decodeJet, JET_W as W, JET_L as L, JET_H as H, JET_PALETTE } from '../src/jet-model.js'
import { writeFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'
const slices=decodeJet(),pal=new Map(JET_PALETTE.map(([i,r,g,b])=>[i,[r,g,b,255]]))
function crc32(buffer){let c=0xffffffff;for(const b of buffer){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
function chunk(name,data){const t=Buffer.from(name),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc])}
async function png(name,width,height,pixels,scale=1){const w=width*scale,h=height*scale,raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=pixels[Math.floor(y/scale)*width+Math.floor(x/scale)];if(c)raw.set(pal.get(c),(y*(w*4+1))+1+x*4)}const header=Buffer.alloc(13);header.writeUInt32BE(w,0);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;await writeFile(new URL('../assets/'+name,import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]))}
const sheetW=(W+2)*H,sheetH=L+2,sheet=new Uint8Array(sheetW*sheetH),top=new Uint8Array(W*L),front=new Uint8Array(W*H),back=new Uint8Array(W*H),side=new Uint8Array(L*H)
for(let z=0;z<H;z++)for(let y=0;y<L;y++)for(let x=0;x<W;x++){const c=slices[z][y*W+x];sheet[(y+1)*sheetW+z*(W+2)+x+1]=c;if(c){top[y*W+x]=c;front[(H-1-z)*W+x] ||= c;back[(H-1-z)*W+x]=c;side[(H-1-z)*L+y]=c}}
await png('fighter-slices.png',sheetW,sheetH,sheet,3)
const fourW=W+L+12,fourH=L+H+12,four=new Uint8Array(fourW*fourH)
function place(data,w,h,ox,oy){for(let y=0;y<h;y++)for(let x=0;x<w;x++)four[(y+oy)*fourW+ox+x]=data[y*w+x]}
place(top,W,L,4,4);place(side,L,H,W+8,4+Math.floor((L-H)/2));place(front,W,H,4,L+8);place(back,W,H,W+8,L+8)
await png('fighter-reconstructed-four-views.png',fourW,fourH,four,5)
await writeFile(new URL('../models/fighter-slices.json',import.meta.url),JSON.stringify({source:'UI8 Forge / fighter public runtime, revision 39',width:W,length:L,height:H,palette:JET_PALETTE,slices:slices.map(s=>Array.from(s))}))
console.log('Exported sprite sheet, reconstructed four views, editable slice JSON.')
