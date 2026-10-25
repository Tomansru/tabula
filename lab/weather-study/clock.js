// Weather treatment of the clock is independent of the simulation clock.
// It never delays or changes the actual displayed time.
const mix=(a,b,t)=>a+(b-a)*t;
const blend=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
const rgb=c=>`rgb(${c.map(Math.round)})`;

function motionFor(weather){
  if(weather.fog>.6)return{duration:520,enter:{opacity:.18,filter:'blur(.045em)'},exit:{opacity:0,filter:'blur(.05em)'}};
  if(weather.snow>.4)return{duration:440,enter:{opacity:0,transform:'translate(.025em,-.10em)'},exit:{opacity:0,transform:'translate(-.025em,.07em)'}};
  if(weather.rain>.15)return{duration:280,enter:{opacity:.15,transform:'translateY(-.16em) scaleY(1.05)'},exit:{opacity:0,transform:'translateY(.22em) scaleY(1.08)'}};
  return{duration:260,enter:{opacity:0},exit:{opacity:0}};
}

export class WeatherClock{
  constructor(el){
    this.el=el;this.value='';this.digits=[];
    el.setAttribute('role','img');
    el.replaceChildren(...Array.from({length:5},(_,i)=>{
      const box=document.createElement('span');box.className=i===2?'clock-colon':'clock-digit';box.setAttribute('aria-hidden','true');
      const glyph=document.createElement('span');glyph.className='glyph';glyph.textContent=i===2?':':'0';box.append(glyph);
      this.digits.push({box,glyph,until:0,animations:[],old:null});return box;
    }));
  }
  update(value,{weather,ink,sun,animate,enabled,now}){
    this.el.setAttribute('aria-label',value);
    const wet=enabled?weather.rain:0,frost=enabled?weather.snow:0;
    const warmth=enabled?weather.directLight*weather.day:0;
    const light=blend([184,214,241],[251,205,152],weather.dusk);
    const glint=blend(ink,light,Math.min(.57,wet*.36+frost*.12+warmth*.10+(enabled?weather.flash*.35:0)));
    const cap=blend(ink,[224,237,244],frost*.55);
    const pos=45+Math.sin(weather.time*.7)*16*wet;
    const fill=`linear-gradient(${174+(sun.x-.5)*32}deg,${rgb(cap)} 0%,${rgb(ink)} ${8+frost*8}%,${rgb(ink)} ${pos-6}%,${rgb(glint)} ${pos}%,${rgb(ink)} ${pos+8}%,${rgb(ink)} 100%)`;
    this.el.style.setProperty('--glyph-fill',fill);
    this.el.style.setProperty('--drop-color',rgb(glint));
    const spec=motionFor(weather);
    for(let i=0;i<this.digits.length;i++){
      const digit=this.digits[i];
      const phase=(weather.time*.24+i*.29)%1;
      digit.box.style.setProperty('--drop-alpha',String(Math.sin(phase*Math.PI)*wet*.42));
      digit.box.style.setProperty('--drop-y',`${phase*.12}em`);
      if(digit.glyph.textContent===value[i])continue;
      const previous=digit.glyph.textContent;digit.glyph.textContent=value[i];
      if(!animate||!enabled){
        digit.animations.forEach(a=>a.cancel());digit.old?.remove();digit.old=null;digit.until=0;
        continue;
      }
      // At accelerated speed many minutes pass within one transition. Keep the
      // live glyph correct, but do not restart an animation on every frame.
      if(now<digit.until)continue;
      digit.old?.remove();digit.animations.forEach(a=>a.cancel());
      const old=document.createElement('span');old.className='glyph outgoing';old.textContent=previous;
      digit.box.append(old);digit.old=old;digit.until=now+spec.duration;
      const options={duration:spec.duration,easing:'cubic-bezier(.2,.65,.3,1)'};
      const incoming=digit.glyph.animate([spec.enter,{opacity:1,transform:'none',filter:'blur(0)'}],options);
      const outgoing=old.animate([{opacity:1,transform:'none',filter:'blur(0)'},spec.exit],options);
      outgoing.onfinish=()=>{old.remove();if(digit.old===old)digit.old=null;};
      digit.animations=[incoming,outgoing];
    }
    this.value=value;
  }
}
