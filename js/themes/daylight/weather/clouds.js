// The weather's soft half: clouds, veil, fog and rain curtains, drawn by one shader over the theme's two canvases.
// The painted atmosphere comes in as a tiny texture, so every cloud borrows its colour from the sky around it
// and a sunset stays a sunset under any weather. The theme's Sky class is not touched.
import { NOISE_SIZE } from './noise.js';
import { NOISE } from './noise-data.js';

const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float(gl_VertexID == 1) * 4. - 1., float(gl_VertexID == 2) * 4. - 1.);
  vUv = vec2(p.x * .5 + .5, .5 - p.y * .5);
  gl_Position = vec4(p, 0., 1.);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uNoise, uSky;
uniform vec2 uSun, uDrift, uFlashAt;
uniform float uTime, uHorizon, uSunVis, uDay, uAspect, uOpaque;
uniform vec3 uLit, uShade, uGlow, uVeilCol;
uniform float uCover, uPuff, uCirrus, uVeil, uFog, uShafts, uRays, uBlow, uFlash, uWind;

const float PI = 3.14159265;

vec4 over(vec4 top, vec4 under) { return top + under * (1. - top.a); }

// The cloud deck is a plane overhead: it shrinks and flattens towards the horizon.
vec2 deck(vec2 uv, float bend) {
  float d = max(uHorizon - uv.y, 0.);
  float z = 1. / (d + bend);
  return vec2((uv.x - .5) * uAspect * z * .95, z * 1.28);
}

// Noise channels: r, g smooth fbm · b ridged · a heaps (inverted cells).
float field(vec2 p, float morph) {
  vec2 q = p + uDrift;
  vec4 a = texture(uNoise, q * .046);
  vec4 b = texture(uNoise, q * .137 + (a.rg - .5) * .17 + morph * .006);
  vec4 c = texture(uNoise, q * .41 + (b.rg - .5) * .11 - morph * .009);
  vec4 e = texture(uNoise, q * 1.17 + (c.rg - .5) * .05 + morph * .014);
  float sheet = a.r * .5 + b.r * .3 + c.g * .14 + e.r * .06;
  float heap = a.g * .4 + b.a * .3 + c.a * .22 + e.a * .08;
  return mix(sheet, heap + .03, uPuff);
}

// Each layer leaves early where it adds nothing, below the horizon above all: a third of the screen where the
// clouds would otherwise be worked out in full and then multiplied by zero.
vec4 cirrus(vec2 uv, vec3 sky) {
  float d = uHorizon - uv.y;
  if (uCirrus < .005 || d <= 0.) return vec4(0.);
  vec2 p = deck(uv, .3) * vec2(1., .62) + uDrift * .45;
  vec2 tilt = vec2(p.x * .94 + p.y * .34, p.y * .94 - p.x * .34);
  vec4 big = texture(uNoise, tilt * .05);
  vec4 hair = texture(uNoise, vec2(tilt.x * .085, tilt.y * .46) + (big.rg - .5) * .2);
  vec4 fine = texture(uNoise, vec2(tilt.x * .22, tilt.y * 1.5) + (hair.rg - .5) * .1);
  float n = hair.b * .66 + fine.b * .34;
  float a = smoothstep(.5, .92, n) * smoothstep(.42, .72, big.r) * smoothstep(0., .2, d);
  vec3 col = mix(sky, mix(uLit, uGlow, .4), .72);
  a *= uCirrus * .66;
  return vec4(col * a, a);
}

vec4 clouds(vec2 uv, vec3 sky, vec3 hazeLine, vec2 toSun, float dist, out float body) {
  body = 0.;
  if (uCover < .004) return vec4(0.);
  float d = uHorizon - uv.y;
  // Lightning still wants the cloud's shape down there, so a flash takes the long way.
  float rise = smoothstep(-.07, .1, d);
  if (rise <= 0. && uFlash <= .002) return vec4(0.);
  float th = mix(.74, .23, sqrt(uCover));
  float soft = mix(.1, .3, uCover) * mix(1.5, .62, uPuff);
  // Light comes along the screen towards the sun; with no sun up, from above.
  vec2 L = normalize(mix(vec2(0., -1.), toSun, uSunVis * smoothstep(.02, .42, dist)) + vec2(0., -.001));
  vec2 hop = vec2(L.x, L.y * 1.3) * .46;
  float near = exp(-dist * dist * 5.2) * uSunVis;
  float wide = exp(-dist * dist * 1.25) * uSunVis;
  vec4 acc = vec4(0.);
  for (int i = 0; i < 3; i++) {
    float k = 1. + float(i) * .075;
    vec2 p = deck(uv, .14) * k + vec2(float(i) * 3.7, float(i) * 1.3);
    float n = field(p, uTime * (1. + float(i) * .3));
    float den = smoothstep(th, th + soft, n);
    if (den < .004) continue;
    float toward = field(p + hop, uTime);
    float toward2 = field(p + hop * 2.4, uTime);
    float occ = smoothstep(th - .05, th + .2, toward) * .62 + smoothstep(th - .05, th + .24, toward2) * .38;
    float belly = smoothstep(th + .06, th + .36, n);
    float lit = (1. - occ * .84) * (1. - belly * .34);
    vec3 col = mix(uShade, uLit, clamp(lit, 0., 1.));
    // Breathe in the colour of the sky behind: rose at dusk, blue at noon.
    col = mix(col, sky, .13 + .1 * (1. - den));
    // Thin cloud near the sun lights up from within; that is the silver lining.
    float thin = 1. - smoothstep(th, th + .16, n);
    col += uGlow * (near * (.2 + thin * 1.05) + wide * thin * .2);
    // Far cloud dissolves into the horizon's haze.
    col = mix(hazeLine, col, .2 + .8 * smoothstep(0., .17, d));
    float a = den * (.78 - float(i) * .08) * rise;
    acc += vec4(col * a, a) * (1. - acc.a);
    if (i == 0) body = n;
    if (acc.a > .985) break;
  }
  return acc;
}

vec4 curtains(vec2 uv, vec3 skyLine) {
  float d = uHorizon - uv.y;
  if (uShafts < .005 || d >= .52 || d <= -.1) return vec4(0.);
  float h = smoothstep(.52, .1, d) * smoothstep(-.1, .03, d);
  float x = uv.x * uAspect + (uv.y - uHorizon) * (.1 + uWind * .34);
  float n = texture(uNoise, vec2(x * .34 - uDrift.x * .05, uTime * .0012)).r * .7
          + texture(uNoise, vec2(x * 1.15 + uDrift.x * .03, uTime * .0021)).g * .3;
  float a = uShafts * h * smoothstep(.42, .7, n) * .5;
  vec3 col = mix(uShade * .82, skyLine, .24);
  return vec4(col * a, a);
}

vec4 fog(vec2 uv, vec3 skyLine, float dist) {
  if (uFog < .004) return vec4(0.);
  float d = uHorizon - uv.y;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  // Long flat banks, slower and wider the higher they lie.
  float a1 = texture(uNoise, vec2(p.x * .13 - uDrift.x * .32, p.y * .62 + uTime * .0008)).r;
  float a2 = texture(uNoise, vec2(p.x * .31 + uDrift.x * .22, p.y * 1.5 - uTime * .0012)).g;
  float a3 = texture(uNoise, vec2(p.x * .74 - uDrift.x * .44, p.y * 3.4 + a1 * .2)).r;
  float banks = a1 * .5 + a2 * .32 + a3 * .18;
  // Thick at the horizon and below it, thinning upwards, with the banks eating into its upper edge.
  float height = d + (banks - .5) * .42;
  float a = 1. - smoothstep(-.02, mix(.1, .62, uFog), height);
  a = a * (.8 + (banks - .5) * 1.5) + .14;
  a = clamp(a * smoothstep(0., .5, uFog) * (.55 + .45 * uFog), 0., .97);
  vec3 pale = mix(skyLine, vec3(.93, .935, .94) * (.14 + .86 * uDay), .32 + .34 * uDay);
  vec3 col = pale + uGlow * exp(-dist * dist * 2.4) * uSunVis * .34;
  return vec4(col * a, a);
}

vec4 blowing(vec2 uv) {
  if (uBlow < .005) return vec4(0.);
  vec2 p = vec2(uv.x * uAspect - uTime * .1, uv.y * 3.1 + uTime * .012);
  float n = texture(uNoise, p * vec2(.16, .3)).r * texture(uNoise, p * vec2(.45, .9) + .3).g * 2.;
  float a = uBlow * smoothstep(.3, .72, n) * .52;
  return vec4(uLit * a, a);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 uv = vUv;
  float d = uHorizon - uv.y;
  vec3 sky = texture(uSky, uv).rgb;
  vec3 skyLine = texture(uSky, vec2(uv.x, uHorizon)).rgb;
  vec2 toSun = uSun - uv; toSun.x *= uAspect;
  float dist = max(length(toSun), .001);
  toSun /= dist;

  // The veil: a soft ceiling, brighter towards the horizon, with the sun a pale patch somewhere in it.
  float lift = d > 0. ? exp(-d * 3.6) : exp(d * 9.);
  vec3 veilCol = uVeilCol * (1. + .2 * lift) * (1. - .2 * smoothstep(0., .68, d)) * (1. - .34 * smoothstep(0., .32, -d));
  veilCol = mix(veilCol, skyLine, .1 * (1. - uVeil * .6));
  veilCol = mix(veilCol, uShade, .55 * uVeil * smoothstep(.01, -.14, d));
  veilCol += uGlow * exp(-dist * dist * 3.2) * uSunVis * .26;
  vec4 o = vec4(veilCol * uVeil, uVeil);
  vec3 hazeLine = mix(skyLine, mix(uVeilCol, uShade, .25), smoothstep(.1, .7, uVeil));

  o = over(cirrus(uv, sky), o);
  o = over(curtains(uv, hazeLine), o);

  float body = 0.;
  vec4 c = clouds(uv, sky, hazeLine, toSun, dist, body);
  o = over(c, o);

  // Beams breaking through the gaps: never drawn on the thick of a cloud.
  if (uRays > .005 && uSunVis > .01) {
    float ang = atan(toSun.y, toSun.x);
    float n = texture(uNoise, vec2(ang * .36, uTime * .0016)).r * .7 + texture(uNoise, vec2(ang * 1.07, -uTime * .0022)).g * .3;
    float rays = smoothstep(.4, .82, n) * exp(-dist * 2.3) * smoothstep(.04, .3, dist);
    float a = rays * uRays * uSunVis * (1. - c.a * .84) * .15;
    o = over(vec4(uGlow * a, a * .5), o);
  }

  o = over(fog(uv, skyLine, dist), o);
  o = over(blowing(uv), o);

  // Lightning lights the clouds from within, so it shows their shapes rather than whitening the screen.
  if (uFlash > .002) {
    vec2 f = (uv - uFlashAt) * vec2(uAspect, 1.);
    float reach = exp(-dot(f, f) * 4.2);
    float shape = .34 + 1.15 * smoothstep(.3, .78, body > 0. ? body : .5);
    vec3 cold = vec3(.8, .84, 1.);
    o.rgb += cold * uFlash * reach * shape * .62 * o.a;
    o.rgb += cold * uFlash * .05 * o.a;
  }

  // A pinch of dither: slow gradients at low resolution would otherwise band.
  float dither = (hash(gl_FragCoord.xy + fract(uTime) * 7.) - .5) / 255. * 1.6;
  o.rgb = clamp(o.rgb + dither * step(.002, o.a), vec3(0.), vec3(max(o.a, 0.)));
  // For peek(): the sky as a whole, the painted sky with the clouds over it, so nothing is mixed on the CPU.
  frag = uOpaque > .5 ? vec4(o.rgb + sky * (1. - o.a), 1.) : o;
}`;

// GPU rows come bottom first; the page reads top first.
function flip(rows, w, h) {
  const out = new Uint8ClampedArray(rows.length), row = w * 4;
  for (let y = 0; y < h; y++) out.set(rows.subarray((h - 1 - y) * row, (h - y) * row), y * row);
  return out;
}

// The noise comes baked (see noise.js): decoding it takes a tenth of a millisecond, baking it here took 10–14.
const decode = b64 => (Uint8Array.fromBase64 ? Uint8Array.fromBase64(b64) : Uint8Array.from(atob(b64), c => c.charCodeAt(0)));

export class Clouds {
  constructor(canvas, atmosphereCanvas) {
    this.canvas = canvas;
    this.source = atmosphereCanvas;
    // The painted sky, shrunk: colours only, no detail needed. It also tells the page what is behind its text.
    this.small = document.createElement('canvas');
    this.small.width = 96; this.small.height = 54;
    this.sctx = this.small.getContext('2d', { willReadFrequently: true });
    this.sctx.imageSmoothingQuality = 'high';
    // Without a working GPU the sky simply has no clouds; it must never take the page down.
    try { this.gl = this.start(); } catch (e) { console.warn('[tabula] clouds are off:', e); this.gl = null; }
    this.resize();
  }
  start() {
    const canvas = this.canvas;
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const compile = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    gl.bindVertexArray(gl.createVertexArray());
    this.u = new Proxy({}, { get: (cache, name) => cache[name] ?? (cache[name] = gl.getUniformLocation(prog, name)) });

    const noise = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, noise);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NOISE_SIZE, NOISE_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, decode(NOISE));
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);

    this.skyTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.skyTex);
    for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.uniform1i(this.u.uNoise, 0);
    gl.uniform1i(this.u.uSky, 1);
    return gl;
  }
  // Chrome keeps a limited number of live GPU contexts and takes them from the oldest tabs.
  get lost() { return !!this.gl?.isContextLost(); }
  destroy() {
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.gl = null;
    this.drawn = null;
  }
  get ok() { return !!this.gl; }
  // Soft shapes: well under the screen's resolution is plenty, and keeps a new tab cheap. At 0.6 of the window a
  // midday sky of separate clouds, the sharpest there is, differs from a full Retina render by more than 3 of 255
  // in 0.3% of its pixels (11 at most, in the thin streaks along the horizon), for a twelfth of the pixels.
  // At most 885 wide, so a large screen costs no more than a 1475 px window.
  resize() {
    if (!this.gl) return;
    const w = innerWidth, h = innerHeight, scale = Math.min(.6, 885 / w);
    this.canvas.width = Math.round(w * scale); this.canvas.height = Math.round(h * scale);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.aspect = w / h;
  }
  // Call after the theme has repainted its atmosphere.
  syncSky() {
    this.sctx.drawImage(this.source, 0, 0, 96, 54);
    const gl = this.gl;
    if (!gl) return;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.skyTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.small);
  }
  // The whole sky as it is on screen, painted sky and clouds together, as small as the sky texture: RGBA bytes,
  // top row first. Used to choose the page's ink, a few times a second at most.
  // Reading pixels back makes the page wait until the GPU has drawn everything asked of it, a full frame of clouds
  // included. Only the first read waits, so the page opens with the right ink; later calls ask for the pixels and
  // get them on the next call: the sky as it was a moment ago, or null while the GPU has not got there yet.
  peek() {
    const { width: w, height: h } = this.small, gl = this.gl;
    if (!gl || !this.drawn) return this.sctx.getImageData(0, 0, w, h).data;
    const t = this.peekTarget ??= this.peekStart(w, h);
    let ready = null;
    if (t.sync) {
      if (gl.getSyncParameter(t.sync, gl.SYNC_STATUS) !== gl.SIGNALED) return null;
      gl.deleteSync(t.sync);
      t.sync = null;
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, t.buffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, t.pixels);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      ready = flip(t.pixels, w, h);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, w, h);
    this.render({ ...this.drawn, flash: 0 }, true);
    if (t.first) {
      t.first = false;
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, t.pixels);
      ready = flip(t.pixels, w, h);
    } else {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, t.buffer);
      // Fresh storage for every read: Chrome drops its fast copy of a buffer that is written twice, read or not.
      gl.bufferData(gl.PIXEL_PACK_BUFFER, w * h * 4, gl.STREAM_READ);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, 0);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      t.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    return ready;
  }
  // A small target to draw the sky for peek() into, and a buffer the GPU copies it to on its own time.
  peekStart(w, h) {
    const gl = this.gl, tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, buffer: gl.createBuffer(), pixels: new Uint8Array(w * h * 4), first: true, sync: null };
  }
  // aside: drawing for peek(), not for the screen.
  render(p, aside = false) {
    const gl = this.gl, u = this.u;
    if (!gl) return;
    if (!aside) this.drawn = p;
    gl.uniform1f(u.uAspect, this.aspect);
    gl.uniform1f(u.uOpaque, aside ? 1 : 0);
    gl.uniform1f(u.uTime, p.time);
    gl.uniform1f(u.uHorizon, p.horizon);
    gl.uniform2f(u.uSun, p.sunX, p.sunY);
    gl.uniform1f(u.uSunVis, p.sunVis);
    gl.uniform1f(u.uDay, p.day);
    gl.uniform2f(u.uDrift, p.driftX, p.driftY);
    gl.uniform3fv(u.uLit, p.light.lit);
    gl.uniform3fv(u.uShade, p.light.shade);
    gl.uniform3fv(u.uGlow, p.light.glow);
    gl.uniform3fv(u.uVeilCol, p.light.veil);
    gl.uniform1f(u.uCover, p.cover);
    gl.uniform1f(u.uPuff, p.puff);
    gl.uniform1f(u.uCirrus, p.cirrus);
    gl.uniform1f(u.uVeil, p.veil);
    gl.uniform1f(u.uFog, p.fog);
    gl.uniform1f(u.uShafts, p.shafts);
    gl.uniform1f(u.uRays, p.rays);
    gl.uniform1f(u.uBlow, p.blow);
    gl.uniform1f(u.uWind, p.wind);
    gl.uniform1f(u.uFlash, p.flash);
    gl.uniform2f(u.uFlashAt, p.flashX, p.flashY);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
