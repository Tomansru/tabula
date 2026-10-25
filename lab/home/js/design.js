import { on } from './store.js?v=2';
import { getLang, t } from './i18n.js?v=2';

const words = {
 ru: { brand: 'Немного места для жизни', edition: 'ДОМА / 02', tasks: 'Немного внимания', tasksNote: 'Чтобы начать, достаточно маленького шага.', outside: 'За вашим окном', foot: 'Ваше время. Ваш ритм.', local: 'Место, где можно быть собой', thoughts: ['Пусть день будет добрым', 'Место для ваших мыслей', 'Побыть в этом мгновении', 'Всё важное может подождать до утра'] },
 en: { brand: 'A little room for life', edition: 'HOME / 02', tasks: 'A little focus', tasksNote: 'One small step is enough to begin.', outside: 'Outside your window', foot: 'Your time. Your pace.', local: 'A space of your own', thoughts: ['Let the day be kind', 'Room for your thoughts', 'Stay in this moment', 'Tomorrow can wait until morning'] },
 de: { brand: 'Ein wenig Raum fürs Leben', edition: 'ZUHAUSE / 02', tasks: 'Ein wenig Fokus', tasksNote: 'Ein kleiner Schritt ist ein guter Anfang.', outside: 'Vor deinem Fenster', foot: 'Deine Zeit. Dein Tempo.', local: 'Ein Ort für dich', thoughts: ['Ein guter Tag beginnt', 'Raum für deine Gedanken', 'Diesen Moment genießen', 'Morgen ist auch noch ein Tag'] },
 es: { brand: 'Un espacio para vivir', edition: 'INICIO / 02', tasks: 'Un poco de atención', tasksNote: 'Un pequeño paso basta para empezar.', outside: 'Al otro lado de tu ventana', foot: 'Tu tiempo. Tu ritmo.', local: 'Un espacio para ti', thoughts: ['Que tengas un buen día', 'Espacio para tus ideas', 'Quédate en este momento', 'Mañana será otro día'] },
 fr: { brand: 'Un peu de place pour vivre', edition: 'ACCUEIL / 02', tasks: 'Un peu d’attention', tasksNote: 'Un petit pas suffit pour commencer.', outside: 'Dehors, à votre fenêtre', foot: 'Votre temps. Votre rythme.', local: 'Un espace à vous', thoughts: ['Que la journée soit douce', 'De la place pour vos idées', 'Profiter de cet instant', 'Demain peut attendre le matin'] },
};
function refresh() {
 const copy = words[getLang()] || words.en;
 document.querySelectorAll('[data-design]').forEach(el => { el.textContent = copy[el.dataset.design]; });
 const hour = new Date().getHours();
 document.querySelector('#thought').textContent = copy.thoughts[hour >= 5 && hour < 11 ? 0 : hour >= 11 && hour < 17 ? 1 : hour >= 17 && hour < 22 ? 2 : 3];
 document.querySelector('#wxDialog').setAttribute('aria-label', t('weather'));
 document.querySelector('.settings-nav').setAttribute('aria-label', t('settings'));
 document.querySelector('#q').setAttribute('aria-label', t('searchWeb'));
 document.querySelector('#bookmarks').setAttribute('aria-label', ({ ru: 'Закладки', en: 'Bookmarks', de: 'Lesezeichen', es: 'Marcadores', fr: 'Favoris' })[getLang()] || 'Bookmarks');
}
document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => {
 document.querySelectorAll('#sMain > section')[+button.dataset.section].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}));
refresh();
on('settings', refresh);
setInterval(() => { if (!document.hidden) refresh(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
