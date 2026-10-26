// xBR doubling of small icons (js/upscale.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { xbr2x } from '../js/upscale.js';

const image = (w, h, px) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(px(x, y), (y * w + x) * 4);
  return { width: w, height: h, data };
};
const at = (img, x, y) => [...img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

test('doubles the size and keeps flat colours flat', () => {
  const out = xbr2x(image(4, 3, () => [200, 40, 40, 255]));
  assert.equal(out.width, 8);
  assert.equal(out.height, 6);
  for (let i = 0; i < out.data.length; i += 4) assert.deepEqual([...out.data.slice(i, i + 4)], [200, 40, 40, 255]);
});

test('smooths a diagonal edge instead of making 2-pixel steps', () => {
  const out = xbr2x(image(8, 8, (x, y) => (x > y ? [0, 0, 0, 255] : [255, 255, 255, 255])));
  // Plain pixel doubling would leave only pure black and white; xBR blends the sub-pixels along the edge.
  const mixed = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = at(out, x, y)[0]; if (v > 20 && v < 235) mixed.push([x, y]); }
  assert.ok(mixed.length >= 8, 'the edge has in-between tones');
  assert.ok(mixed.every(([x, y]) => Math.abs(x - y) <= 2), 'and only along the diagonal');
});

test('transparent pixels next to a colour keep it, without a dark fringe', () => {
  const out = xbr2x(image(6, 6, (x, y) => (x + y < 6 ? [255, 120, 0, 255] : [0, 0, 0, 0])));
  for (let i = 0; i < out.data.length; i += 4) {
    const [r, g, b, a] = out.data.slice(i, i + 4);
    if (a > 0) assert.ok(r > 200 && g > 90 && b < 30, `edge pixel stays orange: ${[r, g, b, a]}`);
  }
});
