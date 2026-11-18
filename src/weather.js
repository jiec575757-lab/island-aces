export const WEATHER={clear:{name:'晴朗',clouds:0,rain:0,fog:0},cloudy:{name:'多云',clouds:.22,rain:0,fog:.06},rain:{name:'阵雨',clouds:.35,rain:.65,fog:.09},storm:{name:'雷雨',clouds:.5,rain:1,fog:.12},fog:{name:'海雾',clouds:.1,rain:0,fog:.25}}
const cycle=['clear','cloudy','rain','storm','fog'],fract=x=>x-Math.floor(x)
export function createWeather(canvas,onChange=()=>{},onThunder=()=>{}){
  const ctx=canvas.getContext('2d');let mode='auto',current='clear',elapsed=0,phase=0,thunder=8,flash=0,frames=0
  function select(next){current=next;phase=0;thunder=8;flash=0;canvas.dataset.mode=current;onChange({...WEATHER[current],id:current})}
  function step(dt){
    elapsed+=dt;phase+=dt;flash=Math.max(0,flash-dt)
    if(mode==='auto'&&phase>=65)select(cycle[(cycle.indexOf(current)+1)%cycle.length])
    if(current==='storm'){thunder-=dt;if(thunder<=0){flash=.13;thunder=11;onThunder()}}
  }
  function render(){
    const w=canvas.width,h=canvas.height,info=WEATHER[current];ctx.clearRect(0,0,w,h);frames++
    if(current==='clear')return
    ctx.fillStyle=`rgba(150,175,185,${info.fog})`;ctx.fillRect(0,0,w,h)
    if(info.fog){
      ctx.fillStyle=`rgba(205,225,223,${info.fog*.4})`
      for(let i=0;i<5;i++){const y=fract(i*.217+elapsed*.009)*h;ctx.fillRect(0,Math.round(y),w,Math.max(3,Math.round(h*.08)))}
    }
    if(info.rain){
      const count=Math.round(90*info.rain),wind=current==='storm'?15:8
      for(let i=0;i<count;i++){
        const z=.55+fract(i*.618)*.8,x=Math.round(fract(i*.754877+elapsed*.12*z)*w),y=Math.round(fract(i*.56984+elapsed*.8*z)*h)
        ctx.fillStyle=i%3?'#b0d5e2aa':'#e2f5f1bb'
        for(let j=0;j<(current==='storm'?7:5);j++)ctx.fillRect(x-Math.round(j*wind/14),y+j,1,1)
      }
    }
    if(flash>0){ctx.fillStyle=`rgba(224,239,242,${flash*.9})`;ctx.fillRect(0,0,w,h)}
    canvas.dataset.mode=current
  }
  return{step,render,setMode(value){if(value!=='auto'&&!WEATHER[value])return false;mode=value;select(value==='auto'?'clear':value);return true},get state(){return{mode,current,name:WEATHER[current].name,elapsed,phase,frames,flash}}}
}
