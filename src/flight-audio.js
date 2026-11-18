// Original synthesized score and effects: no streamed tracks or licensed audio files.
export function createFlightAudio(){
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
  let enabled=read('island-aces-sfx',true),music=read('island-aces-music',true),volume=read('island-aces-volume',.35)
  let ctx,master,musicBus,sfxBus,engine,engineGain,engineOsc,unlocked=false,running=true,nextNote=0,beat=0,notes=0,effects=0,lastShot=-1
  const save=()=>{try{localStorage.setItem('island-aces-sfx',JSON.stringify(enabled));localStorage.setItem('island-aces-music',JSON.stringify(music));localStorage.setItem('island-aces-volume',JSON.stringify(volume))}catch{}}
  const mix=()=>{if(!ctx)return;master.gain.setTargetAtTime(volume,ctx.currentTime,.06);musicBus.gain.setTargetAtTime(music&&running?.2:0,ctx.currentTime,.08);sfxBus.gain.setTargetAtTime(enabled&&running?.55:0,ctx.currentTime,.06)}
  function tone(freq,time,duration,gain,type='triangle',bus=musicBus,end=freq){
    const oscillator=ctx.createOscillator(),envelope=ctx.createGain();oscillator.type=type;oscillator.frequency.setValueAtTime(freq,time);oscillator.frequency.exponentialRampToValueAtTime(Math.max(10,end),time+duration)
    envelope.gain.setValueAtTime(.0001,time);envelope.gain.exponentialRampToValueAtTime(gain,time+.008);envelope.gain.exponentialRampToValueAtTime(.0001,time+duration)
    oscillator.connect(envelope).connect(bus);oscillator.start(time);oscillator.stop(time+duration+.02);oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect()}
  }
  async function unlock(){
    try{
      if(!ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;ctx=new Audio();master=ctx.createGain();musicBus=ctx.createGain();sfxBus=ctx.createGain();musicBus.connect(master);sfxBus.connect(master);master.connect(ctx.destination)
        engineGain=ctx.createGain();engineGain.gain.value=0;engineGain.connect(sfxBus);engineOsc=ctx.createOscillator();engineOsc.type='sawtooth';engineOsc.frequency.value=44;engineOsc.connect(engineGain);engineOsc.start();engine=true
      }
      await ctx.resume();unlocked=true;nextNote=ctx.currentTime+.05;mix();return true
    }catch{return false}
  }
  function step({boost=0,speed=92,combat=false,paused=false}={}){
    running=!paused;mix();if(!ctx||!unlocked)return
    engineOsc.frequency.setTargetAtTime(35+speed*.18+boost*18,ctx.currentTime,.15);engineGain.gain.setTargetAtTime(running?.008+boost*.018:0,ctx.currentTime,.1)
    if(!running||!music){nextNote=ctx.currentTime+.1;return}
    if(nextNote<ctx.currentTime-.4)nextNote=ctx.currentTime+.05
    const melody=[0,7,12,7,3,10,14,10,5,12,17,12,3,10,15,10],tempo=combat?.19:.26
    while(nextNote<ctx.currentTime+.12){
      const bar=Math.floor(beat/16)%4,root=[45,48,41,43][bar],midi=root+12+melody[beat%16],frequency=440*2**((midi-69)/12)
      tone(frequency,nextNote,tempo*.85,.12,'triangle');if(beat%4===0)tone(440*2**((root-69)/12),nextNote,tempo*3,.16,'triangle')
      if(combat&&beat%2===0)tone(90,nextNote,.1,.1,'sine',musicBus,35)
      notes++;beat++;nextNote+=tempo
    }
  }
  function play(kind){
    if(!ctx||!unlocked||!enabled||!running)return
    const now=ctx.currentTime
    if(kind==='shot'&&now-lastShot<.075)return
    if(kind==='shot')lastShot=now
    const shape={shot:[600,.065,.055,'square',110],hit:[190,.18,.15,'sawtooth',40],kill:[110,.32,.17,'sawtooth',22],roll:[260,.28,.08,'triangle',720],upgrade:[520,.32,.11,'sine',1040],missile:[130,.25,.08,'sawtooth',470],thunder:[48,1.3,.12,'sawtooth',16]}[kind]||[320,.15,.06,'triangle',600]
    tone(shape[0],now,shape[1],shape[2],shape[3],sfxBus,shape[4]);effects++
  }
  return{unlock,step,play,configure(options){if('sfx'in options)enabled=!!options.sfx;if('music'in options)music=!!options.music;if('volume'in options)volume=Math.max(0,Math.min(1,options.volume));save();mix()},get state(){return{sfx:enabled,music,volume,unlocked,context:ctx?.state||'locked',notes,effects,running,engine:!!engine}}}
}
