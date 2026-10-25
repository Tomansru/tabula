import { clamp, mix, smooth } from './astronomy.js';
import { WeatherEffects } from './effects.js?v=2';

// Independent of the clock, location and UI. All amounts are 0..1; wind is -1..1.
export const PRESETS = {
  clear: { name: 'Ясно', note: 'Чистый воздух. Исходное небо и солнце без погодной завесы.', cover: 0, mass: 0, fog: 0, rain: 0, snow: 0, wind: .15 },
  clouds: { name: 'Облака и просветы', note: 'Объёмные массы медленно проходят перед светом. В просветах остаётся исходное небо.', cover: .52, mass: .48, fog: .025, rain: 0, snow: 0, wind: .24 },
  overcast: { name: 'Низкая облачность', note: 'Нависающий потолок, тёмные основания и рассеянный свет вместо солнечного диска.', cover: .98, mass: .84, fog: .14, rain: 0, snow: 0, wind: .18 },
  fog: { name: 'Густой туман', note: 'Воздух становится видимым: горизонт и звёзды исчезают в глубине, солнце превращается в широкое светлое пятно.', cover: .14, mass: .18, fog: .9, rain: 0, snow: 0, wind: .09 },
  drizzle: { name: 'Морось', note: 'Влажная дымка, приглушённые цвета и очень редкие близкие штрихи дождя.', cover: .87, mass: .66, fog: .3, rain: .19, snow: 0, wind: .15 },
  rain: { name: 'Дождь', note: 'Тяжёлое небо и дождевые завесы в глубине. Близкие капли лишь дополняют общую атмосферу.', cover: 1, mass: .88, fog: .22, rain: .72, snow: 0, wind: .42 },
  storm: { name: 'Гроза', note: 'Тёмные массы, косой дождь и редкие молнии, освещающие облака.', cover: 1, mass: 1, fog: .18, rain: 1, snow: 0, wind: .8, thunder: 1 },
  snow: { name: 'Снегопад', note: 'Молочный рассеянный свет и потеря глубины. Несколько мягких снежинок показывают движение воздуха.', cover: .94, mass: .55, fog: .38, rain: 0, snow: .72, wind: -.22 },
};
export const WEATHER_KEYS = ['cover', 'mass', 'fog', 'rain', 'snow', 'wind', 'thunder'];
export function normalizeWeather(input = {}) {
  return Object.fromEntries(WEATHER_KEYS.map(k => [k, clamp(Number.isFinite(input[k]) ? input[k] : 0, k === 'wind' ? -1 : 0, 1)]));
}

// Accept the extension's cached weather OR Open-Meteo's current object.
// Humidity alone is deliberately not interpreted as fog; visibility is in metres.
export function weatherFromObservation(observation = {}) {
  const code = observation.code ?? observation.weather_code ?? 0;
  const id = code >= 95 ? 'storm' : [71,73,75,77,85,86].includes(code) ? 'snow'
    : [61,63,65,66,67,80,81,82].includes(code) ? 'rain'
    : [51,53,55,56,57].includes(code) ? 'drizzle' : [45,48].includes(code) ? 'fog'
    : code === 3 ? 'overcast' : code === 1 || code === 2 ? 'clouds' : 'clear';
  const result = normalizeWeather(PRESETS[id]);
  const cloud = observation.cloud ?? observation.cloud_cover;
  if (Number.isFinite(cloud)) result.cover = clamp(cloud / 100);
  const wind = observation.wind ?? observation.wind_speed_10m;
  if (Number.isFinite(wind)) result.wind = clamp(wind / 18); // input must be m/s
  if (Number.isFinite(observation.visibility)) result.fog = Math.max(result.fog, 1 - smooth(150, 5000, observation.visibility));
  if ([61,80,71,85].includes(code)) { result.rain *= .45; result.snow *= .55; }
  if ([65,67,82,75,86].includes(code)) { result.rain = id === 'rain' ? 1 : result.rain; result.snow = id === 'snow' ? 1 : result.snow; }
  return result;
}

function rng(seed) { return () => { seed = Math.imul(seed,1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; }; }
const fract = v => v - Math.floor(v);
const fade = v => v * v * (3 - 2 * v);
// A periodic multi-scale density volume collapsed into a 2D atlas, built only once.
// The screen samples it continuously; there are no cloud images or moving cloud sprites.
function makeAtlas(seed) {
  const rand = rng(seed), size = 256, atlas = new Float32Array(size * size);
  for (const [frequency, amplitude] of [[4,.56],[8,.27],[16,.12],[32,.05]]) {
    const grid = Float32Array.from({ length: frequency * frequency }, rand);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size * frequency, v = y / size * frequency;
      const ix = Math.floor(u), iy = Math.floor(v), fx = fade(fract(u)), fy = fade(fract(v));
      const at = (a,b) => grid[(b % frequency) * frequency + a % frequency];
      atlas[y * size + x] += amplitude * mix(mix(at(ix,iy),at(ix+1,iy),fx),mix(at(ix,iy+1),at(ix+1,iy+1),fx),fy);
    }
  }
  return atlas;
}

export class AtmosphereField {
  constructor(seed = 2071) { this.noise = makeAtlas(seed); }
  sample(x, y) {
    const u = fract(x) * 256, v = fract(y) * 256, a = Math.floor(u), b = Math.floor(v), f = u-a, g = v-b, n = this.noise;
    return mix(mix(n[b*256+a],n[b*256+((a+1)&255)],f),mix(n[((b+1)&255)*256+a],n[((b+1)&255)*256+((a+1)&255)],f),g);
  }
  // Buffer is low resolution (<= 40k pixels), NOT viewport/retina resolution.
  render(bytes, width, height, sun, state, weather, seconds) {
    const {cover,mass,fog,rain,snow,wind} = weather;
    if (cover + fog + rain + snow < 1e-8) { bytes.fill(0); return; }
    const daylight = smooth(-12, 18, sun.altitude), direct = smooth(-7, 5, sun.altitude);
    const sunset = smooth(-8,0,sun.altitude) * (1-smooth(5,24,sun.altitude));
    const sx = .5 + (state.place.lat < 0 ? -1 : 1) * .38 * Math.sin(sun.hourAngle);
    const sy = state.horizon - sun.up / Math.max(.32,sun.maxUp) * (state.horizon-.11);
    const aspect = width / height, drift = seconds * wind * .0018;
    const cloudGate = smooth(0,.06,cover), threshold = mix(.83,.18,cover);
    const fogBase = fog * 3.8 + rain * .28 + snow * .48;
    const cloudR = mix(13,157,daylight), cloudG = mix(22,169,daylight), cloudB = mix(36,179,daylight);
    const mistR = mix(22,199,daylight), mistG = mix(32,207,daylight), mistB = mix(47,211,daylight);
    const lx = (sx-.5)*.06, ly = -.035;
    for (let j=0;j<height;j++) for (let i=0;i<width;i++) {
      const x=i/width, y=j/height, u=x*aspect*.28-drift, v=y*.46;
      const n=this.sample(u,v), far=this.sample(u*.67+.37+drift*.3,v*.8+.53);
      const ceiling=.53+mass*.17+(far-.5)*.22;
      const depth=smooth(threshold-.09,threshold+.12,n*.77+far*.23)*cloudGate*(1-smooth(ceiling-.14,ceiling+.25,y));
      const optical=depth*(.8+mass*6.8);
      const ca=1-Math.exp(-optical);
      // Finite-difference lighting exposes rounded edges; thick cores extinguish direct sun.
      const edge=clamp((n-this.sample(u+lx,v+ly))*5.5,-.3,.4);
      const distance=(x-sx)**2*aspect*aspect+(y-sy)**2;
      const glow=Math.exp(-distance*2.1)*direct;
      const shade=1-mass*.3-(1-y)*mass*.12 + edge*(.4+.4*daylight);
      const rim=glow*Math.exp(-optical*.65)*(24+sunset*36)*depth;
      const cr=cloudR*shade+rim+sunset*glow*16*(1-mass*.8);
      const cg=cloudG*shade+rim*.78;
      const cb=cloudB*shade+rim*.42;
      // Fog has depth everywhere, not just on a horizon strip. Two scales avoid a flat wash.
      const mist=this.sample(u*.44+1.73+drift*.4,y*.25+.81);
      const low=this.sample(u*.9-drift*.25,y*.39+2.38);
      const fogDepth=fogBase*(.48+.72*smooth(.08,.92,y)+mist*.35+low*.18);
      const fa=1-Math.exp(-fogDepth);
      const scattering=glow*(1-mass*cover*.65)*(7+sunset*19);
      const fr=mistR+scattering+sunset*10*glow, fg=mistG+scattering*.65, fb=mistB+scattering*.25;
      const alpha=fa+ca*(1-fa), k=(j*width+i)*4;
      // Unpremultiplied buffer for Canvas ImageData; no black fringe around transparent holes.
      bytes[k]=alpha ? (fr*fa+cr*ca*(1-fa))/alpha : 0;
      bytes[k+1]=alpha ? (fg*fa+cg*ca*(1-fa))/alpha : 0;
      bytes[k+2]=alpha ? (fb*fa+cb*ca*(1-fa))/alpha : 0;
      bytes[k+3]=alpha*255;
    }
  }
}

export class Weather {
  constructor(fieldCanvas, rainCanvas, initial = PRESETS.clouds) {
    this.canvas=fieldCanvas; this.ctx=fieldCanvas.getContext('2d');
    this.rainCanvas=rainCanvas; this.rainCtx=rainCanvas.getContext('2d');
    this.field=new AtmosphereField(); this.current=normalizeWeather(initial); this.target={...this.current};
    this.time=0; this.lastField=-Infinity; this.lastKey=''; this.transitioning=false;
    this.effects=new WeatherEffects(rainCanvas);
    this.resize();
  }
  set(input, immediate=false) {
    this.target=normalizeWeather(input);
    this.transitioning=true;
    if (immediate) { this.current={...this.target}; this.transitioning=false; }
    this.lastField=-Infinity;
  }
  resize() {
    const aspect=innerWidth/innerHeight;
    this.canvas.width=Math.max(1,Math.round(Math.min(300,Math.sqrt(40000*aspect))));
    this.canvas.height=Math.max(1,Math.round(this.canvas.width/aspect));
    const ratio=Math.min(1,1400/innerWidth);
    this.rainCanvas.width=Math.max(1,Math.round(innerWidth*ratio));
    this.rainCanvas.height=Math.max(1,Math.round(innerHeight*ratio));
    this.buffer=this.ctx.createImageData(this.canvas.width,this.canvas.height);
    this.lastField=-Infinity;
    this.effects.invalidate();
  }
  advance(dt, motion) {
    this.effects.motion=motion;
    if (!motion) {
      if (this.transitioning) { this.current={...this.target}; this.transitioning=false; this.lastField=-Infinity; }
      return;
    }
    this.time+=dt;
    if (this.transitioning) {
      let delta=0;
      for (const key of WEATHER_KEYS) { this.current[key]=mix(this.current[key],this.target[key],1-Math.exp(-dt*1.5)); delta=Math.max(delta,Math.abs(this.target[key]-this.current[key])); }
      if (delta<.001) { this.current={...this.target}; this.transitioning=false; this.lastField=-Infinity; }
    }
  }
  get active() { const w=this.current; return this.transitioning || w.rain+w.snow+w.thunder>.001 || (Math.abs(w.wind)>.001 && w.cover+w.fog>.001); }
  useDarkInk(altitude) {
    // Estimate contrast under the clock from the already-computed veil, without GPU readback.
    const w=this.canvas.width,h=this.canvas.height,b=this.buffer.data,base=mix(24,190,smooth(-7,-1,altitude));
    let light=0;
    for(const x of [.35,.5,.65]) {
      const k=(Math.floor(h*.34)*w+Math.floor(w*x))*4,a=b[k+3]/255;
      light+=(b[k]*.2126+b[k+1]*.7152+b[k+2]*.0722)*a+base*(1-a);
    }
    light/=3;
    if(this.darkInk===undefined) this.darkInk=light>132;
    else if(light>140) this.darkInk=true;
    else if(light<124) this.darkInk=false;
    return this.darkInk;
  }
  draw(sun, state) {
    const key=[Math.round(sun.altitude*100),Math.round(sun.hourAngle*1000),state.horizon,state.place.lat].join(':');
    // Moving masses: 10 fps at low resolution. Precipitation can be drawn at 24 fps.
    if (this.time-this.lastField>=.1 || key!==this.lastKey || this.lastField===-Infinity) {
      this.field.render(this.buffer.data,this.canvas.width,this.canvas.height,sun,state,this.current,this.time);
      this.ctx.putImageData(this.buffer,0,0); this.lastField=this.time; this.lastKey=key;
    }
    this.effects.draw(sun,this.current,this.time);
  }
}
