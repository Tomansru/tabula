// Sun position from today's sunrise/sunset. Shared by the sky and the "sun" theme.
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function nowHour() {
  const n = new Date();
  return n.getHours() + n.getMinutes() / 60 + n.getSeconds() / 3600;
}

// e: elevation, 1 at solar noon, 0 on the horizon, negative below it.
// Day (sunrise → sunset) maps to d 0…1, night to d 1…2, so seasons stay continuous through midnight.
// d is returned in -0.5…1.5 (before sunrise negative) for placing the sun left or right.
export function sunAt(hour, { sr, ss }) {
  const h = ((hour % 24) + 24) % 24;
  const d = h >= sr && h <= ss ? (h - sr) / (ss - sr) : 1 + ((((h - ss) % 24) + 24) % 24) / (24 - (ss - sr));
  return { d: d > 1.5 ? d - 2 : d, e: Math.sin(Math.PI * d) };
}

// How dark the "sun" theme is: 0 by day, 1 at night, crossing over just after sunset / before sunrise.
export const sunDk = e => 1 - smooth(-0.14, 0.03, e);
