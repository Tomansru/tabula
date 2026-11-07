// The weather's crisp half: what actually falls. Drops and flakes live at three depths, and the nearest ones
// land on the page itself: rain splashes on the search bar, snow slowly settles on it and on the bookmark icons.

const TAU = Math.PI * 2;
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const MAX_DROPS = 760, MAX_FLAKES = 820, DROPS_LAND_FROM = .8, FLAKES_LAND_FROM = .62;

function flakeSprite(col) {
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const x = c.getContext('2d'), g = x.createRadialGradient(24, 24, 0, 24, 24, 24);
  g.addColorStop(0, `rgba(${col},1)`); g.addColorStop(.42, `rgba(${col},.78)`);
  g.addColorStop(.72, `rgba(${col},.2)`); g.addColorStop(1, `rgba(${col},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 48, 48);
  return c;
}

export class Precipitation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.drops = []; this.flakes = []; this.splashes = []; this.surfaces = [];
    this.bolt = null;
    this.spriteKey = '';
    this.time = 0;
    this.resize();
    for (let i = 0; i < MAX_DROPS; i++) { const z = rnd() ** 1.5; this.drops.push({ x: rnd(this.w), y: rnd(this.h), z, s: rnd(.86, 1.14) }); }
    for (let i = 0; i < MAX_FLAKES; i++) { const z = rnd() ** 1.7; this.flakes.push({ x: rnd(this.w), y: rnd(this.h), z, s: rnd(.72, 1.25), ph: rnd(TAU), f: rnd(.35, 1.05), a: rnd(.7, 1) }); }
  }
  resize() {
    this.w = innerWidth; this.h = innerHeight;
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.lineCap = 'round';
  }

  // Page elements things can land on: { x, y, w, h, r, max } from their boxes. Keeps what already lies on the same one.
  setSurfaces(list) {
    const old = this.surfaces;
    this.surfaces = list.map((b, i) => {
      const prev = old[i];
      const n = Math.max(6, Math.round(b.w / 3));
      const keep = prev && prev.n === n;
      return {
        ...b, n,
        fill: prev ? prev.fill : 0,
        bumps: keep ? prev.bumps : new Float32Array(n),
        // A slow irregular outline, fixed per surface, so a drift is never a clean strip.
        shape: keep ? prev.shape : Float32Array.from({ length: n }, (_, k) => {
          const u = k / n;
          return .72 + .16 * Math.sin(u * 7.3 + i * 2.1) + .09 * Math.sin(u * 17.1 + i * 4.7) + .05 * Math.sin(u * 41 + i);
        }),
      };
    });
  }

  // Where a surface's top edge is at x, following its rounded corners.
  edge(s, x) {
    const dl = x - (s.x + s.r), dr = x - (s.x + s.w - s.r);
    const off = dl < 0 ? dl : dr > 0 ? dr : 0;
    if (!off) return s.y;
    return s.y + s.r - Math.sqrt(Math.max(0, s.r * s.r - off * off));
  }

  strike(x, y0, y1) {
    const pts = [[x, y0]];
    let cx = x, cy = y0;
    const steps = 9;
    for (let i = 1; i <= steps; i++) {
      cy = y0 + (y1 - y0) * (i / steps);
      cx += rnd(-1, 1) * (y1 - y0) * .055;
      pts.push([cx, cy]);
    }
    this.bolt = { pts, t: 0 };
  }

  // p: { rain, fine, snow, wind, inkDark (0 pale sky … 1 dark sky), ambient [r,g,b] 0…1, landing }
  step(dt, p) {
    this.time += dt;
    const c = this.ctx, w = this.w, h = this.h;
    c.clearRect(0, 0, w, h);
    const gust = p.wind * (.82 + .3 * Math.sin(this.time * .23) * Math.sin(this.time * .071 + 1.3));
    if (p.rain > .004) this.rain(c, dt, p, gust);
    if (p.snow > .004) this.snow(c, dt, p, gust);
    this.settle(dt, p);
    if (p.landing) this.drawDrifts(c, p);
    this.drawSplashes(c, dt, p);
    this.drawBolt(c, dt);
  }
  get busy() {
    return this.splashes.length > 0 || !!this.bolt || this.surfaces.some(s => s.fill > .002);
  }

  rain(c, dt, p, gust) {
    const w = this.w, h = this.h, count = Math.floor(MAX_DROPS * p.rain);
    const slant = .04 + gust * .34;
    // Dark sky: pale drops. Pale sky: the same drops read darker than what is behind them.
    const light = [214, 228, 248], dark = [66, 84, 106];
    const col = light.map((v, i) => Math.round(dark[i] + (v - dark[i]) * smooth(.15, .6, p.inkDark)));
    const groups = [[], [], []];
    for (let i = 0; i < count; i++) {
      const d = this.drops[i];
      const v = (560 + 1040 * d.z) * d.s * (1 - p.fine * .62);
      const prevY = d.y;
      d.y += v * dt; d.x += v * slant * dt;
      const len = (20 + 58 * d.z) * d.s * (1 - p.fine * .68) * (1 + gust * .25);
      if (d.y - len > h) { d.y = rnd(-120, -10); d.x = rnd(-h * slant, w); }
      if (d.x > w + 60) d.x -= w + 120;
      if (p.landing && d.z > DROPS_LAND_FROM) this.dropHits(d, prevY, p);
      groups[d.z < .34 ? 0 : d.z < .68 ? 1 : 2].push(d.x, d.y, len);
    }
    const looks = [[.7, .1], [1, .14], [1.3, .17]];
    groups.forEach((g, k) => {
      const [width, alpha] = looks[k];
      c.lineWidth = width * (1 - p.fine * .2);
      c.strokeStyle = `rgba(${col},${alpha * (.78 + p.rain * .34) * (1 - p.fine * .22)})`;
      c.beginPath();
      for (let i = 0; i < g.length; i += 3) {
        c.moveTo(g[i], g[i + 1]);
        c.lineTo(g[i] - g[i + 2] * slant, g[i + 1] - g[i + 2]);
      }
      c.stroke();
    });
  }
  dropHits(d, prevY, p) {
    for (const s of this.surfaces) {
      if (d.x < s.x + 2 || d.x > s.x + s.w - 2) continue;
      const top = this.edge(s, d.x);
      if (prevY < top && d.y >= top) {
        if (this.splashes.length < 70) this.splashes.push({ x: d.x, y: top, t: 0, life: rnd(.2, .34), big: p.fine < .5 && d.z > .8, dir: rnd() < .5 ? -1 : 1 });
        d.y = rnd(-120, -10); d.x = rnd(-60, this.w);
        return;
      }
    }
  }
  drawSplashes(c, dt, p) {
    if (!this.splashes.length) return;
    const col = p.inkDark > .4 ? '226,236,252' : '74,94,116';
    c.lineWidth = .9;
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i];
      s.t += dt;
      const k = s.t / s.life;
      if (k >= 1) { this.splashes.splice(i, 1); continue; }
      const a = (1 - k) ** 1.4;
      const r = 2 + k * (s.big ? 9 : 6);
      c.strokeStyle = `rgba(${col},${.4 * a})`;
      // A small crown above the edge…
      c.beginPath(); c.ellipse(s.x, s.y, r, r * .24, 0, Math.PI, TAU); c.stroke();
      // …and a droplet or two thrown off on a little arc.
      const fly = s.t * 60, drop = 140 * s.t * s.t;
      c.fillStyle = `rgba(${col},${.62 * a})`;
      c.beginPath();
      c.arc(s.x + s.dir * fly * .7, s.y - fly * .85 + drop * 3, s.big ? 1.1 : .8, 0, TAU);
      if (s.big) c.arc(s.x - s.dir * fly * .5, s.y - fly * 1.05 + drop * 3.2, .8, 0, TAU);
      c.fill();
    }
  }

  snow(c, dt, p, gust) {
    const key = p.ambient.map(v => Math.round(v * 24)).join();
    if (key !== this.spriteKey) {
      this.spriteKey = key;
      this.sprite = flakeSprite(p.ambient.map(v => Math.round(v * 255)).join());
    }
    const w = this.w, h = this.h, count = Math.floor(MAX_FLAKES * p.snow), t = this.time;
    const scale = Math.min(1.25, Math.max(.8, w / 1400));
    const margin = 40 + gust * 260;
    for (let i = 0; i < count; i++) {
      const f = this.flakes[i], z = f.z;
      const prevY = f.y;
      const vy = (20 + 74 * z) * f.s * (1 + gust * .9);
      const vx = gust * (70 + 300 * z) + Math.sin(t * f.f + f.ph) * (6 + 26 * z);
      f.y += vy * dt; f.x += vx * dt;
      if (f.y > h + 24) { f.y = rnd(-40, -8); f.x = rnd(-margin, w); }
      if (f.x > w + margin) { f.x = -margin + rnd(-20, 0); f.y = rnd(-20, h * .9); }
      if (p.landing && z > FLAKES_LAND_FROM && this.flakeHits(f, prevY, p)) continue;
      // Far flakes are specks; the nearest few are big, soft and out of focus.
      const bokeh = smooth(.86, 1, z);
      const size = (1.6 + 5.2 * z + 13 * bokeh) * f.s * scale;
      c.globalAlpha = (.38 + .54 * z) * (1 - bokeh * .78) * f.a * (.65 + .35 * p.snow);
      // In a strong wind a flake is a short smear along its flight.
      const long = size * (1 + gust * (1.1 + z * 2.6)), low = size * (1 - gust * .2);
      c.drawImage(this.sprite, f.x - long / 2, f.y - low / 2, long, low);
    }
    c.globalAlpha = 1;
  }
  flakeHits(f, prevY, p) {
    for (const s of this.surfaces) {
      if (f.x < s.x + 3 || f.x > s.x + s.w - 3) continue;
      const top = this.edge(s, f.x) - s.max * s.fill * .5;
      if (prevY < top && f.y >= top) {
        const k = Math.max(0, Math.min(s.n - 1, Math.round((f.x - s.x) / s.w * (s.n - 1))));
        for (let o = -3; o <= 3; o++) {
          const q = k + o;
          if (q >= 0 && q < s.n) s.bumps[q] = Math.min(s.max * .42, s.bumps[q] + (1 - Math.abs(o) / 4) * .32);
        }
        f.y = rnd(-40, -8); f.x = rnd(-40, this.w);
        return true;
      }
    }
    return false;
  }

  // Snow builds up slowly while it falls and melts away faster once it stops; rain takes it down quickest.
  settle(dt, p) {
    const target = p.landing ? p.snow : 0;
    const rate = target > .02 ? .022 + .05 * target : -(p.rain > .02 ? .16 : .07);
    for (const s of this.surfaces) {
      s.fill = Math.max(0, Math.min(Math.max(s.fill, .12 + .88 * target), s.fill + rate * dt));
      if (rate < 0) for (let i = 0; i < s.n; i++) s.bumps[i] *= Math.exp(-dt * .5);
    }
  }
  drawDrifts(c, p) {
    const amb = p.ambient, solid = amb.map(v => Math.round(v * 255)).join(), under = amb.map(v => Math.round(v * 182)).join();
    for (const s of this.surfaces) {
      if (s.fill < .004) continue;
      const taper = s.r * .28, span = s.w - taper * 2;
      const ys = [];
      c.beginPath();
      for (let i = 0; i <= s.n; i++) {
        const u = i / s.n, x = s.x + taper + span * u;
        const ends = smooth(0, .09 * (s.w > 120 ? .55 : 2), Math.min(u, 1 - u));
        const k = Math.min(s.n - 1, i);
        const height = (s.max * s.fill * s.shape[k] + s.bumps[k] * smooth(0, .3, s.fill)) * ends;
        const y = this.edge(s, x) - height;
        ys.push([x, y]);
        if (i === 0) c.moveTo(x, y); else {
          const [px, py] = ys[i - 1];
          c.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
        }
      }
      // Back along the edge itself, a hair inside it so no gap shows.
      for (let i = s.n; i >= 0; i--) { const x = s.x + taper + span * i / s.n; c.lineTo(x, this.edge(s, x) + .8); }
      c.closePath();
      c.shadowColor = `rgba(${under},.5)`;
      c.shadowBlur = 3;
      c.shadowOffsetY = 1;
      const top = Math.min(...ys.map(q => q[1]));
      const g = c.createLinearGradient(0, top, 0, s.y + s.r * .4);
      g.addColorStop(0, `rgba(${solid},.98)`);
      g.addColorStop(1, `rgba(${under},.94)`);
      c.fillStyle = g;
      c.fill();
      c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;
    }
  }

  drawBolt(c, dt) {
    const b = this.bolt;
    if (!b) return;
    b.t += dt;
    if (b.t > .32) { this.bolt = null; return; }
    // Two quick strokes rather than one long glare.
    const a = b.t < .07 ? 1 : b.t < .12 ? .25 : b.t < .19 ? .75 : (1 - (b.t - .19) / .13) * .4;
    const path = () => { c.beginPath(); b.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); };
    c.lineJoin = 'round';
    c.strokeStyle = `rgba(190,205,255,${.13 * a})`; c.lineWidth = 7; path(); c.stroke();
    c.strokeStyle = `rgba(226,234,255,${.72 * a})`; c.lineWidth = 1.1; path(); c.stroke();
  }
}
