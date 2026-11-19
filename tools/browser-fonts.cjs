const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {chromium}=require(process.env.ISLAND_PLAYWRIGHT||'C:/Users/192837465/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const base=process.env.ISLAND_URL||'http://127.0.0.1:4192/',out=path.join(__dirname,'..','artifacts'),errors=[],results=[],bad=[],external=[]
let browser
;(async()=>{
  browser=await chromium.launch({headless:true,executablePath:process.env.ISLAND_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'})
  for(const size of [{width:1280,height:800,mobile:false},{width:844,height:390,mobile:true},{width:740,height:320,mobile:true},{width:667,height:375,mobile:true}]){
    const page=await browser.newPage({viewport:{width:size.width,height:size.height},isMobile:size.mobile,hasTouch:size.mobile})
    page.on('pageerror',e=>errors.push(`${size.width}x${size.height}: ${e.message}`))
    page.on('response',r=>{if(r.status()>=400)bad.push({url:r.url(),status:r.status()})})
    page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:'))external.push(r.url())})
    await page.clock.install();await page.goto(base+'?inspect',{waitUntil:'networkidle'});await page.clock.runFor(900)
    const font=await page.evaluate(async()=>{await document.fonts.ready;return{family:getComputedStyle(document.documentElement).fontFamily,button:getComputedStyle(document.querySelector('#combat-toggle')).fontFamily,status:document.fonts.check('12px "Island Pixel"'),faces:[...document.fonts].map(f=>({family:f.family,status:f.status,weight:f.weight}))}})
    assert.match(font.family,/Island Pixel/);assert.match(font.button,/Island Pixel/);assert.equal(font.status,true);assert.ok(font.faces.every(f=>f.status==='loaded'))
    await page.screenshot({path:path.join(out,`pixel-font-menu-${size.width}x${size.height}.png`)})
    await page.locator('#combat-toggle').click();await page.clock.runFor(120)
    const hudFont=await page.evaluate(()=>getComputedStyle(document.querySelector('#message')).fontFamily);assert.match(hudFont,/Island Pixel/)
    await page.evaluate(()=>flightLab.combat.awardXP(flightLab.combat.state.xpNext));await page.clock.runFor(50)
    const upgrade=await page.evaluate(()=>{const d=document.querySelector('.upgrade-dialog'),cards=[...document.querySelectorAll('.upgrade-card')],r=d.getBoundingClientRect();return{title:getComputedStyle(document.querySelector('#upgrade-title')).fontFamily,cards:cards.length,overflow:cards.some(c=>{const b=c.getBoundingClientRect();return b.right>innerWidth+1||b.left<-1||b.bottom>innerHeight+1||b.top<-1}),desc:cards.every(c=>getComputedStyle(c.querySelector('p')).fontFamily.includes('Island Pixel')),scroll:[d.scrollWidth,d.clientWidth],height:[d.scrollHeight,d.clientHeight]}})
    assert.match(upgrade.title,/Island Pixel/);assert.equal(upgrade.cards,3);assert.equal(upgrade.desc,true);assert.equal(upgrade.overflow,false)
    await page.screenshot({path:path.join(out,`pixel-font-upgrade-${size.width}x${size.height}.png`)})
    await page.locator('.upgrade-card').first().click();await page.clock.runFor(30)
    await page.locator('#settings-toggle').click()
    const settings=await page.evaluate(()=>{const s=document.querySelector('#settings'),p=s.querySelector('.panel-body'),check=[...s.querySelectorAll('button,label,legend,select,input,output,a')];return{font:getComputedStyle(s).fontFamily,hOverflow:s.scrollWidth>s.clientWidth+1,pOverflow:p.scrollWidth>p.clientWidth+1,controls:check.length,small:check.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0}).every(el=>parseFloat(getComputedStyle(el).fontSize)>=9)}})
    assert.match(settings.font,/Island Pixel/);assert.equal(settings.hOverflow,false);assert.equal(settings.pOverflow,false);assert.ok(settings.controls>20);assert.equal(settings.small,true)
    await page.screenshot({path:path.join(out,`pixel-font-settings-${size.width}x${size.height}.png`)})
    await page.locator('#settings-close').click();await page.evaluate(()=>{for(let i=0;i<40;i++)flightLab.combat.step(.05);flightLab.combat.damage(99999)});await page.clock.runFor(30)
    assert.equal(await page.locator('#result-screen').isVisible(),true)
    assert.match(await page.locator('#result-screen .dialog').evaluate(el=>getComputedStyle(el).fontFamily),/Island Pixel/)
    await page.screenshot({path:path.join(out,`pixel-font-result-${size.width}x${size.height}.png`)})
    results.push({size:`${size.width}x${size.height}`,font,upgrade,settings});await page.close()
  }
  const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true})
  await page.addInitScript(()=>{let seed=1729;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}})
  page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.goto(base+'?inspect',{waitUntil:'networkidle'});await page.clock.runFor(900);await page.locator('#combat-toggle').click()
  await page.evaluate(()=>flightLab.setPaused(true))
  const session=await page.context().newCDPSession(page);await session.send('DOM.enable');await session.send('CSS.enable')
  const actualFonts=async selector=>{const {root}=await session.send('DOM.getDocument'),{nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector});return(await session.send('CSS.getPlatformFontsForNode',{nodeId})).fonts}
  const seen=new Set(),renderedFonts=new Set()
  for(let level=0;level<30&&seen.size<17;level++){
    await page.evaluate(()=>flightLab.combat.awardXP(flightLab.combat.state.xpNext-flightLab.combat.state.xp))
    for(let refresh=0;refresh<3;refresh++){
      const cards=await page.locator('.upgrade-card').evaluateAll(cards=>cards.map(c=>({id:c.dataset.upgrade,clipped:c.scrollWidth>c.clientWidth+1||c.scrollHeight>c.clientHeight+1})))
      for(const c of cards){seen.add(c.id);assert.equal(c.clipped,false,c.id)}
      const fonts=await actualFonts('.upgrade-dialog');assert.ok(fonts.length>0)
      for(const font of fonts){assert.equal(font.isCustomFont,true,JSON.stringify(font));assert.match(font.familyName,/Fusion Pixel/);renderedFonts.add(font.familyName)}
      if(refresh<2)await page.locator('#upgrade-refresh').click()
    }
    await page.locator('.upgrade-card').first().click()
  }
  assert.equal(seen.size,17)
  await page.goto(base+'models.html',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready)
  assert.match(await page.locator('code').first().evaluate(el=>getComputedStyle(el).fontFamily),/Island Pixel/)
  const modelFonts=await actualFonts('.model-page');assert.ok(modelFonts.length>0);assert.ok(modelFonts.every(f=>f.isCustomFont&&/Fusion Pixel/.test(f.familyName)))
  await page.close();assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);assert.deepEqual(external,[])
  const report={version:'1.6.3',date:new Date().toISOString(),site:base,passed:true,checks:['Local Fusion Pixel Chinese and Latin fonts load from the game assets with no external font request','Menu, combat message, upgrade cards, settings, result dialog and model page inherit the same pixel family','Desktop and three phone landscape sizes show all three upgrade cards within the viewport; settings do not overflow horizontally and native controls stay at least 9px','All 17 real upgrade offers render with custom Fusion Pixel glyphs in Chrome, without font fallback or clipped text; model page code text also uses the pixel face'],upgradeCount:seen.size,renderedFonts:[...renderedFonts],results,errors,bad,external}
  fs.writeFileSync(process.env.ISLAND_REPORT||path.join(out,'pixel-font-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close()
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1})
