// Bookmark tiles: site icon (fetched once in high resolution and stored as a data URL, or Chrome's cached one), emoji or letter.
import { load, save, settings } from './store.js';
import { t } from './i18n.js';
import { $, h, svg, ICONS, uid, hasChrome } from './util.js';

// Shown on first run only. They start on Chrome's own cached icons (nothing is fetched, no logos are bundled);
// Settings → "Improve bookmark icons" swaps them for each site's own high-resolution icon in one click.
const DEFAULTS = [
  ['https://www.youtube.com/', 'YouTube', 'youtube'],
  ['https://github.com/', 'GitHub', 'github'],
  ['https://chatgpt.com/', 'ChatGPT', 'chatgpt'],
  ['https://claude.ai/', 'Claude', 'claude'],
].map(([url, title, id]) => ({ id, url, title, icon: { type: 'favicon' } }));

let bms = load('bookmarks', null);
if (!bms) save('bookmarks', bms = DEFAULTS);
// Earlier versions bundled the default icons in icons/sites/; those files are gone.
else if (bms.some(b => b.icon?.value?.startsWith?.('icons/sites/'))) {
  for (const b of bms) if (b.icon?.value?.startsWith?.('icons/sites/')) b.icon = { type: 'favicon' };
  save('bookmarks', bms);
}
let grid;
const persist = () => save('bookmarks', bms);

const EMOJI = ['⭐', '📧', '📅', '📁', '💼', '🛒', '🎵', '🎬', '📺', '📰', '💬', '🐙', '🧠', '🛠️', '📚', '✈️', '🏠', '💰', '📈', '🎮', '🍕', '☕', '❤️', '🔖'];
const INTERNAL = /^(chrome|chrome-extension|edge|about):/i;

const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
const originOf = url => { try { return new URL(url).origin; } catch { return ''; } };
const hue = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 360;

export function normalizeUrl(v) {
  v = v.trim();
  if (!v) return null;
  if (!/^[a-z][\w+.-]*:/i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    if (/^https?:$/.test(u.protocol) && !u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.href;
  } catch { return null; }
}

// Chrome's own icon cache (the `favicon` permission): no network and no prompt, but small,
// and only for sites this browser has visited. For the others Chrome returns a grey globe.
const faviconUrl = url => chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=64`);
let globe;
async function pixels(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = new OffscreenCanvas(24, 24), ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, 24, 24);
  return ctx.getImageData(0, 0, 24, 24).data.join();
}
// Compare with what Chrome returns for a site that cannot exist.
const isGlobe = async url => (await pixels(faviconUrl(url))) === (await (globe ??= pixels(faviconUrl('https://tabula.invalid/'))));

export function iconEl(b, cls = '') {
  const ic = b.icon || { type: 'letter' };
  const box = h('span', { class: 'tile-icon ' + cls });
  if (ic.type === 'emoji') {
    box.textContent = ic.value;
  } else if (ic.type === 'favicon' && hasChrome) {
    box.append(h('img', { src: faviconUrl(b.url), alt: '', draggable: 'false', decoding: 'async' }));
    // A site Chrome has no icon for gets a coloured letter instead of the globe.
    isGlobe(b.url).then(blank => { if (blank) box.replaceWith(iconEl({ ...b, icon: { type: 'letter' } }, cls)); }).catch(() => {});
  } else if (ic.type === 'img' && ic.value) {
    if (ic.full) box.classList.add('full');
    const img = h('img', { src: ic.value, alt: '', draggable: 'false', decoding: 'async' });
    img.addEventListener('error', () => box.replaceWith(iconEl({ ...b, icon: { type: 'letter' } }, cls)));
    box.append(img);
  } else {
    const label = (b.title || hostOf(b.url) || '?').trim();
    box.classList.add('letter');
    box.style.setProperty('--hue', hue(hostOf(b.url) || label));
    box.textContent = [...label][0]?.toUpperCase() || '?';
  }
  return box;
}

/* ---------- grid ---------- */

export function initBookmarks(el) {
  grid = el;
  // Drop a link (e.g. from the address bar) onto the grid to add it.
  grid.addEventListener('dragover', e => {
    if (dragFrom != null || !e.dataTransfer.types.includes('text/uri-list')) return;
    e.preventDefault();
    grid.classList.add('drop-target');
  });
  grid.addEventListener('dragleave', e => { if (!grid.contains(e.relatedTarget)) grid.classList.remove('drop-target'); });
  grid.addEventListener('drop', e => {
    grid.classList.remove('drop-target');
    if (dragFrom != null) return;
    const url = e.dataTransfer.getData('text/uri-list').split('\n').find(l => l && !l.startsWith('#'));
    if (!url) return;
    e.preventDefault();
    openEditor(-1, { url: url.trim() });
  });
  initEditor();
  renderBookmarks();
}

export function reloadBookmarks() {
  bms = load('bookmarks', []);
  renderBookmarks();
}

let dragFrom = null;

export function renderBookmarks() {
  if (!grid) return;
  const tiles = bms.map((b, i) => {
    const newTab = settings.bmNewTab;
    const a = h('a', { class: 'tile', href: b.url, title: `${b.title}\n${b.url}`, target: newTab ? '_blank' : null, rel: newTab ? 'noopener' : null },
      iconEl(b), h('span', { class: 'tile-label' }, b.title));
    if (INTERNAL.test(b.url) && hasChrome) {
      // Pages can't link to chrome:// directly, the tabs API can.
      a.addEventListener('click', e => {
        e.preventDefault();
        if (newTab) chrome.tabs.create({ url: b.url });
        else if (e.ctrlKey || e.metaKey || e.button === 1) chrome.tabs.create({ url: b.url, active: false });
        else chrome.tabs.update({ url: b.url });
      });
    }
    const edit = h('button', { type: 'button', class: 'tile-edit', title: t('edit'), 'aria-label': t('edit'), html: svg(ICONS.pencil, 2), onclick: () => openEditor(i) });
    const wrap = h('div', { class: 'tile-wrap', draggable: 'true' }, a, edit);

    wrap.addEventListener('dragstart', e => {
      dragFrom = i;
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData('text/uri-list', b.url);
      requestAnimationFrame(() => wrap.classList.add('dragging'));
    });
    wrap.addEventListener('dragend', () => {
      dragFrom = null;
      grid.querySelectorAll('.dragging,.drop-before,.drop-after').forEach(n => n.classList.remove('dragging', 'drop-before', 'drop-after'));
    });
    wrap.addEventListener('dragover', e => {
      if (dragFrom == null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const r = wrap.getBoundingClientRect();
      const after = e.clientX > r.left + r.width / 2;
      wrap.classList.toggle('drop-before', !after);
      wrap.classList.toggle('drop-after', after);
    });
    wrap.addEventListener('dragleave', () => wrap.classList.remove('drop-before', 'drop-after'));
    wrap.addEventListener('drop', e => {
      if (dragFrom == null) return;
      e.preventDefault();
      e.stopPropagation();
      let to = i + (wrap.classList.contains('drop-after') ? 1 : 0);
      const [moved] = bms.splice(dragFrom, 1);
      if (dragFrom < to) to--;
      bms.splice(to, 0, moved);
      dragFrom = null;
      persist();
      renderBookmarks();
    });
    return wrap;
  });

  const add = h('button', { type: 'button', class: 'tile add', title: t('addBookmark'), onclick: () => openEditor(-1) },
    h('span', { class: 'tile-icon', html: svg(ICONS.plus, 1.8) }),
    h('span', { class: 'tile-label' }, t('add')));
  grid.replaceChildren(...tiles, h('div', { class: 'tile-wrap' }, add));
}

/* ---------- high-quality icon discovery ---------- */

// Called synchronously from a click/submit so the permission prompt keeps the user gesture.
export function fetchSiteMeta(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) return Promise.resolve({ icon: { type: 'letter' } });
  const pattern = `${u.protocol}//${u.hostname}/*`;
  const perm = hasChrome && chrome.permissions
    ? chrome.permissions.request({ origins: [pattern] }).catch(() => false)
    : Promise.resolve(true); // dev preview outside the extension: just try (CORS may block)

  return perm.then(async granted => {
    let meta = { icon: null, title: null };
    if (granted) {
      try { meta = await discover(u); } catch (e) { console.debug('[tabula] icon discovery failed', e); }
      if (hasChrome) chrome.permissions.remove({ origins: [pattern] }).catch(() => {});
    }
    if (!meta.icon) meta.icon = await fallbackIcon(u);
    return meta;
  });
}

const opts = () => ({ credentials: 'omit', redirect: 'follow', signal: AbortSignal.timeout(7000) });

async function discover(u) {
  // If the page itself can't be read (a login wall on another domain, a bot check), the conventional
  // icon addresses on the site's own origin are still worth a try.
  let base = u.href, html = '';
  try {
    const res = await fetch(u.href, opts());
    base = res.url || u.href;
    html = await res.text();
  } catch (e) { console.debug('[tabula] page unreadable, trying the usual icon addresses', u.href, e); }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const cands = [];
  const sizeOf = s => Math.max(0, ...String(s || '').split(/\s+/).map(x => (x === 'any' ? 512 : parseInt(x, 10) || 0)));

  for (const l of doc.querySelectorAll('link[rel][href]')) {
    const rel = l.getAttribute('rel').toLowerCase().split(/\s+/);
    const apple = rel.some(r => r.startsWith('apple-touch-icon'));
    if (!apple && !rel.includes('icon')) continue;
    const href = new URL(l.getAttribute('href'), base).href;
    const svgIcon = /\.svg(\?|#|$)/i.test(href) || l.getAttribute('type') === 'image/svg+xml';
    cands.push({ href, size: sizeOf(l.getAttribute('sizes')) || (svgIcon ? 400 : apple ? 180 : 32) });
  }

  const man = doc.querySelector('link[rel="manifest"][href]');
  if (man) {
    try {
      const mu = new URL(man.getAttribute('href'), base);
      const m = await (await fetch(mu, opts())).json();
      for (const i of m.icons || []) {
        const purpose = i.purpose || 'any';
        if (!/any/.test(purpose) && !/maskable/.test(purpose)) continue;
        cands.push({ href: new URL(i.src, mu).href, size: sizeOf(i.sizes) - (/any/.test(purpose) ? 0 : 60) });
      }
    } catch {}
  }

  for (const origin of new Set([new URL(base).origin, u.origin])) {
    cands.push({ href: origin + '/apple-touch-icon.png', size: 170 }, { href: origin + '/favicon.ico', size: 16 });
  }

  const seen = new Set();
  const ranked = cands
    .filter(c => !seen.has(c.href) && seen.add(c.href))
    .sort((a, b) => Math.min(b.size, 512) - Math.min(a.size, 512));

  let best = null;
  for (const c of ranked.slice(0, 8)) {
    const r = await rasterize(c.href).catch(() => null);
    if (!r) continue;
    if (r.px >= 96) { best = r; break; }
    if (!best || r.px > best.px) best = r;
  }

  const meta = sel => doc.querySelector(sel)?.getAttribute('content')?.trim();
  const title = meta('meta[property="og:site_name"]') || meta('meta[name="application-name"]') || meta('meta[name="apple-mobile-web-app-title"]');
  return { icon: best && { type: 'img', value: best.value, full: best.full }, title: title && title.length <= 40 ? title : null };
}

// Download an image and re-encode it to a ≤128px webp, so tiles never touch the network again.
async function rasterize(href) {
  const res = await fetch(href, opts());
  if (!res.ok) return null;
  const blob = await res.blob();
  if (blob.size < 50 || /text\/html/.test(blob.type)) return null;
  const src = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const isSvg = /svg/.test(blob.type) || /\.svg(\?|#|$)/i.test(href);
    let w = img.naturalWidth, hh = img.naturalHeight;
    if (isSvg || !w || !hh) { w = hh = 128; }
    const px = Math.max(w, hh);
    if (px < 16) return null;
    const size = Math.min(128, px);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    const k = size / px;
    ctx.drawImage(img, (size - w * k) / 2, (size - hh * k) / 2, w * k, hh * k);
    const data = ctx.getImageData(0, 0, size, size).data;
    const alpha = (x, y) => data[(y * size + x) * 4 + 3];
    const m = Math.floor(size * 0.06), e = size - 1 - m;
    const full = [alpha(m, m), alpha(e, m), alpha(m, e), alpha(e, e)].every(v => v > 240);
    return { value: c.toDataURL('image/webp', 0.92), full, px: isSvg ? 512 : px };
  } finally {
    URL.revokeObjectURL(src);
  }
}

// Without host access: try the conventional apple-touch-icon via <img>, then Chrome's own favicon cache.
async function fallbackIcon(u) {
  const probe = src => new Promise(res => {
    const img = new Image();
    img.onload = () => res(img.naturalWidth >= 64 ? src : null);
    img.onerror = () => res(null);
    img.src = src;
    setTimeout(() => res(null), 5000);
  });
  const touch = await probe(u.origin + '/apple-touch-icon.png');
  if (touch) return { type: 'img', value: touch, full: true };
  return hasChrome ? { type: 'favicon' } : { type: 'letter' };
}

/* ---------- improving icons in one go ---------- */

// Bookmarks still on Chrome's small cached icon (the defaults, or sites added without access)
// that have not been tried yet. A site whose own icon can't be read (Gmail without signing in sends you
// to accounts.google.com) is marked as tried, so the button doesn't offer the same failure again;
// the bookmark editor can still fetch it by hand.
const improvable = b => b.icon?.type === 'favicon' && !b.icon.tried && /^https?:/.test(b.url);
export const plainIconCount = () => bms.filter(improvable).length;

// One click, one prompt for all those sites: fetch each site's own icon, store it, give the access back.
// Must be called straight from the click, so Chrome shows the permission prompt.
export function improveIcons() {
  const list = bms.filter(improvable);
  const origins = [...new Set(list.map(b => { const u = new URL(b.url); return `${u.protocol}//${u.hostname}/*`; }))];
  const perm = hasChrome && chrome.permissions
    ? chrome.permissions.request({ origins }).catch(() => false)
    : Promise.resolve(true); // dev preview outside the extension: just try (CORS may block)

  return perm.then(async granted => {
    if (!granted) return null;
    const failed = [];
    await Promise.all(list.map(async b => {
      let icon = null;
      try { ({ icon } = await discover(new URL(b.url))); } catch (e) { console.debug('[tabula] icon discovery failed', b.url, e); }
      if (icon) b.icon = icon;
      else { b.icon = { type: 'favicon', tried: true }; failed.push(b.title); }
    }));
    if (hasChrome) chrome.permissions.remove({ origins }).catch(() => {});
    persist();
    renderBookmarks();
    return { done: list.length - failed.length, total: list.length, failed };
  });
}

/* ---------- editor dialog ---------- */

let editing = -1;
let mode = 'auto';
let fetched = null; // { origin, icon } fetched in this dialog session

const els = {};

function initEditor() {
  for (const id of ['bmDialog', 'bmForm', 'bmHeading', 'bmPreview', 'bmUrl', 'bmName', 'bmMode', 'bmFetch', 'bmEmoji', 'bmPicks', 'bmDelete', 'bmCancel', 'bmSave'])
    els[id] = $('#' + id);

  els.bmPicks.replaceChildren(...EMOJI.map(e => h('button', { type: 'button', onclick: () => { els.bmEmoji.value = e; preview(); } }, e)));
  els.bmMode.addEventListener('click', e => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    setMode(b.dataset.v);
    if (mode === 'emoji') els.bmEmoji.focus();
  });
  els.bmUrl.addEventListener('input', () => { els.bmUrl.setCustomValidity(''); preview(); });
  els.bmName.addEventListener('input', preview);
  els.bmEmoji.addEventListener('input', () => {
    const first = [...new Intl.Segmenter().segment(els.bmEmoji.value.trim())][0]?.segment || '';
    if (first !== els.bmEmoji.value) els.bmEmoji.value = first;
    preview();
  });
  els.bmCancel.addEventListener('click', () => els.bmDialog.close());
  els.bmDialog.addEventListener('click', e => { if (e.target === els.bmDialog) els.bmDialog.close(); });
  els.bmDelete.addEventListener('click', () => {
    if (editing >= 0) { bms.splice(editing, 1); persist(); renderBookmarks(); }
    els.bmDialog.close();
  });
  els.bmFetch.addEventListener('click', () => {
    const url = validUrl();
    if (!url) return;
    busy(els.bmFetch, true);
    fetchSiteMeta(url).then(meta => {
      fetched = { origin: originOf(url), icon: meta.icon };
      if (!els.bmName.value.trim() && meta.title) els.bmName.value = meta.title;
      preview();
    }).finally(() => busy(els.bmFetch, false));
  });
  els.bmForm.addEventListener('submit', onSave);
}

function busy(btn, on) {
  btn.disabled = on;
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = t('fetching'); }
  else if (btn.dataset.label) btn.textContent = btn.dataset.label;
}

function setMode(m) {
  mode = m;
  els.bmForm.dataset.mode = m;
  els.bmMode.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === m)));
  preview();
}

function validUrl() {
  const url = normalizeUrl(els.bmUrl.value);
  if (!url) {
    els.bmUrl.setCustomValidity(t('invalidUrl'));
    els.bmUrl.reportValidity();
  }
  return url;
}

function currentIcon() {
  const url = normalizeUrl(els.bmUrl.value) || '';
  if (mode === 'emoji') return { type: 'emoji', value: els.bmEmoji.value.trim() || '⭐' };
  if (mode === 'letter') return { type: 'letter' };
  if (fetched && fetched.origin === originOf(url)) return fetched.icon;
  return null;
}

function preview() {
  const url = normalizeUrl(els.bmUrl.value) || '';
  const icon = currentIcon() || { type: 'letter' };
  els.bmPreview.replaceWith(els.bmPreview = iconEl({ url, title: els.bmName.value.trim() || hostOf(url), icon }));
  els.bmPreview.id = 'bmPreview';
}

export function openEditor(i = -1, preset = {}) {
  editing = i;
  const b = bms[i];
  els.bmHeading.textContent = t(b ? 'editBookmark' : 'addBookmark');
  els.bmUrl.value = b?.url ?? preset.url ?? '';
  els.bmName.value = b?.title ?? preset.title ?? '';
  els.bmEmoji.value = b?.icon?.type === 'emoji' ? b.icon.value : '';
  els.bmUrl.setCustomValidity('');
  fetched = ['img', 'favicon'].includes(b?.icon?.type) ? { origin: originOf(b.url), icon: b.icon } : null;
  els.bmDelete.hidden = !b;
  setMode(b?.icon?.type === 'emoji' ? 'emoji' : b?.icon?.type === 'letter' ? 'letter' : 'auto');
  els.bmDialog.showModal();
  (b || preset.url ? els.bmName : els.bmUrl).focus();
}

function onSave(e) {
  e.preventDefault();
  const url = validUrl();
  if (!url) return;
  const typedTitle = els.bmName.value.trim();
  let icon = currentIcon();

  const commit = (icon, title) => {
    const entry = { id: bms[editing]?.id || uid(), url, title: typedTitle || title || hostOf(url), icon };
    if (editing >= 0) bms[editing] = entry; else bms.push(entry);
    persist();
    renderBookmarks();
    els.bmDialog.close();
  };

  if (icon) return commit(icon);
  busy(els.bmSave, true);
  fetchSiteMeta(url)
    .then(meta => commit(meta.icon, meta.title))
    .catch(() => commit({ type: 'letter' }))
    .finally(() => busy(els.bmSave, false));
}
