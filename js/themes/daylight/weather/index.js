// Weather over the Breathing sky: the theme paints its sky exactly as before, and this puts clouds and what falls
// on top of it. It keeps the dials moving towards the current weather and tells the page which ink reads best.
import { clamp, smooth } from '../astronomy.js';
import { DIALS, cloudLight, luminance } from './conditions.js';
import { Clouds } from './clouds.js';
import { Precipitation } from './precipitation.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
const MORPH = 1.25; // seconds: how slowly one sky turns into another
const NIGHT_SNOW = [.62, .7, .86];

export class SkyWeather {
  constructor(cloudCanvas, fallingCanvas, atmosphere) {
    this.clouds = new Clouds(cloudCanvas, atmosphere);
    this.falling = new Precipitation(fallingCanvas);
    if (!this.clouds.ok) console.warn('[tabula] WebGL2 is unavailable: rain and snow still fall, clouds do not.');
    this.dials = Object.fromEntries(DIALS.map(k => [k, 0]));
    this.goal = { ...this.dials };
    this.landing = true; // things may land on the page
    this.boxes = new WeakMap();
    // Picked up from the wall clock, so every new tab opens on the same slowly passing sky rather than the same picture.
    const seconds = Date.now() / 1000;
    this.time = seconds % 4096;
    this.driftX = -(seconds * .018 % 4096);
    this.driftY = -(seconds * .003 % 4096);
    this.visible = 0;
    this.last = performance.now();
    this.flashAt = Infinity; this.flashStart = -1; this.flashX = .5; this.flashY = .3;
    this.gpuDue = 0; this.inkDue = 0; this.surfacesDue = 0;
    this.glClear = false; this.wasBusy = false;
    this.inkDark = null; this.halo = '';
    // Once the first frame is up, the ink may take a moment to change.
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!this.gone) root.classList.add('sky-weather'); }));
  }

  get lost() { return this.clouds.lost; }

  // instant: start already there, for a page that has just opened.
  setGoal(goal, instant = false) {
    this.goal = goal;
    if (instant) Object.assign(this.dials, goal);
    if (!(goal.bolts > 0) || reduced.matches) this.flashAt = Infinity;
    else if (this.flashAt === Infinity) this.flashAt = this.visible + 1.6 + Math.random() * 2;
  }

  // The theme has painted its sky.
  observe(sun, state) {
    this.sun = sun;
    this.horizon = state.horizon;
    this.direction = state.place.lat < 0 ? -1 : 1;
    this.clouds.syncSky();
  }

  // How often it needs a frame. 'full': something is falling or changing. 'soft': only slow clouds. 'still': the theme's one frame a second will do.
  get pace() {
    if (reduced.matches) return 'still';
    const d = this.dials;
    if (this.falls || this.flashAt !== Infinity || this.flashStart >= 0 || !this.settled) return 'full';
    return d.cover + d.veil + d.fog + d.blow > .004 ? 'soft' : 'still';
  }
  get falls() { return this.dials.rain > .004 || this.dials.snow > .004 || this.falling.busy; }
  get settled() { return DIALS.every(k => Math.abs(this.goal[k] - this.dials[k]) < .002); }

  // After the tab was away: time did not pass for what is on screen.
  wake() { this.last = performance.now(); }

  resize() {
    this.clouds.resize();
    this.falling.resize();
    this.gpuDue = 0;
    this.surfacesDue = 0;
  }

  step(now) {
    if (!this.sun) return;
    const elapsed = clamp((now - this.last) / 1000, 0, 2), dt = Math.min(.05, elapsed), still = reduced.matches;
    this.last = now;
    this.visible += elapsed;
    if (!still) this.time += elapsed;

    const d = this.dials, ease = still ? 1 : 1 - Math.exp(-elapsed / MORPH);
    for (const k of DIALS) d[k] += (this.goal[k] - d[k]) * ease;

    const e = this.sun.altitude, light = cloudLight(e, d.weight);
    const flash = this.lightning(still, d);
    this.drawClouds(now, elapsed, still, light, flash);
    if (now >= this.inkDue) { this.inkDue = now + 250; this.chooseInk(e, light); }
    this.drawFalling(now, still ? 0 : dt, e, light);
  }

  /* ---------- lightning ---------- */
  flash() { this.flashAt = this.visible; }
  lightning(still, d) {
    if (this.visible >= this.flashAt) {
      this.flashStart = this.visible;
      this.flashX = .12 + Math.random() * .76;
      this.flashY = .16 + Math.random() * .3;
      if (Math.random() < .55) {
        const { w, h } = this.falling;
        this.falling.strike((Math.random() < .5 ? .08 + Math.random() * .22 : .7 + Math.random() * .22) * w, h * (.24 + Math.random() * .1), h * this.horizon);
      }
      this.flashAt = this.goal.bolts > 0 ? this.visible + 7 + Math.random() * 13 : Infinity;
    }
    if (still || this.flashStart < 0) return 0;
    const t = this.visible - this.flashStart;
    if (t > 1.4) { this.flashStart = -1; return 0; }
    // A flicker and a slow fade: nothing that strobes.
    const pulse = (at, peak, fade) => (t < at ? 0 : peak * Math.exp(-(t - at) / fade));
    return Math.min(1, pulse(0, .55, .09) + pulse(.11, .95, .17) + pulse(.34, .4, .36)) * clamp(d.bolts * 1.4);
  }

  /* ---------- clouds ---------- */
  // Where the light comes from: the same formula as the theme's sun. Once it is well below the horizon the clouds
  // are lit from the opposite side of the sky, like a moon; the theme draws no moon, so only the clouds show it.
  lightFrom(sun) {
    const hy = this.horizon, room = Math.max(.32, sun.maxUp);
    if (sun.altitude > -5) return { x: .5 + this.direction * .38 * Math.sin(sun.hourAngle), y: hy - sun.up / room * (hy - .11) };
    return { x: .5 - this.direction * .38 * Math.sin(sun.hourAngle), y: hy - clamp(-sun.up / room, .1, 1) * (hy - .11) };
  }
  drawClouds(now, elapsed, still, light, flash) {
    const d = this.dials;
    if (!still) {
      this.driftX -= elapsed * (.006 + d.wind * .05);
      this.driftY -= elapsed * (.0016 + d.wind * .006);
    }
    const anything = d.cover + d.veil + d.fog + d.cirrus + d.blow > .004 || flash > 0;
    if (!this.clouds.ok || (!anything && this.glClear) || (now < this.gpuDue && flash <= 0)) return;
    // Soft shapes drift slowly: a dozen and a half frames a second are plenty for them alone.
    this.gpuDue = now + (this.pace === 'full' ? 30 : 48);
    const sun = this.sun, e = sun.altitude, at = this.lightFrom(sun);
    this.clouds.render({
      ...d, time: this.time, light, flash, flashX: this.flashX, flashY: this.flashY,
      horizon: this.horizon, sunX: at.x, sunY: at.y,
      sunVis: Math.max(smooth(-5, 1.5, e), (1 - smooth(-14, -5, e)) * .5), day: smooth(-7, 8, e),
      driftX: this.driftX, driftY: this.driftY,
    });
    this.glClear = !anything;
  }

  /* ---------- the page's ink ---------- */
  // Under a clear sky the rule is the theme's (sun at 5° or lower means light text); under clouds, what is actually there decides.
  chooseInk(e, light) {
    const d = this.dials;
    if (!this.clouds.ok) { this.setInk(e <= 5, 0); this.scene = e <= 5 ? .2 : .8; return; }
    const under = this.clouds.sample(.5, .24);
    const cloudTone = light.shade.map((v, i) => v + (light.lit[i] - v) * .58);
    const cloudAmount = Math.max(d.veil * .86, d.cover * .85, d.fog * .55);
    const scene = luminance(under) * (1 - cloudAmount) + luminance(cloudTone) * cloudAmount;
    this.scene = scene;
    // Near sunset the theme already leans to light text, so a mid-toned sky keeps it there.
    const line = (e <= 6 ? .62 : .5) + (this.inkDark ? .03 : -.03);
    this.setInk(cloudAmount < .22 ? e <= 5 : scene < line, 1 - clamp(Math.abs(scene - .52) / .24));
  }
  // hard: in-between skies are the hard ones for small text, so there it gets stronger colours and a firmer halo.
  setInk(dark, hard) {
    if (dark !== this.inkDark) { this.inkDark = dark; root.dataset.theme = dark ? 'dark' : 'light'; }
    root.classList.toggle('mid-sky', hard > .12);
    const halo = dark
      ? `0 1px 12px rgb(8 12 28 / ${(.45 + hard * .4).toFixed(2)}), 0 0 2px rgb(8 12 28 / ${(hard * .35).toFixed(2)})`
      : `0 1px 10px rgb(255 255 255 / ${(.45 + hard * .4).toFixed(2)}), 0 0 2px rgb(255 255 255 / ${(hard * .4).toFixed(2)})`;
    if (halo !== this.halo) { this.halo = halo; root.style.setProperty('--halo', halo); }
  }

  /* ---------- what falls, and what it lands on ---------- */
  drawFalling(now, dt, e, light) {
    const d = this.dials, busy = this.falls;
    if (busy || this.wasBusy) {
      if (busy && now >= this.surfacesDue) { this.surfacesDue = now + 1000; this.measure(); }
      const day = smooth(-9, 6, e), dusk = Math.exp(-(((e - 2) / 8) ** 2));
      const ambient = NIGHT_SNOW.map((v, i) => (v + (1 - v) * day) * (1 - dusk * .22) + light.lit[i] * dusk * .22);
      this.falling.step(dt, {
        rain: d.rain, fine: d.fine, snow: d.snow, wind: d.wind, ambient,
        inkDark: 1 - smooth(.3, .66, this.scene ?? .5),
        landing: this.landing,
      });
    }
    this.wasBusy = busy;
  }
  // The search bar and the bookmark icons, wherever they are now: bookmarks come and go and the page can scroll.
  measure() {
    if (!this.landing) { this.falling.setSurfaces([]); return; }
    const list = [];
    const add = (el, max) => {
      if (!el) return;
      // A hovered icon has only lifted for a moment: what lies on it stays where it was.
      const lifted = el.closest('.tile')?.matches(':hover, :focus-visible') && this.boxes.get(el);
      const r = lifted || el.getBoundingClientRect();
      this.boxes.set(el, r);
      if (!r.width || !r.height) return;
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      list.push({ x: r.left, y: r.top, w: r.width, h: r.height, r: Math.min(radius, r.height / 2), max });
    };
    add(document.getElementById('search'), 10);
    document.querySelectorAll('#bookmarks .tile:not(.add) .tile-icon').forEach(el => add(el, 7));
    this.falling.setSurfaces(list);
  }

  // Everything this added to the page goes; the canvases are the theme's to remove.
  destroy() {
    this.gone = true;
    this.clouds.destroy();
    root.classList.remove('sky-weather', 'mid-sky');
    root.style.removeProperty('--halo');
  }
}
