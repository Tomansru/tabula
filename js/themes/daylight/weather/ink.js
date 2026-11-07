// Which ink reads best over a clouded sky, and what halo helps it. Pure: it gets the pixels behind each piece of
// text and decides; reading the pixels is the caller's job.
//
// Contrast is APCA's (the perceptual contrast that WCAG 3 drafts use) rather than WCAG 2's ratio: on mid-grey skies
// the ratio favours dark text far more than the eye does, and those skies are exactly the hard ones here.

// Relative luminance the way APCA wants it: sRGB channels 0…1 with a plain 2.4 power.
export const apcaY = ([r, g, b]) => .2126729 * r ** 2.4 + .7151522 * g ** 2.4 + .072175 * b ** 2.4;

// Lightness contrast, -108…106: positive for dark text on a light ground, negative for light text on a dark one.
export function apca(textY, groundY) {
  const soft = y => (y > .022 ? y : y + (.022 - y) ** 1.414);
  const t = soft(textY), g = soft(groundY);
  if (Math.abs(g - t) < .0005) return 0;
  if (g > t) { const s = (g ** .56 - t ** .57) * 1.14; return s < .1 ? 0 : (s - .027) * 100; }
  const s = (g ** .65 - t ** .62) * 1.14;
  return s > -.1 ? 0 : (s + .027) * 100;
}

// The two inks of the page: --fg of the light theme (dark text) and of the dark theme (light text).
const DARK_TEXT = apcaY([0x22 / 255, 0x31 / 255, 0x3a / 255]);
const LIGHT_TEXT = apcaY([0xee / 255, 0xe9 / 255, 0xe3 / 255]);
const NIGHT = [8 / 255, 12 / 255, 28 / 255];

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)))];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// How well one ink reads over all the zones, 0 (lost) … 1.2 (comfortably). The worst zone counts on its own,
// so one caption over a dark cloud is not outvoted by a bright patch behind the clock.
function readability(textY, zones) {
  let sum = 0, weight = 0, worst = Infinity;
  for (const z of zones) {
    // The patch of the zone that is closest to the ink is what the eye trips on.
    const ground = quantile(z.ys, textY < .2 ? .2 : .8);
    const met = Math.min(1.2, Math.abs(apca(textY, ground)) / z.need);
    sum += met * z.weight; weight += z.weight;
    worst = Math.min(worst, met);
  }
  return weight ? (sum / weight) * .6 + worst * .4 : 1;
}

// zones: [{ ys: sorted Float64Array of APCA luminances behind the text, rgb: their mean sRGB colour 0…1,
//           need: |Lc| that reads well for that text, weight }]
// lightText: what the page shows now (null at first), kept unless the other ink is clearly better.
// byDay: the ink the theme would choose by the sun alone (true: light text). Mid-grey skies are close to a tie,
// and there the time of day settles it: dark text by day, light text in the dusk.
// → { lightText, hard: 0…1 how much the ink needs help, tone: mean sRGB behind the text, score }
export function pickInk(zones, lightText = null, byDay = null) {
  const dark = readability(DARK_TEXT, zones), light = readability(LIGHT_TEXT, zones);
  // How far light text is ahead, with the leanings: towards the time of day, and towards staying as it is.
  const lead = light - dark + (byDay === null ? 0 : byDay ? .06 : -.06) + (lightText === null ? 0 : lightText ? .05 : -.05);
  const pick = lead > 0, score = pick ? light : dark;
  let tone = [0, 0, 0], weight = 0;
  for (const z of zones) { tone = tone.map((v, i) => v + z.rgb[i] * z.weight); weight += z.weight; }
  tone = weight ? tone.map(v => v / weight) : [.5, .5, .5];
  return { lightText: pick, hard: Math.max(0, Math.min(1, (1.05 - score) / .4)), tone, score };
}

// The halo: the sky itself, a step further from the ink. Pure white glowing on a grey sky reads as a smudge;
// a paler patch of the same grey reads as the clouds thinning behind the words.
// tint 0 gives the theme's plain white or night-blue halo, 1 the sky's own colour.
export function haloFor(lightText, tone, hard, tint = 1) {
  const plain = lightText ? NIGHT : [1, 1, 1];
  const sky = mix(tone, plain, lightText ? .58 : .55);
  const c = mix(plain, sky, tint).map(v => Math.round(v * 255)).join(' ');
  // A tinted halo is close to the sky, so it can be wider and fuller without showing as a glow.
  const wide = (.45 + hard * .32).toFixed(2), tight = (hard * .4).toFixed(2), blur = Math.round((lightText ? 12 : 10) + tint * 3);
  return `0 1px ${blur}px rgb(${c} / ${wide}), 0 0 ${lightText ? 2 : 3}px rgb(${c} / ${tight})`;
}
