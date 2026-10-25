// localStorage is synchronous, so everything renders on the very first frame.
// Only the background image (a Blob) lives in IndexedDB.
const P = 'tabula.next.';

export function load(key, fallback) {
  try {
    const v = localStorage.getItem(P + key);
    return v == null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}

export function save(key, value) {
  try { localStorage.setItem(P + key, JSON.stringify(value)); }
  catch (e) { console.warn('[tabula] could not save', key, e); }
}

function defaultH24() {
  try { return !/h1[12]/.test(new Intl.DateTimeFormat(navigator.language, { hour: 'numeric' }).resolvedOptions().hourCycle); }
  catch { return true; }
}

const DEFAULTS = {
  lang: null,
  mode: 'sun',      // light/dark: auto (system) | light | dark | sun
  theme: 'daylight', // id of the background theme, see js/themes/
  themes: {},       // each theme's own settings, by theme id
  h24: defaultH24(),
  seconds: false,
  showWeather: true,
  units: 'c',
  showTodos: true,
  todoCard: false,  // cards behind the side widgets (weather, tasks)
  typeset: 'air',   // typography preset: air | classic, see css/tokens.css
  captions: true,   // small captions in the corners of the frame
  bmNewTab: true,
  showSearch: true,
  searchEngine: 'google',
  location: null,
};

// Settings saved before themes existed: `theme` was light/dark and the picture lived in bg* keys.
export function migrateSettings(s) {
  if (s.mode === undefined && ['auto', 'light', 'dark', 'sun'].includes(s.theme)) {
    s.mode = s.theme;
    delete s.theme;
  }
  if ('bgType' in s) {
    s.themes = s.themes || {};
    if (s.bgType === 'file' || (s.bgType === 'url' && s.bgUrl)) {
      s.theme = 'picture';
      s.themes.picture = { src: s.bgType, url: s.bgUrl || '', dim: s.bgDim ?? 35, blur: s.bgBlur ?? 0 };
    }
    for (const k of ['bgType', 'bgUrl', 'bgDim', 'bgBlur', 'skyFx']) delete s[k];
  }
  return s;
}

export const settings = Object.assign({}, DEFAULTS, migrateSettings(load('settings', {})));

export function setSetting(patch) {
  Object.assign(settings, patch);
  save('settings', settings);
  emit('settings', patch);
}

const subs = {};
export const on = (ev, fn) => (subs[ev] ||= []).push(fn);
export const emit = (ev, data) => (subs[ev] || []).forEach(fn => fn(data));

let dbp;
function db() {
  return (dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('tabula-next', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('blobs');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}

export async function blobGet(key) {
  const d = await db();
  return new Promise((res, rej) => {
    const q = d.transaction('blobs').objectStore('blobs').get(key);
    q.onsuccess = () => res(q.result || null);
    q.onerror = () => rej(q.error);
  });
}

export async function blobSet(key, value) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction('blobs', 'readwrite');
    const st = tx.objectStore('blobs');
    value == null ? st.delete(key) : st.put(value, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
