import { settings as S, setSetting, load, save } from './store.js';
import { THEMES, themeById, themeConfig, updateThemeConfig, activeTheme } from './themes/index.js';
import { LANGS, t, getLang } from './i18n.js';
import { ENGINES } from './search.js';
import { searchCity, reverseGeocode } from './weather.js';
import { plainIconCount, improveIcons } from './bookmarks.js';
import { $, h, svg, debounce, ymd } from './util.js';

let dlg;

export function openSettings(focusSel) {
  syncSettingsUI();
  if (!dlg.open) dlg.showModal();
  renderThemes();
  if (focusSel) $(focusSel)?.focus();
}

export function initSettings() {
  dlg = $('#settings');
  $('#openSettings').addEventListener('click', () => openSettings());
  $('#sClose').addEventListener('click', () => dlg.close());
  $('#sBack').addEventListener('click', closeThemePage);
  // Esc on a theme page goes back first; closing the drawer always returns to the main page.
  dlg.addEventListener('cancel', e => { if (pageTheme) { e.preventDefault(); closeThemePage(); } });
  dlg.addEventListener('close', () => { if (pageTheme) closeThemePage(); });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  const lang = $('#sLang');
  lang.replaceChildren(...Object.entries(LANGS).map(([k, v]) => h('option', { value: k }, v)));
  lang.addEventListener('change', () => setSetting({ lang: lang.value }));
  $('#sEngine').addEventListener('change', e => setSetting({ searchEngine: e.target.value }));

  for (const [sel, key] of [['#sTheme', 'mode'], ['#sUnits', 'units'], ['#sType', 'typeset']]) {
    $(sel).addEventListener('click', e => {
      const b = e.target.closest('button[data-v]');
      if (b) { setSetting({ [key]: b.dataset.v }); syncSettingsUI(); }
    });
  }
  // Weather effects on the clock are switched off until they are redesigned together with the sky.
  for (const [sel, key] of [['#sH24', 'h24'], ['#sSec', 'seconds'], ['#sWx', 'showWeather'], ['#sTodoCard', 'todoCard'], ['#sTodos', 'showTodos'], ['#sBmNewTab', 'bmNewTab'], ['#sSearch', 'showSearch'], ['#sCaps', 'captions']]) {
    $(sel).addEventListener('change', e => setSetting({ [key]: e.target.checked }));
  }

  // Section chips at the top of the drawer jump to their section.
  $('#sNav').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const i = [...b.parentNode.children].indexOf(b);
    $('#sMain').querySelectorAll(':scope > section')[i]?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  });

  // One click and one Chrome prompt for every bookmark still on Chrome's small cached icon.
  $('#sIcons').addEventListener('click', () => {
    const btn = $('#sIcons'), note = $('#sIconsNote');
    btn.disabled = true;
    note.textContent = t('fetching');
    improveIcons().then(r => {
      note.textContent = !r ? t('improveIconsNote')
        : t('iconsUpdated', { n: r.done, m: r.total }) + (r.failed.length ? '. ' + t('iconsFailed', { list: r.failed.join(', ') }) : '');
      btn.disabled = !plainIconCount();
    });
  });

  initLocation();
  initData();
}

export function syncSettingsUI() {
  $('#sLang').value = S.lang;
  for (const [sel, key] of [['#sTheme', 'mode'], ['#sUnits', 'units'], ['#sType', 'typeset']])
    $(sel).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === S[key])));
  // A theme that paints its own sky decides light/dark itself.
  const locked = !!activeTheme()?.ownsMode;
  $('#sTheme').querySelectorAll('button').forEach(b => { b.disabled = locked; });
  $('#sModeNote').hidden = !locked;
  $('#sH24').checked = S.h24;
  $('#sSec').checked = S.seconds;
  $('#sFx').checked = false;
  $('#sSearch').checked = S.showSearch;
  const engine = $('#sEngine');
  engine.replaceChildren(...Object.entries(ENGINES).map(([id, [name]]) =>
    h('option', { value: id }, id === 'browser' ? t('engineBrowser') : id === 'yandex' && getLang() === 'ru' ? 'Яндекс' : name)));
  engine.value = ENGINES[S.searchEngine] ? S.searchEngine : 'google';
  engine.disabled = !S.showSearch;
  $('#sWx').checked = S.showWeather;
  $('#sTodoCard').checked = S.todoCard;
  $('#sTodos').checked = S.showTodos;
  $('#sBmNewTab').checked = S.bmNewTab;
  $('#sCaps').checked = S.captions;
  $('#sIconsField').hidden = !plainIconCount();
  $('#sIcons').disabled = false;
  $('#sIconsNote').textContent = t('improveIconsNote');
  $('#sLocCurrent').textContent = S.location?.name || t('notSet');
  if (dlg.open && !pageTheme) renderThemes(); // names follow the language
}

/* ---------- weather location ---------- */

function initLocation() {
  const input = $('#sLocSearch');
  const list = $('#sLocResults');
  let seq = 0;

  const choose = loc => {
    setSetting({ location: loc });
    input.value = '';
    list.replaceChildren();
    syncSettingsUI();
  };

  input.addEventListener('input', debounce(async () => {
    const q = input.value.trim();
    const my = ++seq;
    if (q.length < 2) { list.replaceChildren(); return; }
    let results = [];
    try { results = await searchCity(q); } catch {}
    if (my !== seq) return;
    list.replaceChildren(...(results.length
      ? results.map(r => h('li', {}, h('button', {
          type: 'button',
          onclick: () => choose({ name: r.name, lat: +r.latitude.toFixed(2), lon: +r.longitude.toFixed(2) }),
        }, h('b', {}, r.name), h('span', {}, [r.admin1, r.country].filter(Boolean).join(', ')))))
      : [h('li', { class: 'muted' }, t('noResults'))]));
  }, 300));

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') list.querySelector('button')?.click();
  });

  const geo = $('#sLocGeo');
  const label = geo.querySelector('span');
  geo.addEventListener('click', () => {
    label.textContent = t('locating');
    geo.disabled = true;
    const done = msg => {
      geo.disabled = false;
      label.textContent = msg || t('useMyLocation');
      if (msg) setTimeout(() => { label.textContent = t('useMyLocation'); }, 2500);
    };
    navigator.geolocation.getCurrentPosition(async p => {
      // ~1 km precision is plenty for weather and keeps the exact position private.
      const lat = +p.coords.latitude.toFixed(2), lon = +p.coords.longitude.toFixed(2);
      const name = await reverseGeocode(lat, lon).catch(() => null);
      choose({ name: name || t('myLocation'), lat, lon });
      done();
    }, () => done(t('locError')), { timeout: 10000, maximumAge: 3600e3 });
  });
}

/* ---------- themes: a card per theme (preview, name, radio); the selected one shows its own controls ---------- */

const GEAR = '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>';

// The card picks the theme; its gear opens the theme's own settings as a page of this drawer.
function renderThemes() {
  const current = themeById(S.theme);
  $('#sThemes').replaceChildren(...THEMES.map(theme => {
    const selected = theme === current;
    const thumb = h('span', { class: 'theme-thumb' });
    const pick = h('button', {
      type: 'button', class: 'theme-pick', role: 'radio', 'aria-checked': String(selected),
      onclick: () => { if (!selected) { setSetting({ theme: theme.id }); renderThemes(); } },
    }, thumb, h('span', { class: 'theme-name' }, t(theme.name)), h('span', { class: 'theme-radio', 'aria-hidden': 'true' }));
    const card = h('div', { class: 'theme-card' + (selected ? ' selected' : '') }, pick);
    if (theme.controls) {
      card.append(h('button', {
        type: 'button', class: 'theme-gear', title: t('themeSettings'), 'aria-label': `${t('themeSettings')}: ${t(theme.name)}`,
        html: svg(GEAR, 1.8), onclick: () => openThemePage(theme),
      }));
    }
    // Previews measure their box, so draw them once the drawer is laid out.
    requestAnimationFrame(() => theme.preview(thumb, themeConfig(theme)));
    return card;
  }));
}

let pageTheme = null;

function openThemePage(theme) {
  pageTheme = theme;
  $('#sMain').hidden = true;
  $('#sThemePage').hidden = false;
  $('#sBack').hidden = false;
  $('#sTitle').textContent = t(theme.name);
  const hero = $('#sThemeHero'), box = $('#sThemeControls');
  hero.replaceChildren();
  box.replaceChildren();
  theme.controls(box, themeConfig(theme), patch => {
    updateThemeConfig(theme, patch);
    theme.preview(hero, themeConfig(theme));
  });
  dlg.querySelector('.drawer-inner').scrollTop = 0;
  dlg.scrollTop = 0;
  requestAnimationFrame(() => theme.preview(hero, themeConfig(theme)));
  $('#sBack').focus();
}

function closeThemePage() {
  if (!pageTheme) return;
  pageTheme = null;
  $('#sThemePage').hidden = true;
  $('#sMain').hidden = false;
  $('#sBack').hidden = true;
  $('#sTitle').textContent = t('settings');
  $('#sThemeControls').replaceChildren();
  renderThemes(); // previews pick up what was changed
  $('#sThemes').scrollIntoView({ block: 'center' });
}

/* ---------- export / import ---------- */

function initData() {
  $('#sExport').addEventListener('click', () => {
    const data = { app: 'tabula', version: 1, settings: S, bookmarks: load('bookmarks', []), todos: load('todos', []) };
    const a = h('a', {
      href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })),
      download: `tabula-${ymd(new Date())}.json`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#sImport').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'tabula') throw new Error('not a tabula backup');
      if (data.settings) {
        const s = { ...data.settings };
        // Uploaded pictures are not part of the backup.
        if (s.bgType === 'file') s.bgType = 'none';
        if (s.themes?.picture?.src === 'file') s.themes.picture.src = 'none';
        save('settings', s);
      }
      if (Array.isArray(data.bookmarks)) save('bookmarks', data.bookmarks);
      if (Array.isArray(data.todos)) save('todos', data.todos);
      location.reload();
    } catch {
      alert(t('importError'));
    }
  });
}
