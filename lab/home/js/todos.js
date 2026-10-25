// Daily TODOs. History collapses by recency:
// this week → per day, this month → per week, this year → per month, older → per year.
import { load, save } from './store.js?v=2';
import { t, getLang } from './i18n.js?v=2';
import { h, svg, ICONS, uid, ymd, parseYmd, isoWeek, startOfWeek, cap } from './util.js?v=2';

let todos = load('todos', null);
let open = load('todoOpen', {});
let root;
let keepAdding = false;

const persist = () => save('todos', todos);
const fmt = (opts, d) => new Intl.DateTimeFormat(getLang(), opts).format(d);

export function initTodos(el) {
  root = el;
  if (!todos) {
    // First run: one sample task for today.
    todos = [{ id: uid(), text: t('welcomeTodo'), done: false, date: ymd(new Date()), ts: Date.now() }];
    persist();
  }
  renderTodos();
}

export function reloadTodos() {
  todos = load('todos', []);
  open = load('todoOpen', {});
  renderTodos();
}

function groupOf(date, now) {
  if (date === ymd(now)) return { key: 'today', kind: 'today' };
  const d = parseYmd(date);
  const a = isoWeek(d), b = isoWeek(now);
  if ((a.year === b.year && a.week === b.week) || d > now) return { key: 'd:' + date, kind: 'day', date: d };
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth())
    return { key: `w:${a.year}-${a.week}`, kind: 'week', week: a.week, start: startOfWeek(d) };
  if (d.getFullYear() === now.getFullYear())
    return { key: `m:${d.getFullYear()}-${d.getMonth()}`, kind: 'month', date: new Date(d.getFullYear(), d.getMonth(), 1) };
  return { key: 'y:' + d.getFullYear(), kind: 'year', year: d.getFullYear() };
}

function labelOf(g, now) {
  switch (g.kind) {
    case 'today':
      return [t('today'), fmt({ weekday: 'short', day: 'numeric', month: 'short' }, now)];
    case 'day': {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const isYesterday = ymd(y) === ymd(g.date);
      return [isYesterday ? t('yesterday') : cap(fmt({ weekday: 'long' }, g.date)), fmt({ day: 'numeric', month: 'short' }, g.date)];
    }
    case 'week': {
      const end = new Date(g.start); end.setDate(end.getDate() + 6);
      return [t('week', { n: g.week }), new Intl.DateTimeFormat(getLang(), { day: 'numeric', month: 'short' }).formatRange(g.start, end)];
    }
    case 'month':
      return [cap(fmt({ month: 'long' }, g.date)), ''];
    default:
      return [String(g.year), ''];
  }
}

export function renderTodos() {
  if (!root) return;
  const now = new Date();
  const groups = new Map([['today', { key: 'today', kind: 'today', items: [], last: ymd(now) }]]);
  for (const td of todos) {
    const g = groupOf(td.date, now);
    if (!groups.has(g.key)) groups.set(g.key, { ...g, items: [], last: td.date });
    const G = groups.get(g.key);
    G.items.push(td);
    if (td.date > G.last) G.last = td.date;
  }
  const list = [...groups.values()].sort((a, b) =>
    a.kind === 'today' ? -1 : b.kind === 'today' ? 1 : b.last.localeCompare(a.last));
  root.replaceChildren(...list.map(g => renderGroup(g, now)));
}

function renderGroup(g, now) {
  const isToday = g.kind === 'today';
  const multiDay = g.kind === 'week' || g.kind === 'month' || g.kind === 'year';
  const isOpen = isToday || (open[g.key] ?? g.kind === 'day');
  const [label, sub] = labelOf(g, now);
  const count = h('span', { class: 'tcount' });
  const bar = h('i');

  const sec = h('section', { class: `tgroup ${g.kind}${isOpen ? ' open' : ''}` });
  const head = h(isToday ? 'div' : 'button', { class: 'thead', type: isToday ? null : 'button', 'aria-expanded': isToday ? null : String(isOpen) },
    isToday ? null : h('span', { class: 'chev', html: svg(ICONS.chevron, 2.2) }),
    h('span', { class: 'tlabel' }, label),
    sub && h('span', { class: 'tsub' }, sub),
    count);
  if (!isToday) {
    head.addEventListener('click', () => {
      const v = !sec.classList.contains('open');
      sec.classList.toggle('open', v);
      head.setAttribute('aria-expanded', String(v));
      open[g.key] = v;
      save('todoOpen', open);
    });
  }

  const refresh = () => {
    const done = g.items.filter(i => i.done).length, total = g.items.length;
    count.textContent = total ? `${done}/${total}` : '';
    bar.style.width = total ? (done / total) * 100 + '%' : '0';
  };
  refresh();

  const items = [...g.items].sort((a, b) => (isToday ? 0 : b.date.localeCompare(a.date)) || a.ts - b.ts);
  const ul = h('ul', { class: 'tlist' }, items.map(it => renderItem(it, { isToday, multiDay, kind: g.kind, refresh })));
  if (isToday) ul.append(renderAdd());

  sec.append(head);
  if (isToday) sec.append(h('div', { class: 'tprogress' }, bar));
  sec.append(h('div', { class: 'tbody' }, ul));
  return sec;
}

function renderItem(it, ctx) {
  const li = h('li', { class: 'titem' + (it.done ? ' done' : '') });
  const cb = h('input', { type: 'checkbox', class: 'check', 'aria-label': it.text });
  cb.checked = it.done;
  cb.addEventListener('change', () => {
    it.done = cb.checked;
    persist();
    li.classList.toggle('done', it.done);
    ctx.refresh();
  });

  const text = h('span', { class: 'ttext' }, it.text);
  text.addEventListener('dblclick', () => startEdit(it, text));

  const actions = h('span', { class: 'tactions' });
  if (!ctx.isToday && !it.done) {
    actions.append(h('button', {
      type: 'button', class: 'ibtn', title: t('moveToToday'), 'aria-label': t('moveToToday'), html: svg(ICONS.toToday),
      onclick: () => { it.date = ymd(new Date()); it.ts = Date.now(); persist(); renderTodos(); },
    }));
  }
  actions.append(h('button', {
    type: 'button', class: 'ibtn danger', title: t('delete'), 'aria-label': t('delete'), html: svg(ICONS.trash),
    onclick: () => { todos = todos.filter(x => x !== it); persist(); renderTodos(); },
  }));

  let day = null;
  if (ctx.multiDay) {
    const d = parseYmd(it.date);
    day = h('span', { class: 'tday' }, ctx.kind === 'week'
      ? fmt({ weekday: 'short', day: 'numeric' }, d)
      : fmt(ctx.kind === 'year' ? { day: 'numeric', month: 'short' } : { day: 'numeric', weekday: 'short' }, d));
  }

  li.append(...[cb, text, day, actions].filter(Boolean));
  return li;
}

function startEdit(it, span) {
  const input = h('input', { class: 'tedit', type: 'text', maxlength: 500 });
  input.value = it.text;
  span.replaceWith(input);
  input.focus();
  let finished = false;
  const finish = commit => {
    if (finished) return;
    finished = true;
    if (commit) {
      const v = input.value.trim();
      if (v) it.text = v; else todos = todos.filter(x => x !== it);
      persist();
    }
    renderTodos();
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) finish(true);
    else if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
}

function renderAdd() {
  const li = h('li', { class: 'tadd' });
  const input = h('input', { class: 'tadd-input', type: 'text', maxlength: 500, placeholder: t('todoPlaceholder'), 'aria-label': t('addTodo') });
  const show = on => {
    keepAdding = on;
    li.classList.toggle('editing', on);
    if (on) input.focus();
  };
  const btn = h('button', { type: 'button', class: 'tadd-btn', onclick: () => show(true) },
    h('span', { class: 'plus', html: svg(ICONS.plus, 2.6) }), t('addTodo'));

  const commit = () => {
    const v = input.value.trim();
    if (!v) return false;
    input.value = ''; // so a blur during re-render can't add it twice
    todos.push({ id: uid(), text: v, done: false, date: ymd(new Date()), ts: Date.now() });
    persist();
    return true;
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) {
      if (!commit()) return;
      keepAdding = true;
      renderTodos();
    } else if (e.key === 'Escape') {
      input.value = '';
      show(false);
    }
  });
  // Clicking away keeps what was typed.
  input.addEventListener('blur', () => {
    if (!li.isConnected) return;
    if (commit()) { keepAdding = false; renderTodos(); }
    else show(false);
  });

  li.append(btn, input);
  if (keepAdding) queueMicrotask(() => show(true));
  return li;
}
