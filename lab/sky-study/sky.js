'use strict';

// Standalone study: no imports from the extension, storage, or remote services.
const $ = selector => document.querySelector(selector);
const TAU = Math.PI * 2, RAD = Math.PI / 180, HORIZON = .555;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const rgb = h => h.match(/\w\w/g).map(x => parseInt(x, 16));
const blend = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const color = (c, a = 1) => `rgba(${c.map(Math.round).join(',')},${clamp(a)})`;
const wrapHour = h => ((h % 24) + 24) % 24;
function clock(h) {
  const m = Math.floor(wrapHour(h) * 60 + .00001) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const places = [
  ['Рейкьявик', 64.15, -21.94, 'Atlantic/Reykjavik'],
  ['Берлин', 52.52, 13.4, 'Europe/Berlin'],
  ['Белград', 44.81, 20.46, 'Europe/Belgrade'],
  ['Нью-Йорк', 40.71, -74.01, 'America/New_York'],
  ['Дубай', 25.2, 55.27, 'Asia/Dubai'],
  ['Сингапур', 1.35, 103.82, 'Asia/Singapore'],
  ['Рио', -22.91, -43.17, 'America/Sao_Paulo'],
  ['Сидней', -33.87, 151.21, 'Australia/Sydney'],
  ['Ушуайя', -54.8, -68.3, 'America/Argentina/Ushuaia'],
];
const state = { hour:6.3, playing:false, duration:90, place:2, source:'solar', date:$('#date').value };
// Render settings are separate from playback state. During integration pass the
// stored settings to Scene.draw(); sunSharpness blends two behaviours:
// 0 atmospheric light (point at sunrise, dissolved at noon), 1 visible disk.
const skySettings = { sunSharpness:1 };

// NOAA fractional-year approximation; civil timezone offset comes from IANA/Intl
// for the selected date, so DST is not hard-coded to the date of this demo.
function solarSchedule() {
  const [, lat, lon, zone] = places[state.place];
  const date = new Date(`${state.date}T12:00:00Z`);
  const n = Math.floor((date - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000);
  const g = TAU / 365 * (n - 1);
  const decl = .006918 - .399912 * Math.cos(g) + .070257 * Math.sin(g)
    - .006758 * Math.cos(2*g) + .000907 * Math.sin(2*g)
    - .002697 * Math.cos(3*g) + .00148 * Math.sin(3*g);
  const eq = 229.18 * (.000075 + .001868 * Math.cos(g) - .032077 * Math.sin(g)
    - .014615 * Math.cos(2*g) - .040849 * Math.sin(2*g));
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23',
  }).formatToParts(date).map(p => [p.type, p.value]));
  const offset = (Date.UTC(+parts.year, +parts.month-1, +parts.day, +parts.hour, +parts.minute, +parts.second) - date.getTime()) / 3600000;
  const phi = lat * RAD;
  const noon = (720 - 4*lon - eq) / 60 + offset;
  const threshold = (Math.sin(-.833*RAD) - Math.sin(phi)*Math.sin(decl)) / (Math.cos(phi)*Math.cos(decl));
  const polar = threshold < -1 ? 'day' : threshold > 1 ? 'night' : null;
  const half = Math.acos(clamp(threshold, -1, 1)) / RAD / 15;
  if (state.source === 'fixed') {
    // Equinox-like virtual sun with the same apparent day length at every place.
    return { sr:6.5, ss:18.5, noon:12.5, phi:0, decl:0, polar:null, fixed:true };
  }
  return { sr:noon-half, ss:noon+half, noon, phi, decl, polar, fixed:false };
}
let schedule = solarSchedule();

function sunPosition(hour) {
  const s = schedule;
  const angle = (hour - s.noon) * Math.PI / 12;
  const sinAlt = Math.sin(s.phi)*Math.sin(s.decl) + Math.cos(s.phi)*Math.cos(s.decl)*Math.cos(angle);
  const altitude = Math.asin(clamp(sinAlt, -1, 1)) / RAD;
  // Refraction moves the apparent disk to the horizon at the tabulated sunrise.
  const apparent = altitude + .833;
  const maxAlt = Math.asin(clamp(Math.sin(s.phi)*Math.sin(s.decl) + Math.cos(s.phi)*Math.cos(s.decl), -1, 1)) / RAD + .833;
  let progress = (hour - s.sr) / Math.max(.01, s.ss-s.sr);
  if (s.polar === 'day') progress = wrapHour(hour - s.noon + 12) / 24;
  const x = mix(.065, .935, clamp(progress));
  const y = HORIZON - clamp(apparent / Math.max(12, maxAlt), -.3, 1) * .445;
  return { altitude, apparent, x:places[state.place][1] < 0 ? 1-x : x, y };
}

// Keyframes are keyed to physical solar elevation, not the clock hour. The two
// theme palettes keep their own identity even at the opposite time of day.
const palette = [
  [-18, ['b4bece','c5ced9','d9dde0','e3e4e2'], ['090f21','151f36','243047','111822']],
  [-10, ['a7b7d0','c3cada','d9c7d3','e5dedc'], ['12223e','303d60','65536e','242b3b']],
  [-5,  ['afbfd7','d5c6d4','efc1a7','eae0d4'], ['263e60','70617c','b77c70','3b3944']],
  [0,   ['b9ccdf','e4cdd0','f4c896','eee4d5'], ['344e6e','927e8a','dbab7a','45444a']],
  [8,   ['c4dce8','dfe4df','f4e1ba','eeeae0'], ['304c66','526c80','b3ab95','2b353d']],
  [30,  ['c9dfe8','e2e9e7','f3ebd7','f0eee8'], ['253e56','40596c','7d8c90','202b35']],
  [90,  ['c9dfe8','e2e9e7','f3ebd7','f0eee8'], ['253e56','40596c','7d8c90','202b35']],
].map(([e,l,d]) => [e,l.map(rgb),d.map(rgb)]);
function atmosphere(e, dark) {
  const i = Math.max(1, palette.findIndex(p => p[0] >= e));
  const lo = palette[i-1], hi = palette[i];
  const t = smooth(lo[0], hi[0], e);
  return lo[1].map((c,j) => blend(blend(c,hi[1][j],t),blend(lo[2][j],hi[2][j],t),dark));
}

// Deterministic, uniform spherical catalogue. Never regenerated on resize.
let seed = 81276;
function random() { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed/4294967296; }
const stars = Array.from({length:620}, () => {
  const z = random()*2-1, a = random()*TAU, r = Math.sqrt(1-z*z);
  return { x:r*Math.cos(a), y:r*Math.sin(a), z, magnitude:random()**3,
    phase:random()*TAU, warm:random()>.8 };
});
function starStamp(warm) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 24;
  const c = canvas.getContext('2d');
  const g = c.createRadialGradient(12,12,0,12,12,12);
  const tint = warm ? '255,218,177' : '224,237,255';
  g.addColorStop(0,`rgba(${tint},1)`); g.addColorStop(.17,`rgba(${tint},.95)`);
  g.addColorStop(.36,`rgba(${tint},.22)`); g.addColorStop(1,`rgba(${tint},0)`);
  c.fillStyle=g; c.fillRect(0,0,24,24); return canvas;
}
const stamps = [starStamp(false),starStamp(true)];

// Cached endpoint alpha textures shared by all scenes. Sample an analytic falloff
// instead of joining a few linear colour stops into visible concentric bands.
const sunStamps=new Map();
function sunStamp(sharpness) {
  if(sunStamps.has(sharpness)) return sunStamps.get(sharpness);
  const size=512, canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d'), image=ctx.createImageData(size,size);
  const softness=1-sharpness, shape=smooth(0,.65,softness);
  const core=mix(.76,0,shape), sigma=mix(.07,.29,shape);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const r=Math.hypot((x+.5-size/2)/(size/2),(y+.5-size/2)/(size/2));
    const distance=Math.max(0,r-core)/sigma;
    const alpha=Math.exp(-.5*distance*distance)*(1-smooth(.82,1,r));
    // Stable sub-level dithering breaks 8-bit alpha rings without animation or
    // a grain overlay. RGB stays constant; only light intensity changes radially.
    let hash=Math.imul(x+1,374761393)^Math.imul(y+1,668265263);
    hash=Math.imul(hash^(hash>>>13),1274126177);
    const noise=((hash^(hash>>>16))>>>0)/4294967296-.5;
    const i=(y*size+x)*4;
    image.data[i]=image.data[i+1]=image.data[i+2]=255;
    image.data[i+3]=Math.round(clamp(alpha*255+noise,0,255));
  }
  ctx.putImageData(image,0,0);
  sunStamps.set(sharpness,canvas);
  return canvas;
}

class Scene {
  constructor(mode, index, title, caption) {
    this.mode=mode;
    const el=document.createElement('article'); el.className='scene-wrap';
    el.innerHTML=`<div class="scene-head"><h2><span class="number">0${index+1}</span>${title}</h2><div class="scene-actions"><button class="button fullscreen">Во весь экран</button><button class="button enlarge" aria-pressed="false">Крупно ↗</button></div></div>
      <div class="tab"><canvas aria-hidden="true"></canvas><div class="ui">
      <div class="todos"><strong>Сегодня</strong><span class="done">Позвонить в банк</span><span>Купить кофе</span><span>Ревью PR</span></div>
      <div class="clock">06:18</div><div class="date-line"></div>
      <div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>Поиск</div>
      <div class="tiles"><i class="tile">▶</i><i class="tile">⌘</i><i class="tile">M</i><i class="tile">✳</i><i class="tile">✴</i></div><span class="gear">⚙</span>
      </div></div><div class="scene-caption"><span>${caption}</span><span class="scene-phase"></span></div>`;
    $('#scenes').append(el);
    this.el=el; this.tab=el.querySelector('.tab'); this.canvas=el.querySelector('canvas');
    this.ctx=this.canvas.getContext('2d',{alpha:false}); this.clock=el.querySelector('.clock');
    // Reused transparent layer: the horizon mask affects only sunlight.
    this.sunLayer=document.createElement('canvas'); this.sunCtx=this.sunLayer.getContext('2d');
    this.phase=el.querySelector('.scene-phase'); this.date=el.querySelector('.date-line');
    el.querySelector('.enlarge').addEventListener('click',()=>{
      const active=!el.classList.contains('active');
      for(const scene of scenes) {
        scene.el.classList.remove('active');
        const button=scene.el.querySelector('.enlarge'); button.textContent='Крупно ↗'; button.setAttribute('aria-pressed','false');
      }
      document.body.classList.toggle('solo',active);
      if(active) { el.classList.add('active'); el.querySelector('.enlarge').textContent='← Все три'; el.querySelector('.enlarge').setAttribute('aria-pressed','true'); }
      else if(document.fullscreenElement) document.exitFullscreen().catch(()=>{});
      window.scrollTo(0,0); invalidate();
    });
    el.querySelector('.fullscreen').addEventListener('click',async()=>{
      try { if(document.fullscreenElement) await document.exitFullscreen(); else await $('#lab').requestFullscreen(); } catch { /* Native fullscreen may be blocked by the host. Solo still works. */ }
    });
    new ResizeObserver(()=>{this.resize();invalidate();}).observe(this.tab);
  }
  resize() {
    const {width,height}=this.tab.getBoundingClientRect();
    if(!width || !height) return;
    // Fixed pixel budget: no giant retina buffers when a scene is enlarged.
    const scale=Math.min(devicePixelRatio||1,1.5,1500/width);
    this.w=width; this.h=height;
    this.canvas.width=Math.round(width*scale); this.canvas.height=Math.round(height*scale);
    this.ctx.setTransform(this.canvas.width/width,0,0,this.canvas.height/height,0,0);
    this.sunLayer.width=this.canvas.width; this.sunLayer.height=this.canvas.height;
    this.sunCtx.setTransform(this.canvas.width/width,0,0,this.canvas.height/height,0,0);
  }
  glow(x,y,rx,ry,tint,alpha) {
    if(alpha<.002) return;
    const c=this.ctx;
    c.save(); c.translate(x,y); c.scale(rx,ry);
    const g=c.createRadialGradient(0,0,0,0,0,1);
    g.addColorStop(0,color(tint,alpha)); g.addColorStop(.25,color(tint,alpha*.65));
    g.addColorStop(.6,color(tint,alpha*.2)); g.addColorStop(1,color(tint,0));
    c.fillStyle=g; c.fillRect(-1,-1,2,2); c.restore();
  }
  draw(sun, stampTime, { sunSharpness = 1 } = {}) {
    if(!this.w || !this.el.offsetHeight) return;
    const c=this.ctx,w=this.w,h=this.h,hy=h*HORIZON,e=sun.altitude;
    const dark=this.mode==='dark'?1:this.mode==='light'?0:1-smooth(-7,3,e);
    const tones=atmosphere(e,dark);
    const gradient=c.createLinearGradient(0,0,0,h);
    // The horizon has volume: no rectangular overlay or sharp ground boundary.
    [0,.36,HORIZON,.82,1].forEach((stop,i)=>gradient.addColorStop(stop,color(tones[Math.min(i,3)])));
    c.fillStyle=gradient; c.fillRect(0,0,w,h);
    const twilight=smooth(-17,-4,e)*(1-smooth(2,16,e));
    const warm=blend(rgb('ec8d7c'),rgb('ffd6a0'),smooth(-7,5,e));
    this.glow(sun.x*w,hy,w*.76,h*.19,warm,twilight*mix(.32,.47,dark));
    // A broad cool band above the warm haze gives blue hour depth.
    this.glow(w*.5,hy-h*.17,w*.8,h*.16,rgb('9198d0'),twilight*.09);
    this.drawStars(e,dark,stampTime);
    const sx=sun.x*w,sy=sun.y*h;
    const daylight=smooth(-2,2,e);
    const low=1-smooth(0,23,e);
    const sunlight=blend(rgb('ffad66'),rgb('fff4d2'),smooth(0,27,e));
    // Atmospheric aureole may extend below the horizon.
    this.glow(sx,sy,w*mix(.23,.32,low),h*mix(.35,.17,low),sunlight,daylight*mix(.23,.29,low));
    this.glow(sx,hy,w*.44,h*.085,sunlight,daylight*low*.22);
    const sharpness=clamp(sunSharpness);
    const softness=1-sharpness;
    const spread=smooth(0,1,softness);
    if(sun.apparent>mix(-.8,-8,spread)) {
      const s=this.sunCtx;
      s.clearRect(0,0,w,h);
      const radius=w*.0095;
      this.glow(sx,sy,radius*5,radius*4,sunlight,.4*daylight*sharpness);
      const paintLight=(rx,ry,alpha,profile)=>{
        if(alpha<.001) return;
        s.save(); s.globalAlpha=alpha;
        s.drawImage(sunStamp(profile),sx-rx,sy-ry,rx*2,ry*2); s.restore();
      };
      // The abstract endpoint changes with the sun's journey, rather than just
      // enlarging a blurred disk. A small warm source disappears into daylight;
      // a separate broad field colours the air throughout the transition.
      const height=clamp((HORIZON-sun.y)/.445);
      const dissolved=smooth(.08,.65,height);
      const abstractUp=smooth(-3,1,sun.apparent);
      const fieldRadius=w*mix(.48,.7,dissolved);
      paintLight(fieldRadius,fieldRadius*mix(.28,.8,dissolved),
        softness*abstractUp*mix(.72,.5,dark),0);
      paintLight(w*.024,w*.024*mix(.78,1,dissolved),
        softness*abstractUp*(1-dissolved)*.95,0);
      // A crossfade of fixed-size sources keeps the style slider predictable.
      paintLight(radius*1.12,radius*1.12*mix(.78,1,smooth(0,12,e)),sharpness*.97,1);
      s.globalCompositeOperation='source-in';
      s.fillStyle=color(blend(sunlight,[255,253,234],.35*sharpness));
      s.fillRect(0,0,w,h);
      s.globalCompositeOperation='source-over';
      // Beneath the horizon, light picks up the matte ground colour. A smooth
      // extinction band replaces the straight clip as the disk becomes a patch.
      if(spread>0) {
        const tint=s.createLinearGradient(0,hy-h*.04*spread,0,hy+h*.12*spread);
        const groundLight=blend(tones[3],sunlight,.25);
        tint.addColorStop(0,color(groundLight,0));
        tint.addColorStop(1,color(groundLight,.75*spread));
        s.globalCompositeOperation='source-atop'; s.fillStyle=tint; s.fillRect(0,0,w,h);
      }
      const mask=s.createLinearGradient(0,hy-h*.065*spread,0,hy+Math.max(.5,h*.105*spread));
      for(let i=0;i<=8;i++) mask.addColorStop(i/8,color([0,0,0],1-smooth(0,1,i/8)));
      s.globalCompositeOperation='destination-in'; s.fillStyle=mask; s.fillRect(0,0,w,h);
      s.globalCompositeOperation='source-over';
      c.save();
      // Diffuse light lingers in the haze after the disk has set.
      c.globalAlpha=mix(1,smooth(-8,1,sun.apparent),spread);
      c.drawImage(this.sunLayer,0,0,w,h); c.restore();
    }
    // Choose ink by the luminance behind the clock. Interpolating black into
    // white would make the digits disappear halfway through the auto transition.
    const backdrop=blend(tones[0],tones[1],.31/.36);
    const linear=backdrop.map(v=>v/255<=.04045?v/255/12.92:((v/255+.055)/1.055)**2.4);
    const luminance=linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
    const uiDark=luminance<.22?1:0;
    const fg=uiDark?rgb('edf0f3'):rgb('273341');
    this.tab.style.setProperty('--fg',color(fg));
    this.tab.style.setProperty('--sub',color(uiDark?rgb('cbd4df'):rgb('475563')));
    this.tab.style.setProperty('--field',color(uiDark?[19,28,41]:[255,255,255],.58));
    this.tab.style.setProperty('--edge',color(fg,.11));
    this.tab.style.setProperty('--tile',color(fg,.055));
    // Text follows the same continuous state as the atmosphere, including scrubbing.
    this.clock.style.textShadow=e< -6?`0 0 .38em ${color(rgb('b8d4ff'),dark*.18)}`:`${(w*.5-sx)/w*.035}em ${(h*.31-sy)/h*.035}em .1em ${color(rgb('342b2a'),.12*daylight)}`;
    this.clock.textContent=clock(state.hour);
    this.phase.textContent=phase(e);
    this.date.textContent=dateLabel();
  }
  drawStars(e,dark,t) {
    if(e>=-3) return;
    const c=this.ctx,w=this.w,h=this.h,hy=h*HORIZON;
    const phi=places[state.place][1]*RAD,spin=state.hour/24*TAU;
    const ca=Math.cos(spin),sa=Math.sin(spin),cp=Math.cos(phi),sp=Math.sin(phi);
    for(const s of stars) {
      // Rotate in equatorial coordinates, then tilt the sphere to the latitude.
      const u=s.x*ca-s.y*sa,v=s.x*sa+s.y*ca;
      const up=v*cp+s.z*sp,front=s.z*cp-v*sp;
      if(up<=0 || front<0) continue;
      const x=w*(.5+u*.63),y=hy-up*h*.68;
      if(x<0 || x>w || y<0) continue;
      const visibility=1-smooth(mix(-17,-8,s.magnitude),mix(-10,-3,s.magnitude),e);
      const haze=smooth(0,.16,up);
      const twinkle=s.magnitude>.5 ? .93+.07*Math.sin(t*.7+s.phase) : 1;
      const alpha=visibility*haze*(.28+s.magnitude*.65)*mix(.72,1,dark)*twinkle;
      if(alpha<.015) continue;
      const size=(1.5+s.magnitude*2.7)*Math.max(.8,w/850);
      c.globalAlpha=alpha; c.drawImage(stamps[+s.warm],x-size/2,y-size/2,size,size);
    }
    c.globalAlpha=1;
  }
}

function phase(e) {
  const morning=wrapHour(state.hour)<schedule.noon;
  if(schedule.polar==='day') return 'Полярный день';
  if(e< -18) return 'Глубокая ночь';
  if(e< -12) return 'Звёздное небо';
  if(e< -6) return 'Синий час';
  if(e< -.833) return morning?'Рассвет':'Сумерки';
  if(e< 6) return morning?'Восход':'Закат';
  if(Math.abs(wrapHour(state.hour)-schedule.noon)<.55) return 'Солнечный полдень';
  return morning?'Утренний свет':'Дневной свет';
}
let cachedDateKey='',cachedDateLabel='';
function dateLabel() {
  const key=state.date+Math.floor(state.hour/24);
  if(key===cachedDateKey) return cachedDateLabel;
  const d=new Date(`${state.date}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+Math.floor(state.hour/24));
  const week=new Date(d); week.setUTCDate(week.getUTCDate()+4-(week.getUTCDay()||7));
  const weekNo=Math.ceil((((week-Date.UTC(week.getUTCFullYear(),0,1))/86400000)+1)/7);
  cachedDateKey=key;
  cachedDateLabel=new Intl.DateTimeFormat('ru',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}).format(d)+` · Неделя ${weekNo}`;
  return cachedDateLabel;
}
const scenes=[
  new Scene('light',0,'Светлая','Воздух и бумага'),
  new Scene('dark',1,'Тёмная','Глубина и мягкий свет'),
  new Scene('auto',2,'Авто','Тема следует за солнцем'),
];

const moments=[['Ночь',()=>2],['Рассвет',s=>s.sr-.5],['Восход',s=>s.sr+.12],['Утро',s=>s.sr+1.6],['Полдень',s=>s.noon],['День',s=>s.ss-2],['Закат',s=>s.ss-.12],['Сумерки',s=>s.ss+.5],['Полночь',()=>24],['Рассвет +1',s=>s.sr+23.5]];
for(const [name,at] of moments) {
  const button=document.createElement('button'); button.textContent=name;
  button.addEventListener('click',()=>{state.hour=clamp(at(schedule),0,36);invalidate();});
  $('#moments').append(button);
}
places.forEach(([name,lat],i)=>{
  const button=document.createElement('button'); button.textContent=name; button.title=`${Math.abs(lat)}° ${lat<0?'ю. ш.':'с. ш.'}`;
  button.setAttribute('aria-pressed',String(i===state.place));
  button.addEventListener('click',()=>{state.place=i;mark($('#places'),button);updateSchedule();});
  $('#places').append(button);
});
function mark(group,button) { group.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button))); }
$('#page-theme').addEventListener('click',event=>{
  const button=event.target.closest('button'); if(!button) return;
  document.documentElement.dataset.theme=button.dataset.theme; mark($('#page-theme'),button);
});
$('#schedule').addEventListener('click',event=>{
  const button=event.target.closest('button'); if(!button) return;
  state.source=button.dataset.source; mark($('#schedule'),button); updateSchedule();
});
$('#date').addEventListener('change',()=>{
  if(!$('#date').value || !$('#date').validity.valid) return;
  state.date=$('#date').value; updateSchedule();
});
$('#duration').addEventListener('change',()=>{state.duration=+$('#duration').value;});
$('#time').addEventListener('input',()=>{state.hour=+$('#time').value;invalidate();});
$('#sun-sharpness').addEventListener('input',()=>{
  skySettings.sunSharpness=clamp(Number($('#sun-sharpness').value)/100);
  $('#sun-sharpness-value').value=`${Math.round(skySettings.sunSharpness*100)}%`;
  invalidate();
});
$('#play').addEventListener('click',()=>{
  state.playing=!state.playing; $('#play').textContent=state.playing?'Ⅱ Пауза':'▶ Запустить';
  $('#play').setAttribute('aria-pressed',String(state.playing)); last=performance.now(); invalidate();
});
function updateSchedule() {
  schedule=solarSchedule();
  $('#sun-info').textContent=schedule.polar ? (schedule.polar==='day'?'Солнце не заходит':'Солнце не восходит')
    : `↑ ${clock(schedule.sr)}   ↓ ${clock(schedule.ss)} · ${state.source==='fixed'?'условный день':'местное время, расчёт'} · ${Math.round((schedule.ss-schedule.sr)*60)} мин света`;
  $('#moments').querySelectorAll('button').forEach((b,i)=>{b.disabled=!!schedule.polar && ![0,4,8].includes(i);});
  invalidate();
}

// One scheduler for all three canvases. Pause means no redraws; hidden tabs stop
// completely, and only the visible scene is painted in enlarged mode.
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let pending=0,last=performance.now(),previousPaint=0,dirty=true,elapsed=0;
function invalidate() { dirty=true; if(!pending && !document.hidden) pending=requestAnimationFrame(frame); }
function frame(now) {
  pending=0;
  const dt=Math.min(.1,Math.max(0,(now-last)/1000)); last=now;
  if(state.playing) { state.hour=(state.hour+dt*36/state.duration)%36; elapsed+=dt; }
  if(dirty || state.playing && now-previousPaint>=1000/(reduced.matches?12:30)) {
    const start=performance.now(),sun=sunPosition(wrapHour(state.hour));
    for(const scene of scenes) scene.draw(sun,reduced.matches?0:elapsed,skySettings);
    $('#time').value=state.hour;
    $('#readout').textContent=clock(state.hour)+(state.hour>=24?' +1':'');
    $('#phase').textContent=`${phase(sun.altitude)} · ${Math.round(sun.altitude)}°`;
    $('#render-info').textContent=`${(performance.now()-start).toFixed(1)} мс / кадр · ${state.playing?(reduced.matches?'12':'30')+' кадров/с':'пауза, без перерисовки'}`;
    dirty=false; previousPaint=now;
  }
  if(state.playing && !document.hidden) pending=requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden) { cancelAnimationFrame(pending); pending=0; }
  else {last=performance.now();invalidate();}
});
updateSchedule();
