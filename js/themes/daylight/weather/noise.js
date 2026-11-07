// The clouds' tiling noise: four channels in one 128×128 texture. Baking it takes 10–14 ms on an M1, too much
// for every new tab, so it is baked once by scripts/noise.mjs into noise-data.js and the page only decodes that.
// This file is the recipe; change it, then run the script again (a test checks the two agree).
//
// Channels: r, g smooth fbm · b ridged · a heaps (inverted cells).
export const NOISE_SIZE = 128;

function perlinGrid(period, seed) {
  let s = seed;
  const rnd = () => { s = Math.imul(s, 1664525) + 1013904223 | 0; return (s >>> 0) / 4294967296; };
  const g = new Float32Array(period * period * 2);
  for (let i = 0; i < g.length; i += 2) { const a = rnd() * Math.PI * 2; g[i] = Math.cos(a); g[i + 1] = Math.sin(a); }
  return (u, v) => {
    const x = u * period, y = v * period, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const at = (a, b, dx, dy) => { const k = ((b % period) * period + a % period) * 2; return g[k] * dx + g[k + 1] * dy; };
    const su = fx * fx * fx * (fx * (fx * 6 - 15) + 10), sv = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = at(ix, iy, fx, fy), b = at(ix + 1, iy, fx - 1, fy), c = at(ix, iy + 1, fx, fy - 1), d = at(ix + 1, iy + 1, fx - 1, fy - 1);
    return (a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv) * 1.41;
  };
}
function cellGrid(period, seed) {
  let s = seed;
  const rnd = () => { s = Math.imul(s, 1664525) + 1013904223 | 0; return (s >>> 0) / 4294967296; };
  const pts = new Float32Array(period * period * 2).map(rnd);
  return (u, v) => {
    const x = u * period, y = v * period, ix = Math.floor(x), iy = Math.floor(y);
    let sum = 0;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const cx = ix + a, cy = iy + b;
      const k = ((((cy % period) + period) % period) * period + (((cx % period) + period) % period)) * 2;
      const dx = cx + pts[k] - x, dy = cy + pts[k + 1] - y;
      sum += Math.exp(-11 * Math.sqrt(dx * dx + dy * dy));
    }
    return Math.max(0, Math.min(1, .1 - Math.log(sum) / 11));
  };
}
export function bakeNoise(size) {
  const data = new Uint8Array(size * size * 4);
  const r = [perlinGrid(6, 11), perlinGrid(12, 23), perlinGrid(24, 37)];
  const g = [perlinGrid(6, 51), perlinGrid(12, 67), perlinGrid(24, 79)];
  const ridge = [perlinGrid(8, 91), perlinGrid(16, 107)];
  const heaps = [cellGrid(7, 131), cellGrid(14, 149), cellGrid(28, 163)];
  const byte = v => Math.max(0, Math.min(255, Math.round(v * 255)));
  for (let j = 0, k = 0; j < size; j++) for (let i = 0; i < size; i++, k += 4) {
    const u = i / size, v = j / size;
    data[k] = byte(.5 + 1.1 * (r[0](u, v) * .6 + r[1](u, v) * .28 + r[2](u, v) * .12));
    data[k + 1] = byte(.5 + 1.1 * (g[0](u, v) * .6 + g[1](u, v) * .28 + g[2](u, v) * .12));
    data[k + 2] = byte(1 - Math.abs(ridge[0](u, v)) * 1.5 - Math.abs(ridge[1](u, v)) * .55);
    data[k + 3] = byte((1 - heaps[0](u, v)) * .58 + (1 - heaps[1](u, v)) * .3 + (1 - heaps[2](u, v)) * .12);
  }
  return data;
}
