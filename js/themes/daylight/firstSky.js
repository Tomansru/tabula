// What a new tab shows before its scripts have run. The page's first paint comes some 50 ms ahead of the sky:
// until now that was the bare dark background, a black blink on every new tab. So the sky leaves a small
// picture of itself behind, and boot.js puts the last one up as the background of the next tab (if it is fresh:
// a sky from hours ago would blink just the same). Stretched to the window it is the same soft gradient.
import { save } from '../../store.js';

const EVERY = 5000; // ms: the clouds show their sky a few times a second, the picture need not follow that closely
let due = 0, ctx = null;

// pixels: the whole window's sky as RGBA bytes, w × h, top row first.
export function keepSky(pixels, w, h) {
  const now = performance.now();
  if (now < due) return;
  due = now + EVERY;
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  ctx.canvas.width = w; ctx.canvas.height = h;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.length), w, h), 0, 0);
  save('sky', { at: Date.now(), url: ctx.canvas.toDataURL('image/png') });
}

// The theme is leaving: the picture must not stay behind another theme.
export function dropSky() {
  document.documentElement.classList.remove('boot-sky');
  due = 0;
}
