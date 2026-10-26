// 2xBR: doubles a small icon by following its edges instead of blurring them (after Hyllian's xBR, level 2).
// Used for Chrome's cached favicons, which are usually 16 or 32 px and look soft when a tile stretches them.
// Works on RGBA ImageData-like objects ({ width, height, data }); colours are compared and mixed premultiplied,
// so transparent edges don't pick up dark fringes.

// Perceptual distance in YUV, plus alpha.
function dist(d, a, b) {
  if (a === b) return 0;
  const aa = d[a + 3] / 255, ab = d[b + 3] / 255;
  const r = d[a] * aa - d[b] * ab, g = d[a + 1] * aa - d[b + 1] * ab, bl = d[a + 2] * aa - d[b + 2] * ab;
  const y = Math.abs(.299 * r + .587 * g + .114 * bl);
  const u = Math.abs(-.169 * r - .331 * g + .5 * bl);
  const v = Math.abs(.5 * r - .419 * g - .081 * bl);
  return 48 * y + 7 * u + 6 * v + 40 * Math.abs(d[a + 3] - d[b + 3]);
}
const SAME = 600; // below this two pixels count as the same colour

// The four rotations of the neighbourhood: local (x, y) → offset in the source. y grows downwards.
const ROT = [
  (x, y) => [x, y],
  (x, y) => [-y, x],
  (x, y) => [-x, -y],
  (x, y) => [y, -x],
];

export function xbr2x(src) {
  const { width: w, height: h, data: s } = src;
  const W = w * 2, H = h * 2, out = new Uint8ClampedArray(W * H * 4);
  // Output pixels as premultiplied floats: [r, g, b, a] per sub-pixel, mixed in place.
  const acc = new Float32Array(W * H * 4);
  const at = (x, y) => (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4;
  const put = (ox, oy, p, k) => {
    const o = (oy * W + ox) * 4, a = s[p + 3] / 255;
    acc[o] += (s[p] * a - acc[o]) * k; acc[o + 1] += (s[p + 1] * a - acc[o + 1]) * k;
    acc[o + 2] += (s[p + 2] * a - acc[o + 2]) * k; acc[o + 3] += (s[p + 3] - acc[o + 3]) * k;
  };

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const e = at(x, y), ea = s[e + 3] / 255;
    for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
      const o = ((y * 2 + sy) * W + x * 2 + sx) * 4;
      acc[o] = s[e] * ea; acc[o + 1] = s[e + 1] * ea; acc[o + 2] = s[e + 2] * ea; acc[o + 3] = s[e + 3];
    }
    for (const rot of ROT) {
      const n = (dx, dy) => { const [rx, ry] = rot(dx, dy); return at(x + rx, y + ry); };
      // Sub-pixel of the 2×2 block for a local corner (cx, cy in {0, 1}).
      const sub = (cx, cy) => {
        const [rx, ry] = rot(cx * 2 - 1, cy * 2 - 1);
        return [x * 2 + (rx + 1) / 2, y * 2 + (ry + 1) / 2];
      };
      const B = n(0, -1), C = n(1, -1), D = n(-1, 0), F = n(1, 0), G = n(-1, 1), H = n(0, 1), I = n(1, 1);
      const F4 = n(2, 0), I4 = n(2, 1), H5 = n(0, 2), I5 = n(1, 2);
      const df = (a, b) => dist(s, a, b);
      if (df(e, F) < SAME || df(e, H) < SAME) continue;
      // An edge runs between E and I (bottom-right) when E's side is more uniform than across it.
      const wE = df(e, C) + df(e, G) + df(I, F4) + df(I, H5) + 4 * df(H, F);
      const wI = df(H, D) + df(H, I5) + df(F, I4) + df(F, B) + 4 * df(e, I);
      if (wE >= wI) continue;
      const P = df(e, F) <= df(e, H) ? F : H; // the colour on the other side of the edge
      const ke = df(F, G), ki = df(H, C);
      const shallow = 2 * ke <= ki && e !== G && df(D, G) >= SAME;
      const steep = ke >= 2 * ki && e !== C && df(B, C) >= SAME;
      const [x3, y3] = sub(1, 1), [x1, y1] = sub(1, 0), [x2, y2] = sub(0, 1);
      if (shallow && steep) { put(x3, y3, P, .75); put(x1, y1, P, .25); put(x2, y2, P, .25); }
      else if (shallow) { put(x3, y3, P, .75); put(x2, y2, P, .25); }
      else if (steep) { put(x3, y3, P, .75); put(x1, y1, P, .25); }
      else put(x3, y3, P, .5);
    }
  }

  for (let i = 0; i < W * H; i++) {
    const a = acc[i * 4 + 3], k = a > 0 ? 255 / a : 0;
    out[i * 4] = acc[i * 4] * k; out[i * 4 + 1] = acc[i * 4 + 1] * k; out[i * 4 + 2] = acc[i * 4 + 2] * k; out[i * 4 + 3] = a;
  }
  return { width: W, height: H, data: out };
}
