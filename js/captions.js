// Small captions in the corners of the frame: a phrase (top left) that changes at random now and then,
// the day of the year (top right) and how much of the day is left (bottom right).
import { t } from './i18n.js';
import { $ } from './util.js';

const PHRASES = ['motto', 'focusNote'];
const EVERY = 15 * 60e3;
let phrase = Math.floor(Math.random() * PHRASES.length), shownAt = Date.now();

function nextPhrase() {
  if (PHRASES.length < 2 || Date.now() - shownAt < EVERY) return false;
  let i;
  do i = Math.floor(Math.random() * PHRASES.length); while (i === phrase);
  phrase = i;
  shownAt = Date.now();
  return true;
}

export function renderCaptions(now = new Date()) {
  document.querySelectorAll('[data-cap]').forEach(el => { el.textContent = t(el.dataset.cap); });

  const motto = $('#capMotto');
  if (nextPhrase() && motto.textContent) {
    // Fade out, swap, fade in.
    motto.classList.add('swap');
    setTimeout(() => { motto.textContent = t(PHRASES[phrase]); motto.classList.remove('swap'); }, 400);
  } else motto.textContent = t(PHRASES[phrase]);

  const y = now.getFullYear();
  const dayOfYear = Math.round((new Date(y, now.getMonth(), now.getDate()) - new Date(y, 0, 1)) / 864e5) + 1;
  const daysInYear = new Date(y, 1, 29).getMonth() === 1 ? 366 : 365;
  $('#capDay').textContent = t('dayOf', { n: dayOfYear, y: daysInYear });

  const left = 1 - (now.getHours() * 60 + now.getMinutes()) / 1440;
  const p = $('#capProgress');
  p.firstElementChild.textContent = t('dayLeft', { n: Math.round(left * 100) });
  p.querySelector('b').style.width = `${(1 - left) * 100}%`;
}
