// The page's ink over the Breathing sky: light or dark text, how much help it needs, and the halo behind it,
// all decided by what is actually drawn behind each piece of text. A clear sunset is as hard a ground as any
// overcast (bright under one widget, dusky under another), so this runs with or without weather; whoever draws
// the sky hands over its pixels.
import { clamp } from './astronomy.js';
import { apcaY, pickInk, haloFor } from './weather/ink.js';
import { luminance } from './weather/conditions.js';

const root = document.documentElement;

// The text that sits right on the sky. need: the APCA contrast it reads well at (large digits need less);
// weight: how much it matters when the inks are compared. Widgets on cards are not on the sky.
const TEXT = [
  ['.clock', 45, .6], ['#date', 60, 1], ['.frame .cap', 55, .7], ['.tile-label', 60, .8],
  ['html:not(.todo-card) .weather', 60, 1], ['html:not(.todo-card) .todos-card', 60, 1],
];
function textPlaces() {
  const out = [];
  for (const [sel, need, weight] of TEXT) for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width && r.height && r.bottom > 0 && r.top < innerHeight) out.push({ x: r.left, y: r.top, w: r.width, h: r.height, need, weight });
  }
  return out;
}

export class PageInk {
  constructor() {
    this.dark = null; // true: the dark theme, so light text; null until the first read
    this.halo = '';
    this.scene = null; // how light the sky behind the text is, 0…1
    this.placesDue = 0;
    // Once the first frame is up, the ink may take a moment to change.
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!this.gone) root.classList.add('sky-ink'); }));
  }

  // The page has moved: the window was resized, a widget turned on.
  remeasure() { this.placesDue = 0; }

  // pixels: the whole window's sky as RGBA bytes, w × h, top row first. byDay: the ink the sun alone would
  // choose (true: light text), which settles a tie.
  read(pixels, w, h, byDay) {
    const zones = this.zones(pixels, w, h);
    if (!zones.length) { this.set(byDay, 0, null); return; }
    const { lightText, hard, tone } = pickInk(zones, this.dark, byDay);
    this.scene = luminance(tone);
    this.set(lightText, hard, tone);
  }
  // hard: how much help the ink needs; in-between skies get stronger colours and a firmer halo.
  // tone: the sky behind the text, which the halo is made of.
  set(dark, hard, tone) {
    if (dark !== this.dark) { this.dark = dark; root.dataset.theme = dark ? 'dark' : 'light'; }
    root.classList.toggle('mid-sky', hard > .12);
    const halo = haloFor(dark, tone || [.5, .5, .5], hard, tone ? 1 : 0);
    if (halo !== this.halo) { this.halo = halo; root.style.setProperty('--halo', halo); }
  }
  // The text on the sky, and what is behind each piece of it. The places are measured now and then: the page
  // moves only when the window does, a bookmark is added or a widget turns on.
  zones(pixels, w, h) {
    const now = performance.now();
    if (!this.places || now >= this.placesDue) { this.placesDue = now + 2000; this.places = textPlaces(); }
    const sx = w / innerWidth, sy = h / innerHeight, zones = [];
    for (const p of this.places) {
      const x0 = clamp(Math.floor(p.x * sx), 0, w - 1), x1 = clamp(Math.ceil((p.x + p.w) * sx), x0 + 1, w);
      const y0 = clamp(Math.floor(p.y * sy), 0, h - 1), y1 = clamp(Math.ceil((p.y + p.h) * sy), y0 + 1, h);
      const ys = [], rgb = [0, 0, 0];
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4, c = [pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255];
        ys.push(apcaY(c));
        rgb[0] += c[0]; rgb[1] += c[1]; rgb[2] += c[2];
      }
      zones.push({ ys: Float64Array.from(ys).sort(), rgb: rgb.map(v => v / ys.length), need: p.need, weight: p.weight });
    }
    return zones;
  }

  // Everything this added to the page goes.
  destroy() {
    this.gone = true;
    root.classList.remove('sky-ink', 'mid-sky');
    root.style.removeProperty('--halo');
  }
}
