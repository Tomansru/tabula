// Theme "Your picture": the user's own wallpaper (uploaded file or link) with dim and blur. No animation.
import { blobGet, blobSet } from '../store.js';
import { t } from '../i18n.js';
import { h, svg } from '../util.js';

const root = document.documentElement;

// The uploaded file lives in IndexedDB; `rev` changes on every upload so we know when to reload it.
let fileUrl = null, fileRev = null;
async function sourceOf(cfg) {
  if (cfg.src === 'url') return cfg.url || null;
  if (cfg.src !== 'file') return null;
  if (fileUrl && fileRev === cfg.rev) return fileUrl;
  const blob = await blobGet('bg').catch(() => null);
  if (fileUrl) URL.revokeObjectURL(fileUrl);
  fileUrl = blob ? URL.createObjectURL(blob) : null;
  fileRev = cfg.rev;
  return fileUrl;
}
const cssUrl = src => `url("${src.replace(/["\\]/g, '\\$&')}")`;

// Big photos are scaled to the screen once on upload, so every new tab decodes a small image.
async function shrink(file) {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const bmp = await createImageBitmap(file);
    const max = Math.min(3840, Math.round(Math.max(screen.width, screen.height) * (devicePixelRatio || 1)));
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 2.5e6) return file;
    const c = new OffscreenCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await c.convertToBlob({ type: 'image/webp', quality: 0.9 });
  } catch { return file; }
}

let applySeq = 0;
async function apply(cfg) {
  const my = ++applySeq;
  root.style.setProperty('--dim', cfg.dim / 100);
  root.style.setProperty('--blur', cfg.blur + 'px');
  const src = await sourceOf(cfg);
  if (my !== applySeq) return;
  if (!src) {
    root.classList.remove('has-bg', 'bg-ready');
    root.style.removeProperty('--bg-img');
    return;
  }
  root.classList.add('has-bg');
  const img = new Image();
  img.src = src;
  await img.decode().catch(() => {});
  if (my !== applySeq) return;
  root.style.setProperty('--bg-img', cssUrl(src));
  root.classList.add('bg-ready');
}

const IMAGE_ICON = '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 2.5-2 4.5 3.5"/>';

export default {
  id: 'picture',
  name: 'themePicture',
  defaults: { src: 'none', url: '', dim: 35, blur: 0, rev: 0 },

  async preview(el, cfg) {
    const src = await sourceOf(cfg);
    el.classList.toggle('empty', !src);
    el.style.backgroundImage = src ? cssUrl(src) : '';
    el.innerHTML = src ? '' : svg(IMAGE_ICON, 1.5);
    if (src) el.append(h('span', { class: 'theme-dim', style: `opacity:${cfg.dim / 100}` }));
  },

  controls(el, cfg, update) {
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    const remove = h('button', { type: 'button', class: 'btn ghost' }, t('removePicture'));
    const url = h('input', { type: 'url', placeholder: t('imageUrl'), spellcheck: 'false' });
    url.value = cfg.src === 'url' ? cfg.url : '';
    remove.disabled = cfg.src === 'none';

    file.addEventListener('change', async () => {
      const f = file.files[0];
      file.value = '';
      if (!f) return;
      await blobSet('bg', await shrink(f));
      update({ src: 'file', url: '', rev: Date.now() });
      url.value = '';
      remove.disabled = false;
    });
    const applyUrl = () => {
      const v = url.value.trim();
      if (!/^https?:\/\//i.test(v)) return;
      blobSet('bg', null).catch(() => {});
      update({ src: 'url', url: v });
      remove.disabled = false;
    };
    url.addEventListener('keydown', e => { if (e.key === 'Enter') applyUrl(); });
    remove.addEventListener('click', () => {
      blobSet('bg', null).catch(() => {});
      update({ src: 'none', url: '' });
      url.value = '';
      remove.disabled = true;
    });

    const slider = (key, max, unit) => {
      const out = h('output', {}, cfg[key] + unit);
      const input = h('input', { type: 'range', min: 0, max });
      input.value = cfg[key];
      input.addEventListener('input', () => { out.value = input.value + unit; update({ [key]: +input.value }); });
      return h('label', { class: 'range' }, h('span', {}, h('span', {}, t(key)), out), input);
    };

    el.append(
      h('div', { class: 'btns' },
        h('button', { type: 'button', class: 'btn', onclick: () => file.click() }, t('upload')), remove, file),
      h('div', { class: 'inline' }, url, h('button', { type: 'button', class: 'btn', onclick: applyUrl }, t('apply'))),
      slider('dim', 90, '%'),
      slider('blur', 20, 'px'),
    );
  },

  activate(stage, cfg) {
    stage.append(h('div', { id: 'bg', 'aria-hidden': 'true' }), h('div', { id: 'dim', 'aria-hidden': 'true' }));
    apply(cfg);
  },

  update(cfg, reason) {
    if (reason === 'config') apply(cfg);
  },

  deactivate() {
    applySeq++;
    root.classList.remove('has-bg', 'bg-ready');
    root.style.removeProperty('--bg-img');
  },
};
