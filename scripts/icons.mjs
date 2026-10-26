// Draws the extension icon and saves icons/icon{16,32,48,128}.png, the source docs/icon/tabula.svg and
// docs/icon/tabula-mark.svg (the same drawing cropped to the tab, for placing next to the name).
//
//   node scripts/icons.mjs [path-to-chrome]
//
// The mark is a browser tab with a sunset in it: the sky of the new tab page and the sun on the horizon.
// Each size has its own geometry snapped to whole pixels, so the 16 px icon stays crisp instead of being
// a blurred 128. The 128 px one keeps Chrome Web Store's transparent margin (the art fits about 96 px).
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './chrome.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const COLORS = {
  sky: ['#6c63d4', '#b77cc6', '#f08aa0', '#ffb070'], // top of the sky down to the horizon
  ground: ['#51449c', '#3a3283'],
  sun: '#fff4d6',
  glow: '#ffd9a0',
};

// left/right: the tab's sides; flare: the curve into the tab strip; top/base: its top and the strip line;
// round: top corners; horizon: the line the sun stands on; sun: its radius. glow and shine only where they read.
export const SIZES = {
  16: { left: 2, right: 14, flare: 2, top: 1, base: 15, round: 3, horizon: 10, sun: 4 },
  32: { left: 3, right: 29, flare: 3, top: 2, base: 30, round: 6, horizon: 21, sun: 6, glow: true },
  48: { left: 5, right: 43, flare: 4, top: 3, base: 45, round: 8, horizon: 31, sun: 9, glow: true, shine: true },
  128: { left: 22, right: 106, flare: 9, top: 17, base: 111, round: 18, horizon: 80, sun: 22, glow: true, shine: true },
};

// crop: the viewBox hugs the tab instead of the whole square, with no transparent margin.
export function iconSvg(size, { crop = false } = {}) {
  const g = SIZES[size], c = COLORS, mid = size / 2;
  const { left: l, right: r, flare: f, top: t, base: b, round: k, horizon: hz, sun } = g;
  const tab = `M${l - f} ${b} Q${l} ${b} ${l} ${b - f} V${t + k} Q${l} ${t} ${l + k} ${t} H${r - k} Q${r} ${t} ${r} ${t + k} V${b - f} Q${r} ${b} ${r + f} ${b} Z`;
  const stops = (list, ...at) => list.map((col, i) => `<stop offset="${at[i]}" stop-color="${col}"/>`).join('');
  const glow = g.glow ? `<circle cx="${mid}" cy="${hz}" r="${sun * 1.5}" fill="${c.glow}" opacity=".35"/>` : '';
  const shine = g.shine
    ? `<rect x="${mid - sun * .7}" y="${hz + sun * .3}" width="${sun * 1.4}" height="${sun * .14}" rx="${sun * .07}" fill="${c.sun}" opacity=".45"/>` +
      `<rect x="${mid - sun * .4}" y="${hz + sun * .62}" width="${sun * .8}" height="${sun * .14}" rx="${sun * .07}" fill="${c.sun}" opacity=".3"/>`
    : '';
  const [x, y, w, h] = crop ? [l - f, t, r - l + 2 * f, b - t] : [0, 0, size, size];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">
  <title>Tabula</title>
  <defs>
    <linearGradient id="sky" gradientUnits="userSpaceOnUse" x1="0" y1="${t}" x2="0" y2="${hz}">${stops(c.sky, 0, .45, .78, 1)}</linearGradient>
    <linearGradient id="ground" gradientUnits="userSpaceOnUse" x1="0" y1="${hz}" x2="0" y2="${b}">${stops(c.ground, 0, 1)}</linearGradient>
    <clipPath id="tab"><path d="${tab}"/></clipPath>
  </defs>
  <g clip-path="url(#tab)">
    <rect width="${size}" height="${hz}" fill="url(#sky)"/>
    ${glow}<circle cx="${mid}" cy="${hz}" r="${sun}" fill="${c.sun}"/>
    <rect y="${hz}" width="${size}" height="${size - hz}" fill="url(#ground)"/>
    ${shine}
  </g>
</svg>
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await mkdir(join(root, 'docs/icon'), { recursive: true });
  await writeFile(join(root, 'docs/icon/tabula.svg'), iconSvg(128));
  await writeFile(join(root, 'docs/icon/tabula-mark.svg'), iconSvg(128, { crop: true }));
  const { send, once, close } = await launch(process.argv[2]);
  try {
    for (const size of Object.keys(SIZES).map(Number)) {
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const s = (m, p) => send(m, p, sessionId);
      await s('Page.enable');
      await s('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
      await s('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
      const loaded = once('Page.loadEventFired', sessionId);
      const html = `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${iconSvg(size)}`;
      await s('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') });
      await loaded;
      const { data } = await s('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
      await writeFile(join(root, `icons/icon${size}.png`), Buffer.from(data, 'base64'));
      await send('Target.closeTarget', { targetId });
      console.log('saved', `icons/icon${size}.png`);
    }
  } finally {
    await close();
  }
}
