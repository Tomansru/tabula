// Weather over the Breathing sky: the theme paints its sky exactly as before, and this puts clouds and what falls
// on top of it. It keeps the dials moving towards the current weather and shows the page's ink the sky it made.
import { clamp, smooth } from '../astronomy.js';
import { DIALS, cloudLight } from './conditions.js';
import { Clouds } from './clouds.js';
import { Precipitation } from './precipitation.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const MORPH = 1.25; // seconds: how slowly one sky turns into another
// How often it steps at each pace, in ms: 60 a second while something falls, 20 for clouds alone. 60 are smooth
// enough for rain and snow, and a 120 Hz screen would only double the work; slow clouds need no more than 20.
// Under rain the clouds are redrawn on every other step. All a little under the round figure, as display frames
// come a hair early or late.
const SLACK = 3;
const EVERY = { full: 1000 / 60 - SLACK, soft: 1000 / 20 - SLACK };
const CLOUDS_EVERY = 1000 / 30 - SLACK;
const NIGHT_SNOW = [.62, .7, .86];
// From what depth (0 far … 1 near) drops and flakes land on a surface rather than fall past it. Under the search bar
// the icons share the near drops with it; on their own they catch about twice as much rain and snow.
const LAND = {
  search: { drops: .8, flakes: .62 },
  icons: { drops: .8, flakes: .62 },
  iconsAlone: { drops: .52, flakes: .42 },
};

export class SkyWeather {
  // ink: the theme's PageInk.
  constructor(cloudCanvas, fallingCanvas, atmosphere, ink) {
    this.ink = ink;
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
    this.stepped = 0;
    this.flashAt = Infinity; this.flashStart = -1; this.flashX = .5; this.flashY = .3;
    this.gpuDue = 0; this.inkDue = 0; this.surfacesDue = 0;
    this.glClear = false; this.wasBusy = false;
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

  // On a display frame: a step, if this pace's time for one has come.
  beat(now) {
    if (now - this.stepped < EVERY[this.pace]) return;
    this.stepped = now;
    this.step(now);
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
    if (now >= this.inkDue) { this.inkDue = now + 400; this.showInk(e); }
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
    this.gpuDue = now + (this.pace === 'full' ? CLOUDS_EVERY : 0);
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
  // The sky as it is drawn, clouds and all, goes to the page's ink a few times a second.
  showInk(e) {
    if (this.flashStart >= 0) return; // lightning is not a reason to change the ink
    const pixels = this.clouds.peek(); // null: still on its way from the GPU, the next call has it
    if (!pixels) return;
    const { width, height } = this.clouds.small;
    this.ink.read(pixels, width, height, e <= 5);
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
        inkDark: 1 - smooth(.3, .66, this.ink.scene ?? .5),
        landing: this.landing,
      });
    }
    this.wasBusy = busy;
  }
  // The search bar and the bookmark icons, wherever they are now: bookmarks come and go and the page can scroll.
  // A hidden search bar keeps its place in the layout, so whether it is shown is asked of the element, not its box.
  // Without it the icons are the only ledge, and they catch the nearer half of the drops and flakes, not the nearest few.
  measure() {
    if (!this.landing) { this.falling.setSurfaces([]); return; }
    const list = [];
    const shown = el => el.checkVisibility?.({ visibilityProperty: true, opacityProperty: true }) ?? getComputedStyle(el).visibility !== 'hidden';
    const add = (el, max, depth) => {
      if (!el || !shown(el)) return false;
      // A hovered icon has only lifted for a moment: what lies on it stays where it was.
      const lifted = el.closest('.tile')?.matches(':hover, :focus-visible') && this.boxes.get(el);
      const r = lifted || el.getBoundingClientRect();
      this.boxes.set(el, r);
      if (!r.width || !r.height) return false;
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      list.push({ key: el, x: r.left, y: r.top, w: r.width, h: r.height, r: Math.min(radius, r.height / 2), max, ...depth });
      return true;
    };
    const search = add(document.getElementById('search'), 10, LAND.search);
    const icons = search ? LAND.icons : LAND.iconsAlone;
    document.querySelectorAll('#bookmarks .tile:not(.add) .tile-icon').forEach(el => add(el, 7, icons));
    this.falling.setSurfaces(list);
  }

  // The canvases are the theme's to remove.
  destroy() {
    this.clouds.destroy();
  }
}
