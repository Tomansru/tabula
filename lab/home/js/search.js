// Search bar: addresses open directly, everything else goes to the chosen search engine.
import { settings as S } from './store.js?v=2';
import { normalizeUrl } from './bookmarks.js?v=2';
import { $, hasChrome } from './util.js?v=2';

// id → [name, URL the encoded query is appended to]. "browser" uses Chrome's own default engine.
export const ENGINES = {
  google: ['Google', 'https://www.google.com/search?q='],
  duckduckgo: ['DuckDuckGo', 'https://duckduckgo.com/?q='],
  bing: ['Bing', 'https://www.bing.com/search?q='],
  yandex: ['Yandex', 'https://ya.ru/search/?text='],
  ecosia: ['Ecosia', 'https://www.ecosia.org/search?q='],
  startpage: ['Startpage', 'https://www.startpage.com/do/search?q='],
  browser: [null, null],
};

const looksLikeUrl = v => !/\s/.test(v) && (/^[a-z][\w+.-]*:/i.test(v) || /^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(\/.*)?$/i.test(v));

function search(v) {
  const url = looksLikeUrl(v) && normalizeUrl(v);
  if (url && /^(chrome|chrome-extension|edge|about):/i.test(url) && hasChrome) return chrome.tabs.update({ url });
  if (url) return void (location.href = url);
  if (S.searchEngine === 'browser' && hasChrome && chrome.search) return chrome.search.query({ text: v, disposition: 'CURRENT_TAB' });
  const [, prefix] = ENGINES[S.searchEngine]?.[1] ? ENGINES[S.searchEngine] : ENGINES.google;
  location.href = prefix + encodeURIComponent(v);
}

export function initSearch() {
  const form = $('#search'), q = $('#q');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = q.value.trim();
    if (v) search(v);
  });
  applySearch();
}

export const applySearch = () => $('#search').classList.toggle('off', !S.showSearch);
