// Stick positions are expressed in flight-screen axes even when CSS rotates the phone.
async function stickPoint(page,turn=0,climb=0){
  return page.locator('#flight-stick').evaluate((el,{turn,climb})=>{
    const r=el.getBoundingClientRect(),radius=el.clientWidth*.34
    const x=el.clientWidth/2+turn*radius,y=el.clientHeight/2+climb*radius
    return document.querySelector('#flight').classList.contains('portrait-landscape')?{x:r.right-y,y:r.top+x}:{x:r.left+x,y:r.top+y}
  },{turn,climb})
}
async function stickEvent(page,type,id,turn=0,climb=0){
  const p=await stickPoint(page,turn,climb)
  await page.locator('#flight-stick').dispatchEvent(type,{pointerId:id,pointerType:'touch',clientX:p.x,clientY:p.y,button:0})
}
module.exports={stickPoint,stickEvent}
