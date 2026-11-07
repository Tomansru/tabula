// What each kind of weather does to the sky. Every number is a continuous dial, so moving between
// two conditions is a slow morph of the same sky rather than a swap of scenes.
//
//   cover    how much of the sky the main cloud deck covers
//   puff     0 a smooth stratus sheet … 1 separate cumulus heaps
//   cirrus   high ice wisps that catch the sun first and lose it last
//   weight   how heavy the clouds are: their undersides go from pearl to slate
//   veil     the sky itself loses contrast: the sun is a pale patch, the stars are gone
//   fog      banks lying on the horizon and filling everything below it
//   shafts   curtains of far rain hanging between the clouds and the horizon
//   rays     light breaking through gaps in the clouds
//   rain, fine  how many drops fall, and how much of it is drizzle rather than rain
//   snow, blow  how many flakes fall, and how much snow the wind drives along
//   wind     0 calm … 1 the whole sky leans
//   bolts    lightning inside the clouds
//
// `label` is the i18n key of its name.
export const CONDITIONS = [
  { id: 'clear', label: 'wx0',
    cover: 0, puff: 1, cirrus: .1, weight: 0, veil: 0, fog: 0, shafts: 0, rays: 0, rain: 0, fine: 0, snow: 0, blow: 0, wind: .12, bolts: 0 },
  { id: 'fair', label: 'wx1',
    cover: .3, puff: 1, cirrus: .72, weight: 0, veil: 0, fog: 0, shafts: 0, rays: .25, rain: 0, fine: 0, snow: 0, blow: 0, wind: .18, bolts: 0 },
  { id: 'cloudy', label: 'wx2',
    cover: .6, puff: .92, cirrus: .35, weight: .16, veil: .1, fog: 0, shafts: 0, rays: 1, rain: 0, fine: 0, snow: 0, blow: 0, wind: .24, bolts: 0 },
  { id: 'overcast', label: 'wx3',
    cover: 1, puff: .16, cirrus: 0, weight: .36, veil: .62, fog: .06, shafts: 0, rays: 0, rain: 0, fine: 0, snow: 0, blow: 0, wind: .16, bolts: 0 },
  { id: 'fog', label: 'wx45',
    cover: 0, puff: .1, cirrus: 0, weight: .04, veil: .3, fog: 1, shafts: 0, rays: 0, rain: 0, fine: 0, snow: 0, blow: 0, wind: .07, bolts: 0 },
  { id: 'drizzle', label: 'wx51',
    cover: 1, puff: .14, cirrus: 0, weight: .42, veil: .7, fog: .2, shafts: .3, rays: 0, rain: .55, fine: 1, snow: 0, blow: 0, wind: .1, bolts: 0 },
  { id: 'rain', label: 'wx61',
    cover: 1, puff: .3, cirrus: 0, weight: .56, veil: .76, fog: .16, shafts: .7, rays: 0, rain: .62, fine: 0, snow: 0, blow: 0, wind: .34, bolts: 0 },
  { id: 'storm', label: 'wx95',
    cover: 1, puff: .62, cirrus: 0, weight: 1, veil: .86, fog: .12, shafts: 1, rays: 0, rain: 1, fine: 0, snow: 0, blow: 0, wind: .78, bolts: 1 },
  { id: 'snow', label: 'wx71',
    cover: 1, puff: .12, cirrus: 0, weight: .2, veil: .72, fog: .18, shafts: 0, rays: 0, rain: 0, fine: 0, snow: .6, blow: 0, wind: .16, bolts: 0 },
  { id: 'blizzard', label: 'wxBlizzard',
    cover: 1, puff: .08, cirrus: 0, weight: .46, veil: .88, fog: .36, shafts: 0, rays: 0, rain: 0, fine: 0, snow: 1, blow: 1, wind: 1, bolts: 0 },
];

export const conditionById = id => CONDITIONS.find(c => c.id === id) || CONDITIONS[0];

export const DIALS = ['cover', 'puff', 'cirrus', 'weight', 'veil', 'fog', 'shafts', 'rays', 'rain', 'fine', 'snow', 'blow', 'wind', 'bolts'];
// What the "strength" setting scales, and what a light or heavy reading of the same weather scales.
const SCALED = ['veil', 'fog', 'shafts', 'rays', 'rain', 'snow', 'blow', 'wind'];
const FALLING = ['shafts', 'rain', 'snow'];

const VEIL_MAX = .94; // a touch of the sky always shows through

// The dials to aim for. Nothing goes over 1: rain and snow are fractions of a fixed set of drops and flakes.
export function targetDials(condition, { strength = 1, force = 1, wind = null } = {}) {
  const out = {};
  for (const k of DIALS) {
    let v = condition[k];
    if (FALLING.includes(k)) v *= force;
    if (SCALED.includes(k)) v *= strength;
    out[k] = Math.min(v, k === 'veil' ? VEIL_MAX : 1);
  }
  // The real wind leans the sky, on top of what this kind of weather usually does.
  if (Number.isFinite(wind)) out.wind = Math.min(1, (condition.wind * .4 + Math.min(1, wind / 16) * .6) * strength);
  return out;
}

// WMO weather code, as Open-Meteo gives it → [condition, how much of it is falling].
const FROM_CODE = {
  0: ['clear', 1], 1: ['fair', 1], 2: ['cloudy', 1], 3: ['overcast', 1],
  45: ['fog', 1], 48: ['fog', 1],
  51: ['drizzle', .75], 53: ['drizzle', 1], 55: ['drizzle', 1.2], 56: ['drizzle', .85], 57: ['drizzle', 1.15],
  61: ['rain', .7], 63: ['rain', 1], 65: ['rain', 1.3], 66: ['rain', .7], 67: ['rain', 1.2], 80: ['rain', .7], 81: ['rain', 1], 82: ['rain', 1.3],
  71: ['snow', .7], 73: ['snow', 1], 75: ['snow', 1.3], 77: ['snow', .6], 85: ['snow', .8], 86: ['snow', 1.2],
  95: ['storm', 1], 96: ['storm', 1], 99: ['storm', 1],
};
// There is no WMO code for a blizzard: it is snow in a strong wind.
const BLIZZARD_WIND = 10, BLIZZARD_GUSTS = 16; // m/s

// One forecast reading → what to show. Wind and gusts in m/s; either may be missing.
export function readForecast(code, wind, gusts) {
  const [id, force] = FROM_CODE[code] || FROM_CODE[0];
  const blizzard = id === 'snow' && (wind >= BLIZZARD_WIND || gusts >= BLIZZARD_GUSTS);
  return { condition: conditionById(blizzard ? 'blizzard' : id), force: blizzard ? 1 : force, wind: Number.isFinite(wind) ? wind : null };
}

// The light clouds are made of, by solar altitude; the same idea as the theme's own PALETTE.
// lit: the side facing the sun; shade: the underside; glow: light scattered through thin cloud; veil: the sky behind an overcast.
const rgb = hex => hex.match(/\w\w/g).map(s => parseInt(s, 16) / 255);
const LIGHT = [
  [-18, '3a4a68', '151d30', '7186ad', '10182a'],
  [-9, '4a5674', '1c2338', '7f7690', '1d263c'],
  [-3, 'b98a90', '463f5c', 'ffa98c', '4b4c66'],
  [2, 'ffbe98', '6a5c74', 'ffcb9c', '86808c'],
  [9, 'ffe2c2', '84859a', 'ffeccc', 'a4a6ab'],
  [24, 'fff6ea', '8fa0b2', 'fff8ea', 'b6c0c6'],
  [65, 'ffffff', '9bafc0', 'ffffff', 'c1ccd2'],
].map(([alt, ...cols]) => [alt, ...cols.map(rgb)]);

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export function cloudLight(altitude, weight) {
  let i = 0;
  while (i < LIGHT.length - 2 && altitude > LIGHT[i + 1][0]) i++;
  const a = LIGHT[i], b = LIGHT[i + 1], t = smooth(a[0], b[0], altitude);
  let [lit, shade, glow, veil] = a.slice(1).map((v, j) => mix3(v, b[j + 1], t));
  // Heavy clouds: less light gets through, the undersides sink first, and a touch of blue-slate replaces the warmth.
  const slate = [.2, .24, .3];
  shade = mix3(shade, slate.map((v, j) => v * (.34 + .66 * shade[j])), weight * .86);
  lit = mix3(lit, shade, weight * .62);
  veil = mix3(veil, shade, weight * .72);
  glow = mix3(glow, lit, weight * .55);
  // Only the heaviest clouds really take the daylight away.
  const dim = 1 - .42 * weight ** 3;
  [lit, shade, veil, glow] = [lit, shade, veil, glow].map(c => c.map(v => v * dim));
  return { lit, shade, glow, veil };
}

export const luminance = c => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
