// Ported from the daylight study in the lab branch (the "Дыхание неба" demo); drawing is unchanged, the size is now a parameter.
import { RAD, clamp, mix, smooth, solar, sidereal, horizontal } from './astronomy.js';
import { createStars } from './stars.js';

const rgb = hex => hex.match(/\w\w/g).map(s => parseInt(s, 16));
const blend = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const color = (v, a = 1) => `rgba(${v.map(Math.round)},${clamp(a)})`;
// Altitude anchors: colours remain continuous, including both sides of midnight.
const PALETTE = [
  [-18, '0a1020', '18283e', '1e2c3e', '101724'],
  [-10, '152440', '3d516d', '666775', '252c42'],
  [-5, '243a59', '69738d', 'bd828f', '343d56'],
  [0, '455d78', '9c95a7', 'e4ad91', '5c5c73'],
  [7, '8aaab9', 'c8c4c4', 'efd0a8', 'aaa4a1'],
  [22, '99bac9', 'c4d3d4', 'e4ddc8', 'c0c1ba'],
  [70, '9dbdce', 'c8d9db', 'e7e2cc', 'c3ccc8'],
].map(([alt, ...cols]) => [alt, ...cols.map(rgb)]);
function palette(alt) {
  let i = 0;
  while (i < PALETTE.length - 2 && alt > PALETTE[i + 1][0]) i++;
  const a = PALETTE[i], b = PALETTE[i + 1], t = smooth(a[0], b[0], alt);
  return a.slice(1).map((v, j) => blend(v, b[j + 1], t));
}
// Atmospheric sun tint: -1 pulls the warm colours towards yellow, 1 towards red, 0 leaves them as drawn.
const YELLOW = rgb('ffdc8c'), RED = rgb('dc4b3c');
const toner = tint => col => tint ? blend(col, tint < 0 ? YELLOW : RED, Math.abs(tint) * .55) : col;
function ellipse(ctx, x, y, rx, ry, col, alpha) {
  if (alpha < .001) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, color(col, alpha)); g.addColorStop(.2, color(col, alpha * .78));
  g.addColorStop(.55, color(col, alpha * .26)); g.addColorStop(1, color(col, 0));
  ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
}
function random(seed) { return () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; }; }
function sprite(col) {
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const x = c.getContext('2d'), g = x.createRadialGradient(24, 24, 0, 24, 24, 24);
  g.addColorStop(0, color(col, .95)); g.addColorStop(.1, color(col, .65));
  g.addColorStop(.3, color(col, .18)); g.addColorStop(1, color(col, 0));
  x.fillStyle = g; x.fillRect(0, 0, 48, 48); return c;
}
// One tiny, static texture, tinted once. No per-frame noise or large blur filters.
function makeVeils() {
  const rnd = random(3428), w = 384, h = 128, grid = Array.from({ length: 33 * 17 }, rnd);
  const noise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), u = smooth(0, 1, x - ix), v = smooth(0, 1, y - iy);
    const at = (a, b) => grid[(b % 17) * 33 + a % 33];
    return mix(mix(at(ix, iy), at(ix + 1, iy), u), mix(at(ix, iy + 1), at(ix + 1, iy + 1), u), v);
  };
  return ['edc1b2', 'f2e7cf', '8591b1'].map(hex => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'), img = x.createImageData(w, h), col = rgb(hex);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const u = i / w, v = j / h;
      const n = .65 * noise(u * 7, v * 7) + .35 * noise(u * 22, v * 14);
      const edge = Math.sin(Math.PI * u) ** 2 * Math.sin(Math.PI * v) ** 2;
      const alpha = smooth(.36, .75, n) * edge;
      const k = (j * w + i) * 4; img.data.set([...col, alpha * 255], k);
    }
    x.putImageData(img, 0, 0); return c;
  });
}

export class Sky {
  // size: { w, h } for an off-page canvas (the settings preview); the page uses the window size.
  constructor(atmosphere, stars, size) {
    this.canvas = atmosphere; this.starCanvas = stars;
    this.ctx = atmosphere.getContext('2d', { alpha: false }); this.sc = stars.getContext('2d');
    this.disc = document.createElement('canvas'); this.disc.width = this.disc.height = 192;
    this.dc = this.disc.getContext('2d'); this.veils = makeVeils();
    this.sprites = ['d5e0ee', 'f0dbbd', 'bccce9'].map(s => sprite(rgb(s)));
    this.stars = createStars();
    this.resize(size);
  }
  resize(size) {
    this.w = size?.w ?? innerWidth; this.h = size?.h ?? innerHeight;
    // Atmospheric detail does not benefit from retina resolution; cap total work on 4K.
    const ratio = Math.min(1, 1600 / this.w), starsRatio = Math.min(1.5, devicePixelRatio || 1, 2400 / this.w);
    for (const [cv, ctx, scale] of [[this.canvas, this.ctx, ratio], [this.starCanvas, this.sc, starsRatio]]) {
      cv.width = Math.round(this.w * scale); cv.height = Math.round(this.h * scale);
      ctx.setTransform(cv.width / this.w, 0, 0, cv.height / this.h, 0, 0);
    }
    this.lastAtmosphere = '';
  }
  draw(ms, state, visualTime = 0) {
    const sun = solar(ms, state.place);
    const key = [Math.floor(ms / 1000), state.sunStyle, state.horizon, state.sharpness, state.warmth, state.haze, state.tint, state.place.lat, state.place.lon].join(':');
    if (key !== this.lastAtmosphere) {
      this.paintAtmosphere(sun, state); this.lastAtmosphere = key;
    }
    this.paintStars(ms, sun.altitude, state, visualTime);
    return sun;
  }
  paintAtmosphere(sun, state) {
    const c = this.ctx, w = this.w, h = this.h, hy = h * state.horizon, e = sun.altitude;
    const [top, mid, horizon, bottom] = palette(e);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, color(top)); g.addColorStop(state.horizon * .65, color(mid));
    g.addColorStop(state.horizon, color(horizon)); g.addColorStop(1, color(bottom));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const rising = sun.hourAngle < 0;
    const twilight = smooth(-13, -2, e) * (1 - smooth(4, 25, e));
    const daylight = smooth(-4, 12, e);
    const direction = state.place.lat < 0 ? -1 : 1;
    const sx = w * (.5 + direction * .38 * Math.sin(sun.hourAngle));
    const sy = hy - sun.up / Math.max(.32, sun.maxUp) * (hy - h * .11);
    const atmospheric = state.sunStyle === 'atmospheric';
    // Haze 0.5 is the drawn look: lower gathers the glow around the sun, higher spreads it and softens the disc.
    const tone = toner(atmospheric ? state.tint : 0), spread = atmospheric ? mix(.6, 1.4, state.haze) : 1;
    const warm = tone(blend(rgb('f6a475'), rgb('fff0c8'), smooth(0, 24, e)));
    const strength = state.warmth;
    // Relative ascent dissolves the disc near noon even on short winter days.
    // Very low polar sun retains a disc instead of imitating a high summer sun.
    const dissolve = atmospheric ? smooth(.18, .8, sun.up / Math.max(.12, sun.maxUp)) * smooth(3, 15, e) : 0;
    // Blue/violet counterlight makes warm light feel local, not a uniform orange overlay.
    ellipse(c, w - sx, hy - h * .14, w * .85, h * .55, rgb(rising ? 'a5a5c8' : '9f8eaf'), twilight * .22);
    ellipse(c, sx, hy - h * .04, w * .85, h * .58, rgb(rising ? 'e4a7a2' : 'e69881'), twilight * .37 * strength);
    if (atmospheric) {
      const ember = tone(blend(rgb(rising ? 'ed846e' : 'e77365'), rgb('ffedbd'), smooth(0, 22, e)));
      const fill = smooth(-10, 3, e);
      // Keep ambient fill broad; as the disc dissolves, a warmer, more local
      // field carries its position across the sky without becoming a new disc.
      ellipse(c, sx, sy, w * 1.35 * spread, h * 1.55 * spread, ember, fill * .56 * strength);
      const sunlight = blend(warm, tone(rgb('ffe2a3')), dissolve);
      ellipse(c, sx, sy, w * mix(.85, .46, dissolve) * spread, h * mix(1.05, .82, dissolve) * spread, sunlight, daylight * mix(.38, .88, dissolve) * strength);
      ellipse(c, sx, hy - h * .03, w * .95 * spread, h * .48 * spread, tone(rgb('e97d73')), twilight * .48 * strength);
      ellipse(c, sx, hy, w * .58 * spread, h * .24 * spread, tone(rgb('f6a078')), twilight * .37 * strength);
    } else {
      ellipse(c, sx, sy, w * .95, h * .95, warm, daylight * .34 * strength);
      ellipse(c, sx, sy, w * .48, h * .58, warm, daylight * .27 * strength);
    }
    // Broad horizon emission crosses the horizon on both sides, with no clipping plane.
    ellipse(c, sx, hy, w * .68, h * .21, tone(rgb('ed977d')), twilight * .39 * strength);
    ellipse(c, sx, hy + h * .018, w * .38, h * .10, tone(rgb('ffc28b')), twilight * .45 * strength);
    const visible = smooth(-3.8, -.3, e);
    if (visible > .001) {
      const radius = Math.max(13, Math.min(w, h) * (atmospheric ? .038 : .032));
      const core = visible * (1 - dissolve);
      ellipse(c, sx, sy, radius * 8 * spread, radius * 7 * spread, warm, core * (atmospheric ? .38 : .24) * strength);
      ellipse(c, sx, sy, radius * 3, radius * 2.6, tone(rgb('ffe0ad')), core * (atmospheric ? .42 : .25) * strength);
      // Both styles share the same disc and horizon mask, with separate edge/opacity.
      const d = this.dc, size = 192, center = size / 2;
      d.clearRect(0, 0, size, size);
      const r = center * .7, disk = d.createRadialGradient(center, center, 0, center, center, r);
      // The atmospheric disc's edge follows haze (0.5 gives the old 0.912); the soft disc keeps its sharpness slider.
      const edge = atmospheric ? clamp(.912 - (state.haze - .5) * .4, .6, .97) : mix(.38, .91, state.sharpness);
      const col = tone(blend(rgb(atmospheric ? 'ffe2b1' : 'ffd29f'), rgb('fff1cb'), smooth(0, 18, e)));
      disk.addColorStop(0, color(col, .88)); disk.addColorStop(edge, color(col, .84));
      disk.addColorStop(1, color(col, 0)); d.fillStyle = disk; d.fillRect(0, 0, size, size);
      // A finite haze depth absorbs the submerged disc gradually; bloom remains below it.
      const extent = radius / .7;
      const horizonInDisc = (hy - (sy - extent)) / (extent * 2);
      const mask = d.createLinearGradient(0, 0, 0, size);
      for (let i = 0; i <= 24; i++) {
        const y = i / 24;
        mask.addColorStop(y, `rgba(0,0,0,${1 - smooth(horizonInDisc - .09, horizonInDisc + .32, y)})`);
      }
      d.globalCompositeOperation = 'destination-in'; d.fillStyle = mask; d.fillRect(0, 0, size, size); d.globalCompositeOperation = 'source-over';
      c.globalAlpha = core * (atmospheric ? .94 : (.67 + .18 * strength)); c.drawImage(this.disc, sx - extent, sy - extent, extent * 2, extent * 2); c.globalAlpha = 1;
    }
    // The "drop": concentrated light in haze, present before the disc clears the horizon.
    const contact = Math.exp(-(((e + .6) / 3.2) ** 2)) * strength;
    ellipse(c, sx, hy, w * .18, h * .055, tone(rgb('ffcc91')), contact * .47);
    ellipse(c, sx, hy + h * .04, w * .26, h * .15, tone(rgb('e5b59c')), contact * .17);
    // Thin, irregular veils. Static at paused time; evolve with solar time while playing.
    const drift = Math.sin(sun.hourAngle * .8) * w * .025;
    c.globalAlpha = twilight * .13 + daylight * .035;
    c.drawImage(this.veils[rising ? 1 : 0], -w * .12 + drift, hy - h * .32, w * 1.2, h * .35);
    c.globalAlpha = twilight * .065;
    c.drawImage(this.veils[2], w * .12 - drift, hy - h * .22, w, h * .26);
    c.globalAlpha = 1;
    // Darken the bottom very gradually; this is atmosphere, not a ground silhouette.
    const floor = c.createLinearGradient(0, hy - h * .03, 0, h);
    floor.addColorStop(0, color(bottom, 0)); floor.addColorStop(.45, color(bottom, .12)); floor.addColorStop(1, color(bottom, .55));
    c.fillStyle = floor; c.fillRect(0, 0, w, h);
  }
  paintStars(ms, elevation, state, time) {
    const c = this.sc, w = this.w, h = this.h;
    c.clearRect(0, 0, w, h);
    const night = 1 - smooth(-15, -4, elevation);
    if (night < .001) return;
    const place = state.starPlace || state.place, lst = sidereal(ms, place.lon);
    const bearing = (state.bearing === 'pole' ? (place.lat >= 0 ? 0 : 180) : +state.bearing) * RAD;
    const sin = Math.sin(bearing), cos = Math.cos(bearing), hy = h * state.horizon;
    for (const star of this.stars) {
      const p = horizontal(star.ra, star.dec, lst, place.lat);
      const forward = p.east * sin + p.north * cos;
      if (forward <= 0 || p.up <= 0) continue;
      const right = p.east * cos - p.north * sin;
      const x = w * (.5 + right * .64), y = hy - p.up * (hy - h * .025);
      if (x < -8 || x > w + 8) continue;
      const haze = smooth(0, .23, p.up), limb = smooth(0, .15, forward);
      const scintillation = .94 + .06 * Math.sin(time * .7 + star.phase);
      c.globalAlpha = clamp(night * state.starlight * star.brightness * haze * limb * scintillation * .85);
      const size = (2.3 + star.brightness * 4.6) * Math.min(1.25, Math.max(.8, w / 1400));
      c.drawImage(this.sprites[star.tint], x - size / 2, y - size / 2, size, size);
    }
    c.globalAlpha = 1;
  }
}
