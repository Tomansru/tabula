import { clamp, mix, smooth } from './astronomy.js';

// Swept collision: fast rain must not tunnel through a thin digit between frames.
export function firstContact(mask, x0, y0, x1, y1) {
  if (!mask || Math.max(y0,y1)<mask.top || Math.min(y0,y1)>mask.top+mask.height || Math.max(x0,x1)<mask.left || Math.min(x0,x1)>mask.left+mask.width) return null;
  const steps=Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0)));
  for(let i=0;i<=steps;i++) {
    const f=steps ? i/steps : 0, x=x0+(x1-x0)*f,y=y0+(y1-y0)*f;
    const u=Math.floor(x-mask.left),v=Math.floor(y-mask.top);
    if(u>=0 && v>=0 && u<mask.width && v<mask.height && mask.alpha[(v*mask.width+u)*4+3]>90) return {x,y};
  }
  return null;
}
export function lightningEnvelope(age) {
  // One broad pulse, no strobe or repeated full-screen white frames.
  return age<0 || age>1.1 ? 0 : Math.sin(Math.PI*age/1.1)**2;
}

export class WeatherEffects {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.clock=null;
    this.maskCanvas=document.createElement('canvas');this.maskCtx=this.maskCanvas.getContext('2d',{willReadFrequently:true});
    this.mask=null;this.dirty=true;this.text='';this.lastTime=null;
    this.particles=[];this.splashes=[];this.deposits=[];this.streams=[];
    this.nextLightning=3;this.strike=null;this.enabled=true;this.motion=true;
    this.animations=[];this.lastDigitAnimation=-Infinity;
  }
  attachClock(clock) { this.clock=clock;this.dirty=true; }
  invalidate() { this.dirty=true;this.particles=[];this.splashes=[];this.deposits=[];this.streams=[]; }
  setClock(text, wind, animate, now) {
    if(text===this.text) return;
    const old=this.text;this.text=text;
    this.animations.forEach(a=>a.cancel());this.animations=[];
    this.clock.setAttribute('aria-label',text);
    const chars=[...text];
    // Animate only changed digits; colon and unchanged digits stay anchored.
    const doAnimate=animate && old.length===text.length && Math.abs(wind)>.05 && now-this.lastDigitAnimation>1.2;
    this.clock.replaceChildren(...chars.map((char,i)=>{
      const span=document.createElement('span');span.className='clock-digit';span.textContent=char;span.setAttribute('aria-hidden','true');
      if(doAnimate && old[i]!==char) {
        const ghost=document.createElement('span');ghost.className='digit-ghost';ghost.textContent=old[i];span.append(ghost);
        const dx=wind*(24+Math.abs(wind)*34);
        const out=ghost.animate([{opacity:.75,transform:'translate(0,0)'},{opacity:0,transform:`translate(${dx}px,-12px) rotate(${wind*8}deg)`}],{duration:650,easing:'ease-out'});
        const incoming=span.animate([{opacity:.25,transform:`translate(${-dx*.45}px,8px)`},{opacity:1,transform:'translate(0,0)'}],{duration:750,easing:'cubic-bezier(.2,.8,.2,1)'});
        this.animations.push(out,incoming);out.onfinish=()=>ghost.remove();
      }
      return span;
    }));
    if(doAnimate) this.lastDigitAnimation=now;
    if(doAnimate) {
      this.ignoreContactUntil=now+.75;
      for(const d of this.deposits) {
        if(this.particles.length>=400) break;
        const flake=this.spawn('snow',innerWidth,innerHeight);flake.x=d.x+wind*8;flake.y=d.y+8;this.particles.push(flake);
      }
    }
    this.deposits=[];this.streams=[];this.dirty=true;
  }
  stopAnimations() { this.animations.forEach(a=>a.cancel());this.animations=[];this.clock?.querySelectorAll('.digit-ghost').forEach(el=>el.remove()); }
  rebuildMask() {
    if(!this.clock || !this.dirty) return;
    // Only rebuilt when text/font/viewport changes, never one GPU readback per frame.
    const rect=this.clock.getBoundingClientRect(),style=getComputedStyle(this.clock);
    const left=Math.floor(rect.left)-4,top=Math.floor(rect.top)-6,width=Math.ceil(rect.width)+8,height=Math.ceil(rect.height)+12;
    this.maskCanvas.width=width;this.maskCanvas.height=height;
    const c=this.maskCtx;c.fillStyle='#fff';c.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;c.textBaseline='alphabetic';
    const spans=[...this.clock.querySelectorAll(':scope > .clock-digit')];
    const pl=parseFloat(style.paddingLeft)||0,pr=parseFloat(style.paddingRight)||0;
    let offset=4+pl+(rect.width-pl-pr-spans.reduce((sum,span)=>sum+span.offsetWidth,0))/2;
    // Measure resting glyph widths: live DOM rectangles may be temporarily wind-transformed.
    for(const span of spans) {
      const char=span.firstChild.textContent,metrics=c.measureText(char),advance=span.offsetWidth;
      const ascent=metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize)*.8;
      const descent=metrics.fontBoundingBoxDescent ?? parseFloat(style.fontSize)*.2;
      c.fillText(char,offset,6+(rect.height-ascent-descent)/2+ascent);
      offset+=advance;
    }
    this.mask={left,top,width,height,alpha:c.getImageData(0,0,width,height).data};
    this.dirty=false;
  }
  spawn(kind,w,h,spread=false) {
    const z=Math.random();
    return {kind,x:Math.random()*(w+120)-60,y:spread?Math.random()*h:-20,z,phase:Math.random()*6.28,
      speed:kind==='rain'?480+z*620:24+z*40,radius:kind==='rain'?.6+z*.65:1+z*2.1};
  }
  updateParticles(p,dt,w,h,time) {
    for(const kind of ['rain','snow']) {
      const target=Math.round((kind==='rain'?250:135)*p[kind]*Math.min(1.4,w*h/(1280*720)));
      const existing=this.particles.filter(d=>d.kind===kind);
      if(existing.length<target) for(let i=existing.length;i<target;i++) this.particles.push(this.spawn(kind,w,h,true));
      if(existing.length>target) { let remove=existing.length-target;this.particles=this.particles.filter(d=>d.kind!==kind || remove--<=0); }
    }
    for(const d of this.particles) {
      const ox=d.x,oy=d.y;
      d.x+=dt*(p.wind*(d.kind==='rain'?d.speed*.32:38)+ (d.kind==='snow'?Math.sin(time*.8+d.phase)*14:0));d.y+=dt*d.speed;
      const hit=this.enabled && time>=(this.ignoreContactUntil || 0) && firstContact(this.mask,ox,oy,d.x,d.y);
      if(hit) {
        if(d.kind==='snow' && this.deposits.length<110) this.deposits.push({...hit,size:1.5+d.z*2.2,life:5+Math.random()*8,max:13});
        if(d.kind==='rain') {
          if(this.splashes.length<80) for(const sign of [-1,1]) this.splashes.push({...hit,vx:sign*(18+Math.random()*26)+p.wind*20,vy:-25-Math.random()*28,life:.32});
          if(this.streams.length<22 && Math.random()<.3) this.streams.push({...hit,life:.65});
        }
        Object.assign(d,this.spawn(d.kind,w,h));
      }
      if(d.y>h+30 || d.x< -100 || d.x>w+100) Object.assign(d,this.spawn(d.kind,w,h));
    }
    for(const d of this.splashes) {d.life-=dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.vy+=160*dt;}
    this.splashes=this.splashes.filter(d=>d.life>0);
    for(const d of this.streams) {d.life-=dt;d.y+=dt*28;}
    this.streams=this.streams.filter(d=>d.life>0);
    for(const d of this.deposits) {
      d.life-=dt*(1+(1-p.snow)*2+Math.abs(p.wind));
      if(d.life<=0 && p.snow>.05 && this.particles.length<400) {
        const flake=this.spawn('snow',w,h);flake.x=d.x+p.wind*8;flake.y=d.y+8;this.particles.push(flake);
      }
    }
    this.deposits=this.deposits.filter(d=>d.life>0);
  }
  triggerLightning(time) {
    const x=(Math.random()<.5?.12:.76)+Math.random()*.1,points=[{x,y:0}];
    for(let i=1;i<=9;i++) points.push({x:x+(Math.random()-.5)*.07+i*.005,y:i*.045});
    this.strike={start:time,x,points};this.nextLightning=time+13+Math.random()*17;
  }
  paintLightning(c,w,h,time,amount) {
    if(!this.motion || amount<.05) {this.strike=null;return;}
    if(time>=this.nextLightning) this.triggerLightning(time);
    if(!this.strike) return;
    const power=lightningEnvelope(time-this.strike.start)*amount;
    if(power<=0) return;
    // Restricted to the sky, away from the clock; no global white flash over the page.
    const x=this.strike.x*w,gradient=c.createRadialGradient(x,h*.1,0,x,h*.1,w*.45);
    gradient.addColorStop(0,`rgba(196,212,244,${power*.24})`);gradient.addColorStop(1,'rgba(196,212,244,0)');
    c.fillStyle=gradient;c.fillRect(0,0,w,h*.58);
    const path=()=>{c.beginPath();this.strike.points.forEach((p,i)=>i?c.lineTo(p.x*w,p.y*h):c.moveTo(p.x*w,p.y*h));};
    c.strokeStyle=`rgba(160,183,234,${power*.3})`;c.lineWidth=7;path();c.stroke();
    c.strokeStyle=`rgba(225,233,251,${power*.8})`;c.lineWidth=1.1;path();c.stroke();
    const fork=this.strike.points[4],direction=this.strike.x<.5?-1:1;
    c.strokeStyle=`rgba(208,223,247,${power*.45})`;c.lineWidth=.7;c.beginPath();c.moveTo(fork.x*w,fork.y*h);
    c.lineTo((fork.x+direction*.035)*w,(fork.y+.035)*h);c.lineTo((fork.x+direction*.025)*w,(fork.y+.07)*h);c.lineTo((fork.x+direction*.07)*w,(fork.y+.11)*h);c.stroke();
  }
  draw(sun,p,time) {
    const c=this.ctx,ratio=this.canvas.width/innerWidth,w=innerWidth,h=innerHeight;
    const dt=this.motion && this.lastTime!==null?clamp(time-this.lastTime,0,.08):0;this.lastTime=time;
    if(!this.motion) {
      if(p.snow<.001) this.deposits=[];
      if(p.rain<.001) {this.streams=[];this.splashes=[];}
    }
    if(this.enabled) this.rebuildMask();
    if(dt>0 || !this.particles.length) this.updateParticles(p,dt,w,h,time);
    c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,w,h);
    this.paintLightning(c,w,h,time,p.thunder);
    const day=smooth(-10,15,sun.altitude);
    for(const d of this.particles) {
      if(p[d.kind]<.001) continue;
      if(d.kind==='rain') {
        const length=12+d.z*24;c.lineWidth=d.radius;c.strokeStyle=`rgba(200,220,235,${(.22+d.z*.3)*mix(.75,1,day)})`;
        c.beginPath();c.moveTo(d.x,d.y);c.lineTo(d.x-p.wind*length*.32,d.y-length);c.stroke();
      } else {
        // A muted blue rim makes white flakes legible against pale fog as well as at night.
        c.fillStyle=`rgba(246,249,250,${.45+d.z*.4})`;c.strokeStyle=`rgba(99,126,145,${.1+d.z*.15})`;c.lineWidth=.7;
        c.beginPath();c.ellipse(d.x,d.y,d.radius,d.radius*.8,d.phase,0,Math.PI*2);c.fill();c.stroke();
      }
    }
    if(this.enabled) {
      c.strokeStyle='rgba(217,237,249,.65)';c.lineWidth=.85;
      for(const d of this.splashes) {c.globalAlpha=d.life/.32;c.beginPath();c.moveTo(d.x,d.y);c.lineTo(d.x-d.vx*.025,d.y-d.vy*.025);c.stroke();}
      c.globalAlpha=1;
      for(const d of this.streams) {c.globalAlpha=d.life/.65;c.beginPath();c.moveTo(d.x,d.y);c.lineTo(d.x,d.y+8);c.stroke();}
      c.globalAlpha=1;c.fillStyle='rgba(244,249,252,.95)';c.strokeStyle='rgba(99,126,145,.28)';c.lineWidth=.7;
      for(const d of this.deposits) {c.globalAlpha=clamp(d.life/1.5);c.beginPath();c.ellipse(d.x,d.y-1,d.size*1.4,d.size*.6,0,Math.PI,Math.PI*2);c.fill();c.stroke();}
      c.globalAlpha=1;
    }
  }
}
