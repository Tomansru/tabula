// Weather owns optical properties, clouds and precipitation. Solar time remains
// owned by the sky. Both renderers consume the same prepared lighting frame.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const blend=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
const rgba=(c,a=1)=>`rgba(${c.map(Math.round)},${clamp(a)})`;
const fract=x=>x-Math.floor(x);

export const CONDITIONS={
  clear:{title:'Ясно',note:'Прямой свет и тёплая кромка цифр. Смена времени — спокойное растворение.',cover:0,rain:0,snow:0,fog:0,wind:.10,storm:0},
  scattered:{title:'Переменная',note:'Небольшие облака перехватывают свет; его блик на часах гаснет и возвращается.',cover:.32,rain:0,snow:0,fog:0,wind:.23,storm:0},
  overcast:{title:'Пасмурно',note:'Свет становится рассеянным. Сдержанные облака наверху, свободный горизонт и матовые цифры.',cover:1,rain:0,snow:0,fog:.10,wind:.18,storm:0},
  drizzle:{title:'Морось',note:'Редкие тонкие капли, влажный блеск цифр и мягкое стекание при смене минуты.',cover:.65,rain:.24,snow:0,fog:.18,wind:.16,storm:0},
  rain:{title:'Дождь',note:'Капли ловят цвет неба. На цифрах — мокрый блик; меняющиеся знаки стекают вниз.',cover:.80,rain:.72,snow:0,fog:.12,wind:.43,storm:0},
  storm:{title:'Гроза',note:'Низкий свет, косой ливень. Редкое зарево в облаке отражается на часах.',cover:1,rain:1,snow:0,fog:.16,wind:.82,storm:1},
  snow:{title:'Снег',note:'Свет рассеивается в холодном воздухе; на цифрах появляется иней, новые знаки мягко оседают.',cover:.68,rain:0,snow:1,fog:.20,wind:.18,storm:0},
  fog:{title:'Туман',note:'Солнце и горизонт растворяются в воздухе. Цифры сменяются сквозь лёгкую дымку.',cover:.12,rain:0,snow:0,fog:1,wind:.05,storm:0},
};
const CHANNELS=['cover','rain','snow','fog','wind','storm'];
export function interpolateWeather(a,b,t){return Object.fromEntries(CHANNELS.map(k=>[k,mix(a[k],b[k],smooth(0,1,t))]));}

function hash(x,y,seed){
  let n=Math.imul(x+seed,374761393)^Math.imul(y-seed,668265263);
  n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;
}
function noise(x,y,seed){
  const ix=Math.floor(x),iy=Math.floor(y),u=smooth(0,1,x-ix),v=smooth(0,1,y-iy);
  return mix(mix(hash(ix,iy,seed),hash(ix+1,iy,seed),u),mix(hash(ix,iy+1,seed),hash(ix+1,iy+1,seed),u),v);
}

// Different arrangements of ellipsoidal volumes, not a repeated row of puffs.
// Each tuple is x, y, horizontal radius, vertical radius and depth.
const CLOUD_SHAPES=[
  [[.26,.59,.17,.18,.30],[.43,.40,.20,.29,.48],[.64,.49,.21,.24,.40],[.77,.62,.12,.13,.20],[.49,.65,.28,.13,.26]],
  [[.22,.62,.14,.13,.22],[.39,.55,.19,.21,.35],[.63,.35,.18,.28,.49],[.73,.58,.19,.20,.34],[.51,.69,.28,.10,.23]],
  [[.20,.57,.13,.12,.17],[.38,.45,.22,.19,.32],[.65,.55,.22,.17,.29],[.82,.66,.12,.09,.14]],
  [[.31,.58,.21,.25,.41],[.49,.32,.16,.23,.43],[.63,.49,.18,.25,.45],[.76,.67,.14,.13,.22]],
  [[.23,.60,.15,.18,.24],[.41,.43,.17,.28,.40],[.60,.55,.22,.24,.41],[.79,.59,.12,.12,.19]],
  [[.23,.47,.15,.22,.29],[.43,.59,.23,.19,.32],[.65,.42,.21,.25,.38],[.81,.61,.12,.13,.18]],
];
function cloudMap(seed,shape){
  const w=288,h=192,density=new Float32Array(w*h),surface=new Float32Array(w*h);
  const lobes=CLOUD_SHAPES[shape];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=x/(w-1),v=y/(h-1),coarse=noise(u*8,v*7,seed);
    // A small domain warp gives different rounded shoulders and torn wisps.
    const du=u+(noise(u*5,v*4,seed+3)-.5)*.035;
    const dv=v+(noise(u*5,v*4,seed+7)-.5)*.045;
    let mass=0;
    for(const [cx,cy,rx,ry,depth] of lobes){
      const q=1-((du-cx)/rx)**2-((dv-cy)/ry)**2;
      if(q>0)mass+=(depth*Math.sqrt(q)*smooth(0,.16,q))**4;
    }
    const thickness=mass**.25;
    const edge=smooth(.02,.09,u)*(1-smooth(.91,.98,u))*smooth(.02,.09,v)*(1-smooth(.91,.98,v));
    const detail=.65*coarse+.35*noise(u*27,v*23,seed);
    const i=y*w+x;
    surface[i]=thickness*(.96+.07*coarse);
    density[i]=(1-Math.exp(-thickness*5.2))*smooth(.005,.065,thickness)*edge*(.86+.14*detail);
  }
  // Bake the surface normals into light masks once. Runtime lighting is a few
  // composited images, never a per-pixel raymarch or a large blur filter.
  const names=['body','front','top','bottom','left','right'];
  const entries=names.map(name=>{
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d');return{name,canvas,ctx,image:ctx.createImageData(w,h)};
  });
  const values=new Float32Array(6);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x;
    let nx=-(surface[y*w+Math.min(w-1,x+1)]-surface[y*w+Math.max(0,x-1)])*w*.38;
    let ny=-(surface[Math.min(h-1,y+1)*w+x]-surface[Math.max(0,y-1)*w+x])*h*.38;
    const length=Math.hypot(nx,ny,1);nx/=length;ny/=length;
    values[0]=1;values[1]=1/length;values[2]=Math.max(0,-ny);
    values[3]=Math.max(0,ny);values[4]=Math.max(0,-nx);values[5]=Math.max(0,nx);
    for(let j=0;j<entries.length;j++){
      const data=entries[j].image.data;
      data[i*4]=data[i*4+1]=data[i*4+2]=255;
      data[i*4+3]=Math.round(density[i]*values[j]*255);
    }
  }
  const masks={};
  for(const {name,canvas,ctx,image} of entries){ctx.putImageData(image,0,0);masks[name]=canvas;}
  return{canvas:masks.body,masks,density,w,h};
}
const CLOUD_MAPS=CLOUD_SHAPES.map((_,i)=>cloudMap(17+i*46,i));
const CLOUD_LAYOUT=[
  {x:.12,y:.14,w:.31,h:.26,seed:0,threshold:0,speed:1.05},
  {x:.72,y:.10,w:.25,h:.23,seed:1,threshold:.03,speed:.82},
  {x:.43,y:.065,w:.32,h:.15,seed:2,threshold:.38,speed:.48},
  {x:1.10,y:.17,w:.29,h:.25,seed:3,threshold:.62,speed:1.25},
  {x:-.21,y:.095,w:.22,h:.20,seed:4,threshold:.73,speed:.72},
  {x:.94,y:.035,w:.35,h:.19,seed:5,threshold:.84,speed:.55},
];
function sampleCloud(layer,x,y){
  const map=CLOUD_MAPS[layer.seed],u=(x-layer.x)/layer.w+.5,v=(y-layer.y)/layer.h+.5;
  if(u<=0||u>=1||v<=0||v>=1)return 0;
  const px=u*(map.w-1),py=v*(map.h-1),ix=Math.floor(px),iy=Math.floor(py);
  const at=(dx,dy)=>map.density[(iy+dy)*map.w+ix+dx];
  return mix(mix(at(0,0),at(1,0),px-ix),mix(at(0,1),at(1,1),px-ix),py-iy)*layer.alpha;
}

export function prepareWeather(sun,t,weather,travel=t*.012){
  const layers=CLOUD_LAYOUT.map((cloud,i)=>({...cloud,
    // Wrap only while the entire cloud is offscreen. Distant strata move slower.
    x:fract((cloud.x+cloud.w*.6+.06+travel*cloud.speed)/(1+cloud.w*1.2+.12))*(1+cloud.w*1.2+.12)-cloud.w*.6-.06,
    y:cloud.y+Math.sin(t*.08+i*2)*.006,
    w:cloud.w*(1+Math.sin(t*.12+i)*.025),
    h:cloud.h*(1+Math.sin(t*.10+i*1.7)*.045),
    alpha:smooth(cloud.threshold,cloud.threshold+.27,weather.cover)*mix(.76,.95,weather.cover),
  }));
  let transmission=1;
  for(const layer of layers)transmission*=1-sampleCloud(layer,sun.x,sun.y)*.9;
  const directLight=transmission*(1-weather.cover*.78)*(1-weather.fog*.84);
  const diffuseLight=1-weather.cover*.40-weather.fog*.30;
  const day=smooth(-14,12,sun.altitude);
  const dusk=smooth(-10,0,sun.altitude)*(1-smooth(3,22,sun.altitude));
  const stormPhase=t%23;
  const flash=stormPhase>15&&stormPhase<16.5?Math.sin((stormPhase-15)/1.5*Math.PI)**2*weather.storm:0;
  return{...weather,layers,directLight,diffuseLight,day,dusk,flash,time:t,starVisibility:(1-weather.cover*.96)*(1-weather.fog*.92)};
}

// Adjust the sky itself, preserving solar tint and horizon. No opaque grey sheet
// separates weather from the underlying day/night scene.
export function weatherSky(tones,frame,dark){
  const moisture=clamp(frame.cover*.52+frame.fog*.45);
  return tones.map((tone,i)=>{
    const neutral=tone[0]*.24+tone[1]*.48+tone[2]*.28;
    const cool=[neutral*.93,neutral*.99,Math.min(255,neutral*1.05)];
    let result=blend(tone,cool,moisture*(1-frame.dusk*.45));
    const shade=1-frame.cover*(i<2?.11:.035)-frame.storm*(i<2?.12:.03);
    result=result.map(v=>v*shade);
    const mist=blend([216,223,222],[44,56,71],dark);
    return blend(result,mist,frame.fog*(i===2?.32:.12));
  });
}

const particles=Array.from({length:150},(_,i)=>({x:hash(i,2,42),y:hash(i,3,42),depth:.25+hash(i,4,42)*.75,phase:hash(i,5,42)*Math.PI*2}));
export class WeatherLayer{
  constructor(parent){
    this.canvas=document.createElement('canvas');this.canvas.className='weather-layer';
    this.canvas.setAttribute('aria-hidden','true');parent.append(this.canvas);this.ctx=this.canvas.getContext('2d');this.cloudCache=new Map();
  }
  resize(w,h,pw,ph){this.w=w;this.h=h;this.canvas.width=pw;this.canvas.height=ph;this.ctx.setTransform(pw/w,0,0,ph/h,0,0);}
  cloudTexture(layer,shadow,light,sun){
    const index=layer.seed;
    const quantize=c=>c.map(v=>Math.round(v/5)*5);
    shadow=quantize(shadow);light=quantize(light);
    const dx=(sun.x-layer.x)*1.6,dy=sun.y-layer.y,length=Math.hypot(dx,dy,.35);
    const lx=Math.round(dx/length*12)/12,ly=Math.round(dy/length*12)/12,lz=Math.round(.35/length*12)/12;
    const key=`${shadow}/${light}/${lx}/${ly}/${lz}`;
    let cached=this.cloudCache.get(index);
    if(cached?.key===key)return cached.canvas;
    const map=CLOUD_MAPS[index],canvas=cached?.canvas||document.createElement('canvas'),lit=cached?.lit||document.createElement('canvas');
    if(!cached){canvas.width=lit.width=map.w;canvas.height=lit.height=map.h;}
    const l=lit.getContext('2d');l.clearRect(0,0,map.w,map.h);
    const weights={front:.35+.5*lz,top:.20+Math.max(0,-ly)*.78,bottom:Math.max(0,ly)*.70,left:Math.max(0,-lx)*.98,right:Math.max(0,lx)*.98};
    for(const [name,weight] of Object.entries(weights)){
      if(weight<=0)continue;
      l.globalAlpha=weight;l.drawImage(map.masks[name],0,0);
    }
    l.globalAlpha=1;l.globalCompositeOperation='source-in';l.fillStyle=rgba(light);l.fillRect(0,0,map.w,map.h);l.globalCompositeOperation='source-over';
    const c=canvas.getContext('2d');c.clearRect(0,0,map.w,map.h);c.drawImage(map.canvas,0,0);
    c.globalCompositeOperation='source-in';c.fillStyle=rgba(shadow);c.fillRect(0,0,map.w,map.h);
    c.globalCompositeOperation='source-atop';c.drawImage(lit,0,0);c.globalCompositeOperation='source-over';
    this.cloudCache.set(index,{key,canvas,lit});return canvas;
  }
  puff(x,y,rx,ry,tint,alpha){
    if(alpha<.001)return;
    const c=this.ctx;c.save();c.translate(x,y);c.scale(rx,ry);
    const g=c.createRadialGradient(0,0,0,0,0,1);
    g.addColorStop(0,rgba(tint,alpha));g.addColorStop(.38,rgba(tint,alpha*.5));g.addColorStop(1,rgba(tint,0));
    c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
  }
  draw(sun,dark,tones,frame){
    if(!this.w)return;
    const c=this.ctx,w=this.w,h=this.h;c.clearRect(0,0,w,h);
    const night=blend([122,139,161],[27,40,61],dark),daytime=blend([174,188,198],[63,84,105],dark);
    const shadow=blend(night,daytime,frame.day).map(v=>v*(1-frame.storm*.20));
    const coolLight=blend([255,253,246],[155,176,196],dark);
    let light=blend(shadow,coolLight,.25+frame.day*.67);
    light=blend(light,blend([249,196,153],[209,154,119],dark),frame.dusk*.72);
    light=blend(light,[202,220,249],frame.flash*.28);
    for(const layer of frame.layers){
      if(layer.alpha<.002)continue;
      c.globalAlpha=layer.alpha;
      c.drawImage(this.cloudTexture(layer,shadow,light,sun),(layer.x-layer.w/2)*w,(layer.y-layer.h/2)*h,layer.w*w,layer.h*h);
    }
    c.globalAlpha=1;
    const haze=blend(tones[2],light,.18);
    for(let i=0;i<3;i++){
      const x=w*(.22+i*.29+Math.sin(frame.time*.025+i*2)*.06);
      this.puff(x,h*(.49+i*.04),w*.43,h*(.075+i*.012),haze,frame.fog*.22);
    }
    if(frame.flash>0)this.puff(w*.76,h*.08,w*.22,h*.13,[196,220,247],frame.flash*.11);
    this.precipitation(sun,dark,light,frame);
  }
  precipitation(sun,dark,light,frame){
    const c=this.ctx,w=this.w,h=this.h,t=frame.time;
    const base=blend([87,112,131],[159,184,208],dark),tint=blend(base,light,frame.dusk*.50+frame.flash*.20);
    const nightFactor=mix(.52,1,frame.day);c.lineCap='round';
    for(let i=0;i<particles.length;i++){
      const p=particles[i],z=p.depth,rainAmount=clamp(frame.rain*particles.length-i);
      if(rainAmount>0){
        const speed=mix(.35,.82,z),y=fract(p.y+t*speed)*1.08-.04,x=fract(p.x+t*frame.wind*.13*speed);
        const fade=smooth(.18,.30,y)*(1-smooth(.76,.96,y));
        const quiet=.20+.8*smooth(.2,1,((x-.5)/.22)**2+((y-.32)/.13)**2);
        const alpha=rainAmount*frame.rain*mix(.12,.38,z)*fade*quiet*nightFactor;
        const length=h*mix(.012,.035,z)*mix(.55,1,frame.rain);
        c.lineWidth=Math.max(.5,w/1500)*mix(.6,1.05,z);c.strokeStyle=rgba(tint,alpha);
        c.beginPath();c.moveTo(x*w,y*h);c.lineTo(x*w-length*frame.wind*.65,y*h-length);c.stroke();
      }
      if(i<72&&frame.snow>0){
        const y=fract(p.y+t*mix(.025,.075,z)),x=fract(p.x+t*frame.wind*.018+Math.sin(t*.5+p.phase)*.015*z);
        const fade=smooth(.1,.22,y)*(1-smooth(.82,1,y));
        const quiet=.32+.68*smooth(.15,1,((x-.5)/.21)**2+((y-.32)/.12)**2);
        c.fillStyle=rgba(blend(tint,[243,245,239],dark*.6+frame.day*.18),frame.snow*mix(.22,.65,z)*fade*quiet*nightFactor);
        const r=Math.max(.65,w/1000)*mix(.7,1.8,z);
        c.beginPath();c.ellipse(x*w,y*h,r,r*.85,0,0,Math.PI*2);c.fill();
      }
    }
    if(frame.rain>.15)for(let i=0;i<9;i++){
      const p=particles[i],age=fract(t*.9+p.phase),fade=Math.sin(age*Math.PI)*(1-age);
      c.strokeStyle=rgba(tint,fade*frame.rain*.16);c.lineWidth=.6;
      c.beginPath();c.ellipse(p.x*w,h*(.79+p.y*.16),w*(.001+age*.004),h*.0014,0,0,Math.PI*2);c.stroke();
    }
  }
}
