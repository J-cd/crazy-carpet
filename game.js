const sys = wx.getSystemInfoSync()
const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')
ctx.imageSmoothingEnabled = true
const W = canvas.width = sys.windowWidth
const H = canvas.height = sys.windowHeight
const DPR = sys.pixelRatio || 1
const carpetSprite = wx.createImage()
let carpetSpriteReady = false
carpetSprite.onload = () => { carpetSpriteReady = true; requestRender() }
carpetSprite.src = 'assets/carpet-patterns-v1.png'

const COLORS = {
  bg: '#FFF4DF', ink: '#34251F', cream: '#FFF9ED', orange: '#FF6B35',
  orange2: '#F34E25', yellow: '#FFD166', green: '#36B37E', blue: '#3A86FF', dirt: '#59483C'
}

// 上线前填入微信云开发环境 ID；留空时自动使用本地演示排行榜。
const CLOUD_ENV_ID = ''
const LEVEL_THEMES = ['童趣格纹','海盐涟漪','糖果斜纹','民族菱格','星空漩涡','春日波浪','复古花砖','森林迷彩','沙漠几何','霓虹迷宫','东方锦缎']

const provinces = ['北京','天津','河北','山西','内蒙古','辽宁','吉林','黑龙江','上海','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','广西','海南','重庆','四川','贵州','云南','西藏','陕西','甘肃','青海','宁夏','新疆','香港','澳门','台湾']
const demoScores = [9862,8350,7921,7450,6988,6412,5990,5531,5198,4820,4512,4201,3998,3780,3512,3260,3051,2890,2704,2510,2331,2180,1995,1840,1692,1510,1398,1210,1052,910,780,650,521,410]

const state = {
  scene: 'home', level: Math.min(99, wx.getStorageSync('unlockedLevel') || 1),
  tool: 0, cells: [], cleaned: 0, dragging: false, particles: [],
  province: wx.getStorageSync('province') || '广东', scroll: 0, completed: false,
  celebration: 0, config: null, levelScroll: 0, cloudRanks: null,
  hint: true, daily: wx.getStorageSync('dailyCleaned') || {date:'', count:0}, sound: wx.getStorageSync('soundOn') !== false,
  coins: wx.getStorageSync('coins') || 0, inventory: wx.getStorageSync('inventory') || [0,0,0], failed: false, boostUses: 0, broom: null
}

const tools = [
  {name:'打扫', icon:'🧹', radius:22, unlock:1, power:1, color:'#FFD166'},
  {name:'泡沫枪', icon:'🫧', radius:27, unlock:1, power:1, color:'#79D8F7'},
  {name:'水枪冲洗', icon:'💦', radius:34, unlock:1, power:1, color:'#3A86FF'}
]
const cleaningSteps = [
  {name:'打扫', hint:'用小扫帚打扫表面灰尘', target:82, color:'#A88B72'},
  {name:'喷泡沫', hint:'用泡沫枪覆盖灰色顽渍', target:82, color:'#79D8F7'},
  {name:'水枪冲洗', hint:'用水枪冲掉泡沫，露出最终图案', target:null, color:'#3A86FF'}
]
const shopItems = [
  {name:'强力泡沫', icon:'🫧', cost:40, note:'接下来 20 次清洗，力度 +2'},
  {name:'去渍喷雾', icon:'🧴', cost:75, note:'立即清除 8% 的污渍'},
  {name:'超级水枪', icon:'💦', cost:120, note:'立即清除 20% 的污渍'}
]

function seeded(level) { let n = (level * 9301 + 49297) % 233280; return () => ((n = n * 9301 + 49297) % 233280) / 233280 }
function levelConfig(level) {
  const chapter = Math.floor((level - 1) / 5), isGrand = level % 5 === 0
  return {
    theme: LEVEL_THEMES[chapter%LEVEL_THEMES.length], chapter: chapter + 1,
    isGrand,
    target: isGrand ? Math.min(94, 85 + chapter) : Math.min(97, 88 + chapter),
    timeLimit: Math.max(55, 95 - chapter * 2) + (isGrand ? 15 : 0),
    // 更细的污渍网格让清洁边缘平滑，不产生大块颗粒感。
    cellSize: Math.max(5, 8 - Math.floor((level - 1) / 30)),
    hardStainRate: level < 12 ? 0 : Math.min(.30, .06 + chapter * .025),
    maxStain: level < 28 ? 2 : level < 62 ? 3 : 4,
    seed: level * 7919 + chapter * 131
  }
}

function rr(x,y,w,h,r,fill,stroke,lw=1) {
  ctx.beginPath(); ctx.roundRect(x,y,w,h,r)
  if(fill){ctx.fillStyle=fill;ctx.fill()}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}
}
function text(s,x,y,size,color=COLORS.ink,align='left',weight='normal') {
  ctx.fillStyle=color;ctx.font=`${weight} ${size}px sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(s,x,y)
}
function carpetRect(){ return {x:28,y:175,w:W-56,h:Math.min(H-360,(W-56)*1.14)} }

function drawPattern(r, level, nested=false) {
  if(level%5===0&&!nested){drawGrandPattern(r,level);return}
  const palettes = [
    ['#173B5B','#D9A441','#F7E8C3','#8F2E3A'], ['#254F52','#E4B363','#FAF4E8','#B74F3B'],
    ['#4A306D','#B887A8','#F3E2C6','#D4654A'], ['#155B4B','#D7A44B','#F5EEE0','#9B3542'],
    ['#314E89','#E89C31','#F8E5BD','#B33E4D'], ['#1D5965','#D59567','#F3ECE0','#A34048'],
    ['#623C35','#D6AE66','#F8F1E3','#355C7D'], ['#354B70','#C7A44B','#F6E6C9','#A74D56'],
    ['#526B47','#D7A344','#F4EBDD','#9D4654'], ['#3C4F6B','#D98D52','#F7E3C1','#7B3657'],
    ['#6A3E55','#D7B05B','#F5E8D5','#3E6670'], ['#2D5961','#C9854A','#F6EEDC','#8C3D50']
  ]
  const rand=seeded(levelConfig(level).seed), p=palettes[(level*5+Math.floor(level/4))%palettes.length], kind=(level*11+Math.floor(level/7))%8
  ctx.save();ctx.beginPath();ctx.roundRect(r.x,r.y,r.w,r.h,18);ctx.clip()
  const bg=ctx.createLinearGradient(r.x,r.y,r.x+r.w,r.y+r.h);bg.addColorStop(0,p[2]);bg.addColorStop(1,'#FFF9ED');ctx.fillStyle=bg;ctx.fillRect(r.x,r.y,r.w,r.h)
  const cx=r.x+r.w/2, cy=r.y+r.h/2, unit=Math.max(17,20+(level%4)*3)
  if(carpetSpriteReady){
    const slot=(level-1)%8, sw=carpetSprite.width/4, sh=carpetSprite.height/2, sx=(slot%4)*sw+5, sy=Math.floor(slot/4)*sh+5
    ctx.drawImage(carpetSprite,sx,sy,sw-10,sh-10,r.x,r.y,r.w,r.h)
    // 轻微织物纹理，使拼图大关和独立关卡保持统一质感。
    ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=.5;for(let y=r.y+3;y<r.y+r.h;y+=8){ctx.beginPath();ctx.moveTo(r.x,y);ctx.lineTo(r.x+r.w,y);ctx.stroke()}
  } else if(kind===0){
    // 东方锦缎：细密花朵与金线
    ctx.fillStyle=p[0];ctx.globalAlpha=.13;for(let y=r.y-12;y<r.y+r.h+12;y+=unit*1.55)for(let x=r.x-12;x<r.x+r.w+12;x+=unit*1.55){ctx.beginPath();ctx.arc(x,y,unit*.62,0,7);ctx.fill()}ctx.globalAlpha=1
    for(let y=r.y+unit/2;y<r.y+r.h;y+=unit*1.55)for(let x=r.x+unit/2;x<r.x+r.w;x+=unit*1.55){ctx.strokeStyle=p[1];ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,unit*.32,0,7);ctx.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.fillStyle=p[3];ctx.beginPath();ctx.ellipse(x+Math.cos(a)*unit*.25,y+Math.sin(a)*unit*.25,unit*.13,unit*.06,a,0,7);ctx.fill()}ctx.fillStyle=p[1];ctx.beginPath();ctx.arc(x,y,unit*.08,0,7);ctx.fill()}
  } else if(kind===1){
    // 复古拱门
    const aw=unit*2.2;for(let x=r.x-aw;x<r.x+r.w+aw;x+=aw){for(let y=r.y;y<r.y+r.h+unit;y+=unit*1.45){ctx.strokeStyle=((Math.floor((x-r.x)/aw)+Math.floor((y-r.y)/unit))%2)?p[0]:p[3];ctx.lineWidth=unit*.32;ctx.beginPath();ctx.arc(x+aw/2,y+unit*.6,aw*.42,Math.PI,0);ctx.lineTo(x+aw*.92,y+unit*1.45);ctx.stroke()}}
  } else if(kind===2){
    // 摩洛哥菱形
    for(let y=r.y-unit;y<r.y+r.h+unit;y+=unit*1.45)for(let x=r.x-unit;x<r.x+r.w+unit;x+=unit*1.45){ctx.strokeStyle=(Math.floor((x-r.x)/unit)+Math.floor((y-r.y)/unit))%2?p[0]:p[3];ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x,y-unit*.56);ctx.lineTo(x+unit*.56,y);ctx.lineTo(x,y+unit*.56);ctx.lineTo(x-unit*.56,y);ctx.closePath();ctx.stroke();ctx.fillStyle=p[1];ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(x,y,unit*.09,0,7);ctx.fill();ctx.globalAlpha=1}
  } else if(kind===3){
    // 装饰艺术扇形
    for(let y=r.y+unit*.3;y<r.y+r.h+unit;y+=unit*1.55)for(let x=r.x-unit;x<r.x+r.w+unit;x+=unit*1.35){ctx.strokeStyle=(Math.floor((y-r.y)/unit)%2)?p[0]:p[3];ctx.lineWidth=2;for(let rad=unit*.32;rad<unit*1.18;rad+=unit*.22){ctx.beginPath();ctx.arc(x,y,rad,Math.PI*1.12,Math.PI*1.88);ctx.stroke()}ctx.fillStyle=p[1];ctx.beginPath();ctx.arc(x,y,unit*.09,0,7);ctx.fill()}
  } else if(kind===4){
    // 细腻植物藤蔓
    for(let y=r.y+unit;y<r.y+r.h+unit;y+=unit*1.5){ctx.strokeStyle=p[0];ctx.lineWidth=2;ctx.beginPath();for(let x=r.x-10;x<r.x+r.w+10;x+=6){const yy=y+Math.sin((x-r.x)*.045+y)*unit*.22;ctx.lineTo(x,yy)}ctx.stroke();for(let x=r.x+unit;x<r.x+r.w;x+=unit*1.4){const yy=y+Math.sin((x-r.x)*.045+y)*unit*.22;ctx.fillStyle=p[3];ctx.beginPath();ctx.ellipse(x,yy-unit*.22,unit*.15,unit*.34,-.45,0,7);ctx.fill();ctx.fillStyle=p[1];ctx.beginPath();ctx.ellipse(x+unit*.35,yy+unit*.18,unit*.14,unit*.3,.55,0,7);ctx.fill()}}
  } else if(kind===5){
    // 手绘水波
    for(let y=r.y-unit;y<r.y+r.h+unit;y+=unit*.7){ctx.strokeStyle=(Math.floor((y-r.y)/unit)%2)?p[0]:p[3];ctx.globalAlpha=.72;ctx.lineWidth=3;ctx.beginPath();for(let x=r.x-8;x<r.x+r.w+8;x+=5)ctx.lineTo(x,y+Math.sin((x-r.x)*.055+level)*unit*.16);ctx.stroke()}ctx.globalAlpha=1
  } else if(kind===6){
    // 复古花砖
    for(let y=r.y;y<r.y+r.h;y+=unit*1.25)for(let x=r.x;x<r.x+r.w;x+=unit*1.25){ctx.fillStyle=p[(Math.floor(x/unit)+Math.floor(y/unit))%2?0:3];ctx.fillRect(x,y,unit*1.25,unit*1.25);ctx.fillStyle=p[2];ctx.beginPath();ctx.arc(x+unit*.62,y+unit*.62,unit*.34,0,7);ctx.fill();ctx.fillStyle=p[1];for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.beginPath();ctx.ellipse(x+unit*.62+Math.cos(a)*unit*.35,y+unit*.62+Math.sin(a)*unit*.35,unit*.22,unit*.1,a,0,7);ctx.fill()}}
  } else {
    // 彩石水磨石
    for(let i=0;i<Math.floor(r.w*r.h/(unit*unit)*1.9);i++){const x=r.x+rand()*r.w,y=r.y+rand()*r.h,sz=unit*(.14+rand()*.42);ctx.fillStyle=[p[0],p[1],p[3]][i%3];ctx.globalAlpha=.72;ctx.beginPath();ctx.ellipse(x,y,sz,sz*(.45+rand()*.45),rand()*3,0,7);ctx.fill()}ctx.globalAlpha=1
  }
  ctx.strokeStyle='rgba(255,255,255,.72)';ctx.lineWidth=3;ctx.strokeRect(r.x+10,r.y+10,r.w-20,r.h-20)
  ctx.restore()
}

function drawGrandPattern(r, level) {
  const gap=5, halfW=(r.w-gap*3)/2, halfH=(r.h-gap*3)/2
  ctx.save();ctx.beginPath();ctx.roundRect(r.x,r.y,r.w,r.h,18);ctx.clip();ctx.fillStyle='#FFF9ED';ctx.fillRect(r.x,r.y,r.w,r.h)
  for(let i=0;i<4;i++){
    const x=r.x+gap+(i%2)*(halfW+gap),y=r.y+gap+Math.floor(i/2)*(halfH+gap)
    drawPattern({x,y,w:halfW,h:halfH},level-4+i,true)
    ctx.fillStyle='rgba(52,37,31,.72)';ctx.fillRect(x+7,y+7,58,22);text(`第 ${level-4+i} 关`,x+36,y+18,10,'white','center','bold')
  }
  ctx.restore();ctx.strokeStyle='#F7B801';ctx.lineWidth=6;ctx.beginPath();ctx.roundRect(r.x,r.y,r.w,r.h,18);ctx.stroke()
}

function drawActiveCleaner() {
  const a=state.activeCleaner
  if(!a || Date.now()-a.at>420)return
  ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.phase===0?a.angle+.72:0);ctx.globalAlpha=Math.max(.2,1-(Date.now()-a.at)/540)
  if(a.phase===0){
    ctx.fillStyle='#A66A37';ctx.fillRect(-4,-34,8,36);ctx.fillStyle='#E2B15A';ctx.beginPath();ctx.moveTo(-15,3);ctx.lineTo(15,3);ctx.lineTo(11,22);ctx.lineTo(-11,22);ctx.closePath();ctx.fill();ctx.strokeStyle='#865126';ctx.lineWidth=2;ctx.stroke();for(let i=-8;i<=8;i+=4){ctx.beginPath();ctx.moveTo(i,6);ctx.lineTo(i,21);ctx.stroke()}
  } else if(a.phase===1){
    // 固定朝右的泡沫枪，白色泡沫持续成束喷射。
    const flow=(Date.now()%420)/420
    rr(-24,-11,38,21,7,'#48BDE8','#22698A',2);rr(8,-17,19,13,4,'#F7FEFF','#22698A',2);ctx.fillStyle='#235F78';ctx.fillRect(-9,8,8,19)
    ctx.strokeStyle='rgba(255,255,255,.86)';ctx.lineWidth=4;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(27,i*5);ctx.bezierCurveTo(42,i*5-3,54,i*5+3,68,i*5);ctx.stroke()}
    ctx.fillStyle='#FFFFFF';for(let i=0;i<9;i++){const d=31+((i*8+flow*25)%42),yy=((i%3)-1)*6+Math.sin(flow*6+i)*2;ctx.beginPath();ctx.arc(d,yy,1.8+(i%3)*.65,0,7);ctx.fill()}
  } else {
    // 固定朝右的水枪，蓝色水流持续冲洗泡沫。
    const flow=(Date.now()%360)/360
    rr(-25,-12,40,22,7,'#3A86FF','#1558A8',2);rr(9,-17,20,12,4,'#8EDCF4','#1558A8',2);ctx.fillStyle='#1558A8';ctx.fillRect(-8,8,8,19)
    ctx.strokeStyle='#62D2FF';ctx.lineWidth=4;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(29,i*5);ctx.bezierCurveTo(45,i*5+4,58,i*5-4,77,i*5);ctx.stroke()}
    ctx.fillStyle='#B5F0FF';for(let i=0;i<8;i++){const d=34+((i*9+flow*32)%48),yy=((i%3)-1)*6;ctx.beginPath();ctx.arc(d,yy,1+(i%2),0,7);ctx.fill()}
  }
  ctx.restore()
}

function resetPhaseCells() {
  const g=state.grid, rand=seeded(state.config.seed+state.phase*1009)
  state.cells=new Uint8Array(g.total);state.cleaned=0
  for(let i=0;i<state.cells.length;i++){
    const hard=state.phase===2 && rand()<state.config.hardStainRate
    state.cells[i]=hard ? 2+Math.floor(rand()*(state.config.maxStain-1)) : 1
  }
}
function createResidualStains() {
  const rand=seeded(state.config.seed+404), r=state.grid.r, count=4+(state.level%3)
  state.residualStains=[]
  for(let i=0;i<count;i++)state.residualStains.push({
    x:r.x+r.w*(.15+rand()*.70), y:r.y+r.h*(.16+rand()*.68),
    rx:24+rand()*30, ry:15+rand()*25, rotation:rand()*Math.PI, seed:rand()
  })
}
function drawResidualStains() {
  if(!state.residualStains)return
  for(const spot of state.residualStains){
    ctx.save();ctx.translate(spot.x,spot.y);ctx.rotate(spot.rotation);ctx.fillStyle='rgba(91,83,77,.60)';ctx.beginPath()
    for(let i=0;i<12;i++){const a=i*Math.PI/6, wobble=.76+((Math.sin(i*4.1+spot.seed*19)+1)*.12);const x=Math.cos(a)*spot.rx*wobble,y=Math.sin(a)*spot.ry*wobble;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fill()
    ctx.strokeStyle='rgba(54,48,44,.20)';ctx.lineWidth=2;ctx.stroke();ctx.globalAlpha=.25;ctx.fillStyle='#4A413B'
    for(let i=0;i<10;i++){const a=i*2.4+spot.seed*4,rad=(i%4+1)*Math.min(spot.rx,spot.ry)*.16;ctx.beginPath();ctx.arc(Math.cos(a)*rad,Math.sin(a)*rad,1.3+(i%3),0,7);ctx.fill()}
    ctx.restore()
  }
}
function initLevel(level) {
  state.level=level;state.phase=0;state.tool=0;state.cleaned=0;state.completed=false;state.failed=false;state.particles=[];state.hint=true;state.config=levelConfig(level);state.startedAt=Date.now();state.boostUses=0
  const r=carpetRect(), size=state.config.cellSize, cols=Math.ceil(r.w/size), rows=Math.ceil(r.h/size)
  state.grid={r,size,cols,rows,total:cols*rows}
  createResidualStains()
  resetPhaseCells()
}

function currentTarget(){ return cleaningSteps[state.phase].target || state.config.target }
function nextStep(){
  if(state.phase===2){completeLevel();return}
  state.phase++;state.tool=state.phase;state.hint=true;state.boostUses=0;resetPhaseCells()
  for(let i=0;i<24;i++)state.particles.push({x:state.grid.r.x+Math.random()*state.grid.r.w,y:state.grid.r.y+Math.random()*state.grid.r.h,vx:(Math.random()-.5)*1.2,vy:-Math.random()*1.2,life:28,r:1+Math.random()*2,type:state.phase})
  try { wx.vibrateShort({type:'medium'}) } catch (_) {}
}

function cleanAt(x,y) {
  if(state.completed||state.failed)return
  if(state.tool!==state.phase){state.wrongToolFlash=Date.now();try { wx.vibrateShort({type:'light'}) } catch (_) {};return}
  const g=state.grid,t=tools[state.tool], power=t.power+(state.boostUses>0?2:0), gx=Math.floor((x-g.r.x)/g.size), gy=Math.floor((y-g.r.y)/g.size), cr=Math.ceil(t.radius/g.size)
  for(let yy=gy-cr;yy<=gy+cr;yy++)for(let xx=gx-cr;xx<=gx+cr;xx++){
    if(xx>=0&&yy>=0&&xx<g.cols&&yy<g.rows&&Math.hypot((xx+.5)*g.size+g.r.x-x,(yy+.5)*g.size+g.r.y-y)<t.radius){const i=yy*g.cols+xx;if(state.cells[i]){state.cells[i]=Math.max(0,state.cells[i]-power);if(!state.cells[i])state.cleaned++}}
  }
  state.activeCleaner={x,y,angle:state.phase===0?(state.lastSweep?Math.atan2(y-state.lastSweep.y,x-state.lastSweep.x):-.45):0,at:Date.now(),phase:state.phase}
  if(state.phase===0)state.broom=state.activeCleaner
  state.lastSweep={x,y}
  const particleCount=state.phase===0?5:state.phase===1?9:6
  for(let i=0;i<particleCount;i++){
    const spraying=state.phase>0
    state.particles.push({x:x+(spraying?18:(Math.random()-.5)*13),y:y+(Math.random()-.5)*11,vx:spraying?(1.8+Math.random()*2):(Math.random()-.5)*1.5,vy:spraying?(Math.random()-.5)*1.1:(-.2-Math.random()),life:20,r:.8+Math.random()*(state.phase===1?2:1.4),type:state.phase})
  }
  state.hint=false
  if(state.boostUses>0)state.boostUses--
  if(state.cleaned/g.total*100>=currentTarget()) nextStep()
}

function completeLevel(){
  state.completed=true;state.celebration=90
  const unlocked=Math.max(wx.getStorageSync('unlockedLevel')||1,Math.min(99,state.level+1));wx.setStorageSync('unlockedLevel',unlocked)
  const today = new Date().toISOString().slice(0,10)
  state.daily = state.daily.date===today ? {date:today,count:state.daily.count+1} : {date:today,count:1};wx.setStorageSync('dailyCleaned',state.daily)
  state.coins += 100;wx.setStorageSync('coins',state.coins)
  submitCompletion()
  try { wx.vibrateShort({type:'medium'}) } catch (_) {}
}

function timeLeft() { return Math.max(0, Math.ceil(state.config.timeLimit - (Date.now()-state.startedAt)/1000)) }
function useItem(index) {
  if (!state.inventory[index] || state.completed || state.failed) return
  state.inventory[index]--
  if(index===0) state.boostUses=20
  else {
    const count=Math.ceil(state.grid.total*(index===1?.08:.20)),rand=seeded(Date.now()%999999)
    let removed=0,tries=0
    while(removed<count&&tries<count*15){const i=Math.floor(rand()*state.cells.length);if(state.cells[i]){state.cells[i]=0;state.cleaned++;removed++}tries++}
    for(let i=0;i<18;i++)state.particles.push({x:state.grid.r.x+rand()*state.grid.r.w,y:state.grid.r.y+rand()*state.grid.r.h,vx:(rand()-.5)*1.2,vy:-rand()*1.2,life:24,r:1+rand()*2,type:state.phase})
  }
  wx.setStorageSync('inventory',state.inventory);try { wx.vibrateShort({type:'medium'}) } catch (_) {}
  if(state.cleaned/state.grid.total*100>=currentTarget())nextStep()
}
function buyItem(index) {
  const item=shopItems[index]
  if(state.coins<item.cost)return
  state.coins-=item.cost;state.inventory[index]++;wx.setStorageSync('coins',state.coins);wx.setStorageSync('inventory',state.inventory)
  try { wx.vibrateShort({type:'light'}) } catch (_) {}
}

function submitCompletion() {
  if (CLOUD_ENV_ID && wx.cloud && wx.cloud.callFunction) {
    wx.cloud.callFunction({name:'submitScore',data:{province:state.province,level:state.level},success:() => { state.cloudRanks=null },fail:saveLocalScore})
  } else saveLocalScore()
}
function saveLocalScore() { const key='provinceScores',scores=wx.getStorageSync(key)||{};scores[state.province]=(scores[state.province]||0)+1;wx.setStorageSync(key,scores) }
function refreshRanks() {
  if (!(CLOUD_ENV_ID && wx.cloud && wx.cloud.callFunction)) return
  wx.cloud.callFunction({name:'getProvinceRanks',data:{},success(res){if(res.result&&Array.isArray(res.result.ranks)){state.cloudRanks=res.result.ranks;requestRender()}},fail(){state.cloudRanks=null}})
}

if (CLOUD_ENV_ID && wx.cloud) { try { wx.cloud.init({env:CLOUD_ENV_ID}) } catch (_) {} }
if (wx.showShareMenu) { try { wx.showShareMenu({withShareTicket:true}) } catch (_) {} }

function header(title, back=true){
  text(title,W/2,62,24,COLORS.ink,'center','bold')
  if(back){rr(18,42,42,40,16,COLORS.cream);text('‹',39,62,32,COLORS.ink,'center','bold')}
}

function drawHome(){
  ctx.fillStyle=COLORS.bg;ctx.fillRect(0,0,W,H)
  for(let i=0;i<8;i++){ctx.globalAlpha=.1;ctx.fillStyle=i%2?COLORS.orange:COLORS.yellow;ctx.beginPath();ctx.arc((i*83)%W,80+i*71,35+i%3*8,0,7);ctx.fill()}ctx.globalAlpha=1
  text('疯狂',W/2,112,42,COLORS.orange,'center','bold');text('地毯',W/2,156,54,COLORS.ink,'center','bold')
  rr(W-128,22,108,38,18,COLORS.cream,'#E7D7C5',1);text(`🪙 ${state.coins}  商店`,W-74,41,13,COLORS.ink,'center','bold')
  text('洗掉污渍，揭开惊喜图案',W/2,202,16,'#826B5F','center')
  const r={x:W*.17,y:238,w:W*.66,h:W*.68};drawPattern(r,state.level)
  ctx.fillStyle='rgba(63,45,35,.28)';ctx.beginPath();ctx.roundRect(r.x+8,r.y+8,r.w-16,r.h-16,14);ctx.fill()
  ctx.save();ctx.translate(W*.69,270);ctx.rotate(-.22);rr(-28,-8,56,80,18,COLORS.yellow,COLORS.ink,3);text('🧽',0,28,32,COLORS.ink,'center');ctx.restore()
  const by=Math.min(H-168,r.y+r.h+35);rr(34,by,W-68,58,22,COLORS.orange2);text(`开始清洗 · 第 ${state.level} 关`,W/2,by+29,20,'white','center','bold')
  rr(34,by+70,(W-78)/2,50,18,COLORS.cream,'#E7D7C5',1);text('🗺 关卡地图',(W-10)/4,by+95,16,COLORS.ink,'center','bold')
  rr((W+10)/2,by+70,(W-78)/2,50,18,COLORS.cream,'#E7D7C5',1);text('🏆 省份排行',(3*W+10)/4,by+95,16,COLORS.ink,'center','bold')
  text(`今日已焕新 ${state.daily.count || 0} 张 · 99 张地毯等你焕新`,W/2,H-20,13,'#9A8376','center')
}

function drawGame(){
  ctx.fillStyle=COLORS.bg;ctx.fillRect(0,0,W,H);header(`第 ${state.level} / 99 关`)
  rr(W-60,42,42,40,16,COLORS.cream);text('↻',W-39,62,23,COLORS.ink,'center','bold')
  const pct=Math.min(100,Math.floor(state.cleaned/state.grid.total*100)), target=currentTarget(), seconds=timeLeft(), urgent=seconds<=10
  cleaningSteps.forEach((step,i)=>{const x=W*(i+.5)/3,done=i<state.phase;rr(x-49,92,98,25,12,i===state.phase?step.color:(done?'#BFE5CF':'#E7D8C6'));text(`${done?'✓ ':''}${i+1}.${step.name}`,x,104,11,i===state.phase||done?'white':'#8F7B70','center','bold')})
  rr(75,124,W-150,10,5,'#E7D8C6');rr(75,124,(W-150)*Math.min(pct,target)/target,5,cleaningSteps[state.phase].color);text(`${pct}% / ${target}%`,W/2,148,14,cleaningSteps[state.phase].color,'center','bold')
  text(`⏱ ${seconds}s · ${state.config.isGrand?'大图案挑战':cleaningSteps[state.phase].hint}`,W/2,164,11,urgent?COLORS.orange:'#826B5F','center','bold')
  drawPattern(state.grid.r,state.level)
  ctx.save();ctx.beginPath();ctx.roundRect(state.grid.r.x,state.grid.r.y,state.grid.r.w,state.grid.r.h,18);ctx.clip()
  const g=state.grid
  // 打扫只移除浮灰；第 2 步保留不规则顽渍，必须用泡沫和水枪处理。
  if(state.phase===1)drawResidualStains()
  const overlay=[['104,86,72',.60],['255,255,255',.88],['255,255,255',.92]][state.phase]
  for(let y=0;y<g.rows;y++)for(let x=0;x<g.cols;x++){
    const strength=state.cells[y*g.cols+x], visible=state.phase===1 ? !strength : strength
    if(visible){ctx.fillStyle=`rgba(${overlay[0]},${Math.min(.94,overlay[1]+(strength-1)*.05)})`;ctx.fillRect(g.r.x+x*g.size,g.r.y+y*g.size,g.size,g.size)}
  }
  ctx.restore()
  ctx.strokeStyle='#6C4E3B';ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(g.r.x,g.r.y,g.r.w,g.r.h,18);ctx.stroke()
  for(const p of state.particles){ctx.globalAlpha=Math.min(1,p.life/25);ctx.fillStyle=p.type===0?'#8B7768':p.type===1?'#FFFDF4':'#8EDCF4';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill();p.x+=p.vx;p.y+=p.vy;p.life--}ctx.globalAlpha=1;state.particles=state.particles.filter(p=>p.life>0)
  drawActiveCleaner()
  const iy=H-168;shopItems.forEach((item,i)=>{const x=W*(i+.5)/3;rr(x-49,iy,98,30,14,state.inventory[i]?'#FFF0DE':COLORS.cream,state.inventory[i]?COLORS.orange:'#E5D7C7',1);text(`${item.icon} ×${state.inventory[i]}`,x,iy+15,13,state.inventory[i]?COLORS.ink:'#9A8376','center','bold')});if(state.boostUses)text(`强力泡沫生效：${state.boostUses} 次`,W/2,iy-10,12,COLORS.orange,'center','bold')
  const ty=H-108;ctx.fillStyle=COLORS.cream;ctx.fillRect(0,ty-18,W,126)
  tools.forEach((t,i)=>{const x=W*(i+.5)/3, unlocked=state.level>=t.unlock;rr(x-48,ty-6,96,72,20,i===state.tool&&unlocked?'#FFE0C8':'#FFF9ED',i===state.tool&&unlocked?COLORS.orange:'#E5D7C7',2);text(unlocked?t.icon:'🔒',x,ty+16,28,COLORS.ink,'center');text(unlocked?t.name:`${t.unlock}关解锁`,x,ty+49,12,unlocked?COLORS.ink:'#A58E81','center',unlocked?'bold':'normal')})
  if(state.hint&&!state.completed){rr(40,state.grid.r.y+18,W-80,42,18,'rgba(255,249,237,.94)');text(`第 ${state.phase+1} 步：${cleaningSteps[state.phase].hint}`,W/2,state.grid.r.y+39,14,COLORS.ink,'center','bold')}
  if(state.wrongToolFlash&&Date.now()-state.wrongToolFlash<1000){rr(55,state.grid.r.y+70,W-110,34,16,'rgba(255,224,200,.95)');text(`请先使用「${tools[state.phase].name}」`,W/2,state.grid.r.y+87,13,COLORS.orange,'center','bold')}
  if(state.completed){ctx.fillStyle='rgba(32,22,18,.58)';ctx.fillRect(0,0,W,H);rr(35,H/2-135,W-70,270,28,COLORS.cream);text(state.config.isGrand?'🏆':'✨',W/2,H/2-88,42,COLORS.ink,'center');text(state.config.isGrand?`第 ${state.config.chapter} 大关完成！`:'清洗完成！',W/2,H/2-38,29,COLORS.orange,'center','bold');text(`奖励  🪙 100 金币`,W/2,H/2,18,COLORS.orange,'center','bold');text(`${pct>=99?'完美焕新 · ':'达标焕新 · '}${state.config.isGrand?'四图合一':'第 '+state.level+' 关'}`,W/2,H/2+25,15,'#806A5E','center');rr(64,H/2+48,W-128,54,20,COLORS.orange2);text(state.level===99?'返回首页':'下一张地毯',W/2,H/2+75,18,'white','center','bold')}
  if(state.failed){ctx.fillStyle='rgba(32,22,18,.58)';ctx.fillRect(0,0,W,H);rr(35,H/2-125,W-70,250,28,COLORS.cream);text('⌛',W/2,H/2-78,42,COLORS.ink,'center');text('时间到！',W/2,H/2-30,29,COLORS.orange,'center','bold');text('再试一次，快速焕新地毯吧',W/2,H/2+6,15,'#806A5E','center');rr(64,H/2+38,W-128,54,20,COLORS.orange2);text('重新挑战',W/2,H/2+65,18,'white','center','bold')}
}

function getRanks(){if(state.cloudRanks)return state.cloudRanks;const own=wx.getStorageSync('provinceScores')||{};return provinces.map((p,i)=>({p,n:demoScores[i]+(own[p]||0)})).sort((a,b)=>b.n-a.n)}
function drawRank(){
  ctx.fillStyle=COLORS.bg;ctx.fillRect(0,0,W,H);header('全国省份清洗榜')
  rr(20,98,W-40,65,20,COLORS.orange);text('我的省份',40,119,13,'rgba(255,255,255,.8)');text(state.province,40,143,20,'white','left','bold');text('点击更换 ›',W-38,132,14,'white','right')
  const ranks=getRanks(), start=185, row=56
  ctx.save();ctx.beginPath();ctx.rect(0,start,W,H-start);ctx.clip()
  ranks.forEach((it,i)=>{const y=start+i*row-state.scroll;if(y<start-60||y>H+10)return;rr(20,y,W-40,48,16,it.p===state.province?'#FFE1C9':COLORS.cream);text(i<3?['🥇','🥈','🥉'][i]:String(i+1),43,y+24,i<3?22:15,COLORS.ink,'center','bold');text(it.p,76,y+24,16,COLORS.ink,'left',it.p===state.province?'bold':'normal');text(`${it.n.toLocaleString()} 张`,W-38,y+24,15,i<3?COLORS.orange:'#715D52','right','bold')})
  ctx.restore()
}

function drawLevels(){
  ctx.fillStyle=COLORS.bg;ctx.fillRect(0,0,W,H);header('关卡地图')
  const unlocked=wx.getStorageSync('unlockedLevel')||1, col=5, gap=12, bw=(W-36-gap*(col-1))/col, top=105, bh=58
  ctx.save();ctx.beginPath();ctx.rect(0,95,W,H-95);ctx.clip()
  for(let i=1;i<=99;i++){const index=i-1,c=index%col,row=Math.floor(index/col),x=18+c*(bw+gap),y=top+row*(bh+gap)-state.levelScroll,open=i<=unlocked,grand=i%5===0;if(y<40||y>H+20)continue;rr(x,y,bw,bh,18,open?(i===state.level?'#FFBE77':grand?'#FFF0BC':COLORS.cream):'#E6D8C9',open&&i===state.level?COLORS.orange:grand?'#F0B429':'#DAC8B5',2);text(open?String(i):'🔒',x+bw/2,y+22,open?19:15,open?COLORS.ink:'#A48C7E','center','bold');if(grand&&open)text('大图案',x+bw/2,y+44,10,COLORS.orange,'center','bold');else if(open&&i===state.level)text('当前',x+bw/2,y+46,10,COLORS.orange,'center','bold')}
  ctx.restore();text(`已解锁 ${unlocked} / 99 关`,W/2,H-22,13,'#806A5E','center')
}

function drawProvince(){
  ctx.fillStyle=COLORS.bg;ctx.fillRect(0,0,W,H);header('选择我的省份')
  provinces.forEach((p,i)=>{const col=i%3,row=Math.floor(i/3),x=18+col*(W-24)/3,y=100+row*48;rr(x,y,(W-42)/3,38,14,p===state.province?COLORS.orange:COLORS.cream,p===state.province?null:'#E9D8C6');text(p,x+(W-42)/6,y+19,14,p===state.province?'white':COLORS.ink,'center',p===state.province?'bold':'normal')})
}

function drawShop(){
  ctx.fillStyle=COLORS.bg;ctx.fillRect(0,0,W,H);header('清洗道具商店')
  rr(28,96,W-56,52,18,'#FFF0DE');text(`我的金币  🪙 ${state.coins}`,W/2,122,19,COLORS.orange,'center','bold')
  shopItems.forEach((item,i)=>{const y=170+i*132;rr(24,y,W-48,112,22,COLORS.cream,'#E6D3BF',1);rr(42,y+18,58,58,18,'#FFE3B7');text(item.icon,71,y+47,31,COLORS.ink,'center');text(item.name,117,y+31,19,COLORS.ink,'left','bold');text(item.note,117,y+57,12,'#806A5E','left');text(`持有 ×${state.inventory[i]}`,117,y+82,12,COLORS.orange,'left','bold');rr(W-108,y+68,66,30,14,state.coins>=item.cost?COLORS.orange2:'#C9B8AA');text(`🪙${item.cost}`,W-75,y+83,13,'white','center','bold')})
  text('购买后可在清洗关卡底部的背包中使用',W/2,H-28,13,'#806A5E','center')
}

let renderPending=false
function render(){
  if(state.scene==='game'&&!state.completed&&!state.failed&&timeLeft()<=0){state.failed=true;state.dragging=false}
  if(state.scene==='home')drawHome();else if(state.scene==='game')drawGame();else if(state.scene==='rank')drawRank();else if(state.scene==='levels')drawLevels();else if(state.scene==='shop')drawShop();else drawProvince()
  if(state.particles.length)requestRender()
  if(state.scene==='game'&&!state.completed&&!state.failed)setTimeout(requestRender,200)
}
function requestRender(){if(!renderPending){renderPending=true;requestAnimationFrame(()=>{renderPending=false;render()})}}

function pos(e){const t=e.touches&&e.touches[0]||e.changedTouches&&e.changedTouches[0];return t?{x:t.clientX,y:t.clientY}:null}
let lastY=0
wx.onTouchStart(e=>{const p=pos(e);if(!p)return;lastY=p.y
  if(state.scene==='home'){
    const r=carpetRect(),by=Math.min(H-168,238+W*.68+35)
    if(p.x>W-145&&p.y<78)state.scene='shop'
    else if(p.y>=by&&p.y<by+62){initLevel(state.level);state.scene='game'}else if(p.y>=by+66&&p.y<by+128){if(p.x<W/2){state.scene='levels';state.levelScroll=0}else{state.scene='rank';state.scroll=0;refreshRanks()}}
  }else if(state.scene==='game'){
    if(state.completed){if(p.y>H/2+25&&p.y<H/2+115){if(state.level<99){initLevel(state.level+1)}else state.scene='home'};return}
    if(state.failed){if(p.y>H/2+20&&p.y<H/2+110)initLevel(state.level);return}
    if(p.x<65&&p.y<90){state.scene='home';return}
    if(p.x>W-72&&p.y<90){initLevel(state.level);return}
    if(p.y>H-182&&p.y<H-128){const i=Math.max(0,Math.min(2,Math.floor(p.x/(W/3))));useItem(i);return}
    if(p.y>H-135){const i=Math.max(0,Math.min(2,Math.floor(p.x/(W/3))));if(state.level>=tools[i].unlock){state.tool=i;try { wx.vibrateShort({type:'light'}) } catch (_) {}};return}
    const r=state.grid.r;if(p.x>r.x&&p.x<r.x+r.w&&p.y>r.y&&p.y<r.y+r.h){state.dragging=true;cleanAt(p.x,p.y)}
  }else if(state.scene==='rank'){
    if(p.x<65&&p.y<90)state.scene='home';else if(p.y>=98&&p.y<=170)state.scene='province'
  }else if(state.scene==='levels'){
    if(p.x<65&&p.y<90){state.scene='home';return}
    const col=5,gap=12,bw=(W-36-gap*(col-1))/col,top=105,bh=58,c=Math.floor((p.x-18)/(bw+gap)),row=Math.floor((p.y-top+state.levelScroll)/(bh+gap)),i=row*col+c+1,unlocked=wx.getStorageSync('unlockedLevel')||1
    if(c>=0&&c<col&&i>=1&&i<=unlocked&&((p.x-18)%(bw+gap))<=bw&&((p.y-top+state.levelScroll)%(bh+gap))<=bh){initLevel(i);state.scene='game'}
  }else if(state.scene==='shop'){
    if(p.x<65&&p.y<90){state.scene='home';return}
    for(let i=0;i<shopItems.length;i++){const y=170+i*132;if(p.x>W-120&&p.y>y+55&&p.y<y+110){buyItem(i);return}}
  }else{
    if(p.x<65&&p.y<90){state.scene='rank';return}
    if(p.y>=100){const col=Math.floor((p.x-18)/((W-24)/3)),row=Math.floor((p.y-100)/48),i=row*3+col;if(col>=0&&col<3&&i>=0&&i<provinces.length){state.province=provinces[i];wx.setStorageSync('province',state.province);state.scene='rank'}}
  }
  requestRender()
})
wx.onTouchMove(e=>{const p=pos(e);if(!p)return;if(state.scene==='game'&&state.dragging)cleanAt(p.x,p.y);else if(state.scene==='rank'){state.scroll=Math.max(0,Math.min(34*56-(H-185),state.scroll+lastY-p.y));lastY=p.y}else if(state.scene==='levels'){state.levelScroll=Math.max(0,Math.min(20*70-(H-95),state.levelScroll+lastY-p.y));lastY=p.y}requestRender()})
wx.onTouchEnd(()=>{state.dragging=false;requestRender()})

initLevel(state.level);requestRender()
