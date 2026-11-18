// A real 5×7 bitmap alphabet: no webfont, antialiasing or external request.
const glyphs={
  '0':['01110','10001','10011','10101','11001','10001','01110'],
  '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'],
  '3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'],
  '5':['11111','10000','10000','11110','00001','00001','11110'],
  '6':['01110','10000','10000','11110','10001','10001','01110'],
  '7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],
  '9':['01110','10001','10001','01111','00001','00001','01110'],
  H:['10001','10001','10001','11111','10001','10001','10001'],
  P:['11110','10001','10001','11110','10000','10000','10000'],
  A:['01110','10001','10001','11111','10001','10001','10001'],
  M:['10001','11011','10101','10101','10001','10001','10001'],
  O:['01110','10001','10001','10001','10001','10001','01110'],
  L:['10000','10000','10000','10000','10000','10000','11111'],
  V:['10001','10001','10001','10001','10001','01010','00100'],
  X:['10001','10001','01010','00100','01010','10001','10001'],
  S:['01111','10000','10000','01110','00001','00001','11110'],
  D:['11110','10001','10001','10001','10001','10001','11110'],
  '/':['00001','00001','00010','00100','01000','10000','10000'],
}
export function createPixelHud(canvas){
  const ctx=canvas.getContext('2d');let previous=''
  function text(value,x,y,color){
    const cells=[]
    for(const char of value){const g=glyphs[char];if(g)g.forEach((row,dy)=>[...row].forEach((v,dx)=>{if(v==='1')cells.push([x+dx,y+dy])}));x+=6}
    ctx.fillStyle='#091c2a';for(const [x,y]of cells)ctx.fillRect(x-1,y-1,3,3)
    ctx.fillStyle=color;for(const [x,y]of cells)ctx.fillRect(x,y,1,1)
  }
  return s=>{
    const hp=Math.ceil(s.hp),ammo=Math.floor(s.ammo),xp=Math.floor(s.xp),speed=Math.round(s.speed||0),signature=[hp,ammo,s.level,xp,s.xpNext,speed].join('/')
    if(signature===previous)return;previous=signature;ctx.clearRect(0,0,canvas.width,canvas.height)
    text(`HP ${hp}/100`,2,2,hp>30?'#b8f0cf':'#ff9272');text(`AMMO ${ammo}/${s.stats.ammoMax}`,88,2,'#c1e4ed')
    text(`LV ${String(s.level).padStart(2,'0')}`,2,15,'#ffda91');text(`XP ${xp}/${s.xpNext}`,88,15,'#ffda91')
    text(`SPD ${String(speed).padStart(3,'0')}`,2,28,'#bfece7')
    canvas.setAttribute('aria-label',`血量 ${hp}/100，弹药 ${ammo}/${s.stats.ammoMax}，等级 ${s.level}，经验 ${xp}/${s.xpNext}，速度 ${speed}`)
    canvas.dataset.hp=hp;canvas.dataset.ammo=ammo;canvas.dataset.level=s.level;canvas.dataset.xp=xp
    canvas.dataset.speed=speed
  }
}
