import test from 'node:test';
import assert from 'node:assert/strict';
import { firstContact, lightningEnvelope } from './effects.js';
import { PRESETS, normalizeWeather, weatherFromObservation } from './weather.js';
const mask={left:100,top:50,width:12,height:12,alpha:new Uint8ClampedArray(12*12*4)};
// Two narrow strokes with an open gap, standing in for actual glyph alpha.
for(let y=3;y<10;y++) for(const x of [2,9]) mask.alpha[(y*12+x)*4+3]=255;
test('fast drop catches a thin stroke without tunnelling',()=>{
 assert.deepEqual(firstContact(mask,102,0,102,200),{x:102,y:53});
});
test('gaps and outside the glyph remain permeable',()=>{
 assert.equal(firstContact(mask,106,0,106,200),null);
 assert.equal(firstContact(mask,99,0,99,200),null);
 assert.equal(firstContact(null,102,0,102,200),null);
});
test('wind-driven slanted trajectory collides with the actual stroke',()=>{
 assert.ok(firstContact(mask,98,50,110,62));
});
test('a stationary sample remains finite and checks its own pixel',()=>{
 assert.deepEqual(firstContact(mask,102,53,102,53),{x:102,y:53});
 assert.equal(firstContact(mask,105,53,105,53),null);
});
test('lightning is a single bounded pulse and ends completely',()=>{
 assert.equal(lightningEnvelope(-1),0);assert.equal(lightningEnvelope(2),0);
 let last=0;
 for(let t=0;t<=.55;t+=.01) {const n=lightningEnvelope(t);assert.ok(n>=last);assert.ok(n<=1);last=n;}
 last=lightningEnvelope(.55);
 for(let t=.56;t<1.1;t+=.01) {const n=lightningEnvelope(t);assert.ok(n<last);last=n;}
});
test('only a thunderstorm observation enables automatic lightning',()=>{
 assert.equal(weatherFromObservation({code:95}).thunder,1);
 assert.equal(weatherFromObservation({code:65}).thunder,0);
 assert.equal(normalizeWeather(PRESETS.snow).thunder,0);
 assert.equal(normalizeWeather({thunder:4}).thunder,1);
});
