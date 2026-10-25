import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { AtmosphereField, PRESETS, normalizeWeather, weatherFromObservation } from './weather.js';
const field = new AtmosphereField();
const state = { horizon: .68, place: { lat: 44.82 } };
const sun = { altitude: 40, up: .64, maxUp: .7, hourAngle: .2 };
function frame(weather, time=0, light=sun, w=160, h=90) {
 const bytes=new Uint8ClampedArray(w*h*4);
 field.render(bytes,w,h,light,state,normalizeWeather(weather),time);
 return bytes;
}
const alphaSum = bytes => { let sum=0; for(let i=3;i<bytes.length;i+=4) sum+=bytes[i]; return sum; };
test('clear is exactly transparent, including after previously rendering fog',()=>{
 frame(PRESETS.fog);
 const clear=frame(PRESETS.clear);
 assert.equal(alphaSum(clear),0);
});
test('thick overcast removes direct light throughout the upper sky',()=>{
 const a=frame(PRESETS.overcast);
 for(let y=0;y<25;y++) for(let x=0;x<160;x++) assert.ok(a[(y*160+x)*4+3]>235);
});
test('dense fog envelops the complete screen, including zenith and foreground',()=>{
 const a=frame({...PRESETS.clear,fog:1});
 let min=255;
 for(let i=3;i<a.length;i+=4) min=Math.min(min,a[i]);
 assert.ok(min>225, `minimum opacity ${min}`);
});
test('more coverage and more fog cannot reveal occluded stars',()=>{
 let previous=-1;
 for(const cover of [0,.2,.4,.6,.8,1]) {
  const sum=alphaSum(frame({...PRESETS.clear,cover,mass:.6}));
  assert.ok(sum>=previous); previous=sum;
 }
 previous=-1;
 for(const fog of [0,.2,.4,.6,.8,1]) {
  const sum=alphaSum(frame({...PRESETS.clouds,fog}));
  assert.ok(sum>=previous); previous=sum;
 }
});
test('noise is deterministic and continuous through negative/wrapped coordinates',()=>{
 const other=new AtmosphereField();
 for(const x of [-2,-1,-.001,0,.2,.999,1,2]) {
  assert.equal(field.sample(x,.38),other.sample(x,.38));
  assert.ok(Math.abs(field.sample(x-1e-6,.38)-field.sample(x+1e-6,.38))<.001);
 }
 assert.notDeepEqual(frame(PRESETS.clouds,0),frame(PRESETS.clouds,60));
});
test('fog does not turn a moonless night into daytime',()=>{
 const a=frame(PRESETS.fog,0,{altitude:-30,up:-.5,maxUp:.7,hourAngle:Math.PI});
 for(let i=0;i<a.length;i+=4) assert.ok(Math.max(a[i],a[i+1],a[i+2])<60);
});
test('observation adapter respects clear zero values and does not infer fog from humidity',()=>{
 assert.equal(weatherFromObservation({code:0,cloud:0,wind:0}).cover,0);
 assert.equal(weatherFromObservation({code:0,cloud:0,wind:0}).wind,0);
 assert.equal(weatherFromObservation({weather_code:0,relative_humidity_2m:100}).fog,0);
 assert.ok(weatherFromObservation({code:45}).fog>.8);
 assert.ok(weatherFromObservation({code:0,visibility:100}).fog>.9);
 assert.equal(weatherFromObservation({code:75}).snow,1);
 assert.equal(weatherFromObservation({code:65}).rain,1);
 assert.equal(normalizeWeather({wind:-5,rain:Infinity,fog:NaN,cover:2}).wind,-1);
 assert.equal(normalizeWeather({wind:-5,rain:Infinity,fog:NaN,cover:2}).rain,0);
});
test('bounded density buffer benchmark (CPU only, not a browser FPS claim)', t=>{
 const w=266,h=150,bytes=new Uint8ClampedArray(w*h*4),weather=normalizeWeather(PRESETS.rain);
 const start=performance.now();
 for(let i=0;i<20;i++) field.render(bytes,w,h,sun,state,weather,i/10);
 t.diagnostic(`39,900 pixels: ${((performance.now()-start)/20).toFixed(1)} ms per field on this runtime`);
});
