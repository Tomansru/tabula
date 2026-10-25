// Theme "Sky": a neutral background with a time-of-day sky.
// The sun travels an arc from the horizon (the search bar), twilight comes in stages, stars turn around the celestial pole.
import { settings as S } from '../store.js';
import { sunSchedule } from '../weather.js';
import { t } from '../i18n.js';
import { h } from '../util.js';
import { sunAt, sunDk, nowHour, smooth, clamp, lerp } from '../sun.js';

const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mix = (a, b, k) => a.map((v, i) => Math.round(lerp(v, b[i], k)));
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a).toFixed(3)})`;

const COL = {
  violet: hex('#b08ad8'), pink: hex('#ff8fa3'), orange: hex('#ffa257'), gold: hex('#ffd48a'),
  dayLight: hex('#ffe6a8'), dayDark: hex('#ffdcaa'),
  baseLight: hex('#f1eee8'), baseDark: hex('#11141b'),
};
function glowColor(e, dk) {
  if (e < -0.05) return mix(COL.violet, COL.pink, smooth(-0.3, -0.05, e));
  if (e < 0.15) return mix(COL.pink, COL.orange, smooth(-0.05, 0.15, e));
  if (e < 0.45) return mix(COL.orange, COL.gold, smooth(0.15, 0.45, e));
  return mix(COL.gold, mix(COL.dayLight, COL.dayDark, dk), smooth(0.45, 0.85, e));
}

// Soft star dots, pre-rendered once.
function starSprite(rgb) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(0.25, `rgba(${rgb},.7)`);
  g.addColorStop(0.55, `rgba(${rgb},.15)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, 32, 32);
  return c;
}
let STAR_LIGHT, STAR_DARK;

const systemDark = matchMedia('(prefers-color-scheme: dark)');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// 0 light … 1 dark, following the light/dark mode setting.
function modeDk(e) {
  if (S.mode === 'sun') return sunDk(e);
  if (S.mode === 'dark') return 1;
  if (S.mode === 'light') return 0;
  return systemDark.matches ? 1 : 0;
}

/* ---------- painter: draws the sky onto one canvas; used by the page and by the settings preview ---------- */
class SkyPainter {
  constructor(canvas) {
    STAR_LIGHT ||= starSprite('255,255,255');
    STAR_DARK ||= starSprite('52,64,106');
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.glow = document.createElement('canvas');
    this.gctx = this.glow.getContext('2d');
  }

  resize(w, h, dpr) {
    this.w = w; this.h = h;
    for (const [cv, cx] of [[this.canvas, this.ctx], [this.glow, this.gctx]]) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // Random sky in polar coordinates around the pole: lots of faint stars, a handful of bright ones.
    const R = Math.hypot(w, h) * 1.05;
    this.starScale = Math.max(0.6, w / 1100);
    this.stars = Array.from({ length: Math.round(clamp(w * h / 5000, 60, 360)) }, () => {
      const m = Math.pow(Math.random(), 2.6);
      return {
        r: Math.sqrt(Math.random()) * R, a0: Math.random() * Math.PI * 2,
        s: (0.5 + 1.3 * m) * this.starScale, al: 0.14 + 0.66 * m,
        tw: Math.random() < 0.2, sp: 0.4 + Math.random() * 1.2, ph: Math.random() * 6.28,
      };
    });
  }

  // o: { t, hy, base } — base paints the theme background too (the page has its own).
  draw({ t, hy, base }) {
    const c = this.ctx, w = this.w, h = this.h;
    if (!w || !h) return null;
    const hour = nowHour();
    const { d, e } = sunAt(hour, sunSchedule());
    const lat = S.location?.lat ?? 50;
    const dk = modeDk(e);
    const st = {
      stars: 1 - smooth(-0.3, -0.12, e),
      darkSky: 1 - smooth(-0.26, 0.02, e),
      blueHour: smooth(-0.32, -0.06, e),
      dawn: smooth(-0.24, -0.02, e) * (1 - smooth(0.12, 0.4, e)),
      sunUp: smooth(-0.03, 0.08, e),
    };
    const along = lerp(0.04, 0.96, clamp(d, -0.12, 1.12));
    const sx = (lat < 0 ? 1 - along : along) * w; // facing the sun: left→right in the north, right→left in the south
    const sy = hy - e * hy * 0.92;
    c.clearRect(0, 0, w, h);

    if (base) {
      c.fillStyle = rgba(mix(COL.baseLight, COL.baseDark, dk), 1);
      c.fillRect(0, 0, w, h);
    } else if (S.mode === 'sun') {
      // The page flips light/dark at the midpoint; this layer turns the flip into a gradual fade.
      const pageDark = document.documentElement.dataset.theme === 'dark';
      const a = pageDark ? 1 - dk : dk;
      if (a > 0.003) {
        c.fillStyle = rgba(pageDark ? COL.baseLight : COL.baseDark, a);
        c.fillRect(0, 0, w, h);
      }
    }

    // Night sky lightening through the blue hour; the ground under the horizon fades in softly.
    if (st.darkSky > 0.001) {
      const top = mix(mix(hex('#b6bfda'), hex('#c8d1e8'), st.blueHour), mix(hex('#0b1230'), hex('#1b2a60'), st.blueHour), dk);
      const hor = mix(mix(hex('#cad0e2'), hex('#dde2ef'), st.blueHour), mix(hex('#1a2550'), hex('#40528f'), st.blueHour), dk);
      const a = lerp(0.72, 0.93, dk) * st.darkSky;
      const g = c.createLinearGradient(0, 0, 0, hy);
      g.addColorStop(0, rgba(top, a));
      g.addColorStop(1, rgba(hor, a));
      c.fillStyle = g;
      c.fillRect(0, 0, w, hy);
      const gr = c.createLinearGradient(0, hy, 0, hy + h * 0.08);
      gr.addColorStop(0, rgba(hor, a));
      gr.addColorStop(1, rgba(mix(hor, mix(hex('#e4e7f0'), hex('#05070f'), dk), 0.5), a));
      c.fillStyle = gr;
      c.fillRect(0, hy, w, h - hy);
    }
    if (st.stars > 0.01) this.drawStars(t, st.stars * lerp(0.6, 0.75, dk), dk, hour, hy, lat);

    // Light above the horizon, drawn off-screen so it can be cut off just below the horizon line.
    const G = this.gctx;
    G.clearRect(0, 0, w, h);
    let lit = false;
    if (st.dawn > 0.005) {
      const col = glowColor(Math.min(e, 0.1), dk);
      const bw = w * 0.75, bh = h * 0.085;
      G.save();
      G.translate(sx, hy);
      G.scale(1, bh / bw);
      const b = G.createRadialGradient(0, 0, 0, 0, 0, bw);
      b.addColorStop(0, rgba(col, lerp(0.75, 0.55, dk) * st.dawn));
      b.addColorStop(0.5, rgba(col, lerp(0.28, 0.2, dk) * st.dawn));
      b.addColorStop(1, rgba(col, 0));
      G.fillStyle = b;
      G.fillRect(-bw, -bw, bw * 2, bw * 2);
      G.restore();
      lit = true;
    }
    if (st.sunUp > 0.005) {
      const col = glowColor(e, dk);
      const low = 1 - smooth(0, 0.5, Math.max(e, 0));
      const rx = w * lerp(0.5, 0.55, low), ry = rx * lerp(0.8, 0.38, low);
      const a0 = lerp(lerp(0.6, 0.62, low), lerp(0.3, 0.38, low), dk) * st.sunUp;
      G.save();
      G.translate(sx, sy);
      G.scale(1, ry / rx);
      const g = G.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, rgba(col, a0));
      g.addColorStop(0.4, rgba(col, a0 * 0.5));
      g.addColorStop(1, rgba(col, 0));
      G.fillStyle = g;
      G.fillRect(-rx, -rx, rx * 2, rx * 2);
      G.restore();
      const core = st.sunUp * (1 - smooth(0.2, 0.55, e));
      if (core > 0.005) {
        const cr = w * 0.045;
        const k = G.createRadialGradient(sx, sy, 0, sx, sy, cr);
        k.addColorStop(0, rgba(mix(col, [255, 250, 235], 0.6), lerp(0.85, 0.6, dk) * core));
        k.addColorStop(1, rgba(col, 0));
        G.fillStyle = k;
        G.fillRect(sx - cr, sy - cr, cr * 2, cr * 2);
      }
      lit = true;
    }
    if (lit) {
      G.globalCompositeOperation = 'destination-in';
      const m = G.createLinearGradient(0, 0, 0, h);
      const hf = hy / h;
      m.addColorStop(0, '#000');
      m.addColorStop(hf, '#000');
      m.addColorStop(Math.min(1, hf + 0.045), 'rgba(0,0,0,0)');
      G.fillStyle = m;
      G.fillRect(0, 0, w, h);
      G.globalCompositeOperation = 'source-over';
      c.drawImage(this.glow, 0, 0, w, h);

      // Ground in light mist: a soft, flattened reflection under the horizon.
      const near = 1 - smooth(0.1, 0.7, Math.max(e, 0));
      const ra = lerp(0.42, 0.3, dk) * Math.max(st.dawn * 0.8, st.sunUp * lerp(0.45, 1, near));
      if (ra > 0.005) {
        const rcol = mix(glowColor(e, dk), mix([235, 232, 226], [70, 74, 90], dk), 0.3);
        const rrx = w * 0.5, rry = h * 0.1;
        c.save();
        c.beginPath();
        c.rect(0, hy, w, h - hy);
        c.clip();
        c.translate(sx, hy);
        c.scale(1, rry / rrx);
        const r = c.createRadialGradient(0, 0, 0, 0, 0, rrx);
        r.addColorStop(0, rgba(rcol, ra));
        r.addColorStop(0.5, rgba(rcol, ra * 0.35));
        r.addColorStop(1, rgba(rcol, 0));
        c.fillStyle = r;
        c.fillRect(-rrx, -rrx, rrx * 2, rrx * 2);
        c.restore();
      }
    }
    return { e, dk, st, sx, sy };
  }

  // The sky turns around the celestial pole, as high above the horizon as the latitude:
  // counter-clockwise around Polaris in the north, clockwise around an empty point in the south.
  drawStars(t, k, dk, hour, hy, lat) {
    const c = this.ctx, w = this.w;
    const north = lat >= 0;
    const px = w * 0.5, py = hy - (Math.abs(lat) / 90) * hy * 0.95;
    // 15° per hour like the real sky, plus a slow drift so the night feels alive.
    const rot = (north ? -1 : 1) * (hour * Math.PI * 2 / 24 + t * Math.PI * 2 / 480);
    const spr = dk > 0.5 ? STAR_LIGHT : STAR_DARK;
    for (const s of this.stars) {
      const a = s.a0 + rot;
      const x = px + Math.cos(a) * s.r, y = py + Math.sin(a) * s.r;
      if (y >= hy || x < -6 || x > w + 6 || y < -6) continue;
      let al = s.al * k * smooth(0, hy * 0.18, hy - y);
      if (s.tw) al *= 0.65 + 0.35 * Math.sin(t * s.sp + s.ph);
      if (al < 0.01) continue;
      const d = s.s * 3.2;
      c.globalAlpha = al;
      c.drawImage(spr, x - d / 2, y - d / 2, d, d);
    }
    if (north && py < hy) {
      const d = 1.6 * 3.2 * this.starScale;
      c.globalAlpha = 0.9 * k * smooth(0, hy * 0.18, hy - py);
      c.drawImage(spr, px - d / 2, py - d / 2, d, d);
    }
    c.globalAlpha = 1;
  }
}

/* ---------- the page ---------- */
let painter = null, raf = 0, lastDraw = -1e9, dirty = true, animating = false;
const $ = id => document.getElementById(id);

function resize() {
  painter.resize(innerWidth, innerHeight, Math.min(1.5, devicePixelRatio || 1)); // soft gradients: 1.5x is plenty
  dirty = true;
}
const markDirty = () => { dirty = true; };

function horizonY() {
  const r = $('search').getBoundingClientRect();
  return clamp(r.height ? r.top + r.height / 2 : innerHeight * 0.58, innerHeight * 0.25, innerHeight * 0.92);
}

// Stars animate (~24 fps); by day the sun moves so slowly that a redraw every 30 s is enough.
function loop(ts) {
  raf = requestAnimationFrame(loop);
  if (document.hidden) return;
  if (!dirty && ts - lastDraw < (animating ? 1000 / 24 : 30000)) return;
  lastDraw = ts;
  dirty = false;
  if (painter.w !== innerWidth || painter.h !== innerHeight) resize(); // e.g. opened in a hidden window
  const r = painter.draw({ t: reduceMotion ? 0 : ts / 1000, hy: horizonY() });
  if (!r) return;
  animating = r.st.stars > 0.01 && !reduceMotion;
  shadeClock(r);
}

// The clock: a faint shadow away from the sun, a warm edge near the horizon, a cool glow at night.
function shadeClock({ e, dk, st, sx, sy }) {
  const clock = $('clock');
  const cr = clock.getBoundingClientRect();
  let dx = cr.left + cr.width / 2 - sx, dy = cr.top + cr.height / 2 - sy;
  const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
  const sh = [];
  if (e > 0) {
    const k = smooth(0, 0.25, e) * (1 - e * 0.5);
    const off = lerp(0.025, 0.02, dk);
    sh.push(`${(dx * off).toFixed(3)}em ${(dy * off).toFixed(3)}em .08em ${rgba(mix([70, 45, 20], [0, 0, 0], dk), lerp(0.16, 0.55, dk) * k)}`);
  }
  const warm = Math.max(st.dawn, st.sunUp * (1 - smooth(0, 0.35, e)));
  if (warm > 0.03) sh.push(`${(-dx * 0.01).toFixed(3)}em ${(-dy * 0.01).toFixed(3)}em .35em ${rgba(glowColor(e, dk), lerp(0.45, 0.35, dk) * warm)}`);
  if (st.stars > 0.05 && dk > 0.3) sh.push(`0 0 .4em rgba(170,190,255,${(0.24 * st.stars * dk).toFixed(3)})`);
  clock.style.textShadow = sh.join(',');
}

export default {
  id: 'sky',
  name: 'themeSky',
  defaults: {},

  preview(el) {
    let cv = el.querySelector('canvas');
    if (!cv) el.append(cv = h('canvas'));
    const w = el.clientWidth || 320, hh = el.clientHeight || 72;
    const p = new SkyPainter(cv);
    p.resize(w, hh, Math.min(2, devicePixelRatio || 1));
    p.draw({ t: 0, hy: hh * 0.68, base: true });
  },

  controls(el) {
    el.append(h('p', { class: 'note' }, t('skyThemeNote')));
  },

  activate(stage) {
    const cv = h('canvas', { id: 'sky', 'aria-hidden': 'true' });
    stage.append(cv);
    painter = new SkyPainter(cv);
    resize();
    addEventListener('resize', resize);
    systemDark.addEventListener('change', markDirty);
    raf = requestAnimationFrame(loop);
  },

  update: markDirty,

  deactivate() {
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    systemDark.removeEventListener('change', markDirty);
    painter = null;
    $('clock').style.textShadow = '';
  },
};
