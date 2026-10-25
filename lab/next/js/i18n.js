export const LANGS = { en: 'English', ru: 'Русский', de: 'Deutsch', es: 'Español', fr: 'Français' };

const D = {
  en: {
    newTab: 'New tab', settings: 'Settings', general: 'General', language: 'Language',
    mode: 'Mode', themes: 'Theme', back: 'Back', themeSettings: 'Theme settings', themeSky: 'Sky', themePicture: 'Your picture', skyThemeNote: 'The sun and stars follow today’s real sunrise and sunset at your location.', removePicture: 'Remove', themeDaylight: 'Breathing sky', modeByTheme: 'This theme sets light or dark by itself.', sunLabel: 'Sun', sunSoft: 'Soft disc', sunAtmo: 'Atmospheric', sunSoftNote: 'The soft disc stays all day.', sunAtmoNote: 'Near the horizon a glowing disc and reddish haze; by noon the disc dissolves into the light.', sharpness: 'Disc sharpness', warmth: 'Light strength', horizonHeight: 'Horizon height', fromBottom: '{n}% from bottom', starSky: 'Starry sky', starSame: 'Same as the sun', bearing: 'Looking towards', bearPole: 'Celestial pole', north: 'North', east: 'East', south: 'South', west: 'West', starlight: 'Starlight', starsNote: 'The sun follows the season and your location. Among the stars are the Big Dipper, Orion and the Southern Cross at their real positions.', resetLight: 'Back to soft light', resetDefaults: 'Default settings', themeAuto: 'Auto', themeLight: 'Light', themeDark: 'Dark', themeSun: 'Sun', showSearch: 'Search bar', searchEngine: 'Search engine', engineBrowser: 'Chrome default', searchWeb: 'Search or type a URL', soon: 'soon',
    clock: 'Clock', h24: '24-hour time', seconds: 'Show seconds', clockFx: 'Weather effects on clock',
    weather: 'Weather', showWeather: 'Show weather', units: 'Units', location: 'Location',
    searchCity: 'Search city…', useMyLocation: 'Use my location', locating: 'Locating…',
    locError: 'Location unavailable', noResults: 'Nothing found', setLocation: 'Set location',
    feelsLike: 'Feels like {t}', sunrise: 'Sunrise {t}', sunset: 'Sunset {t}', now: 'Now', tomorrow: 'Tomorrow', hourly: 'Hour by hour', sunriseWord: 'Sunrise', sunsetWord: 'Sunset', daylight: 'Daylight {t}', untilSunset: 'Sunset in {t}', untilSunrise: 'Sunrise in {t}', dur: '{h} h {m} min', humidity: 'Humidity', wind: 'Wind', gusts: 'gusts {v}', pressure: 'Pressure', uv: 'UV index', uvLow: 'Low', uvMod: 'Moderate', uvHigh: 'High', uvVHigh: 'Very high', uvExt: 'Extreme', precipToday: 'Precipitation today', cloudCover: 'Cloud cover', updated: 'updated {t}', weatherSettings: 'Weather settings', loadingWx: 'Loading the forecast…', compass: 'N,NE,E,SE,S,SW,W,NW', unitMs: 'm/s', unitMmHg: 'mmHg', unitMm: 'mm', myLocation: 'My location', notSet: 'Not set',
    upload: 'Upload image', imageUrl: 'or paste an image URL', apply: 'Apply',
    dim: 'Dim', blur: 'Blur',
    data: 'Data', export: 'Export', import: 'Import', importError: 'Could not read this file',
    privacyNote: 'Everything is stored locally in this browser. Weather by Open-Meteo. No analytics, no trackers.',
    today: 'Today', yesterday: 'Yesterday', week: 'Week {n}',
    addTodo: 'Add TODO', welcomeTodo: 'Try Tabula — tick me off when done', bmNewTab: 'Open bookmarks in new tab', todoPlaceholder: 'What needs doing?', moveToToday: 'Move to today',
    delete: 'Delete', edit: 'Edit', close: 'Close', add: 'Add',
    addBookmark: 'Add bookmark', editBookmark: 'Edit bookmark', url: 'Address', title: 'Name',
    icon: 'Icon', iconAuto: 'Site icon', iconEmoji: 'Emoji', iconLetter: 'Letter',
    fetchIcon: 'Fetch icon', fetching: 'Loading…',
    iconHint: 'For a crisp icon Chrome asks for one-time access to this site. Access is revoked right after.',
    save: 'Save', cancel: 'Cancel', invalidUrl: 'Enter a valid address',
    wx0: 'Clear', wx1: 'Mostly clear', wx2: 'Partly cloudy', wx3: 'Overcast', wx45: 'Fog',
    wx51: 'Drizzle', wx56: 'Freezing drizzle', wx61: 'Rain', wx65: 'Heavy rain', wx66: 'Freezing rain',
    wx71: 'Snow', wx77: 'Snow grains', wx80: 'Showers', wx85: 'Snow showers', wx95: 'Thunderstorm', wx96: 'Thunderstorm with hail',
    look: "Look", typeset: "Typography", typeAir: "Airy", typeClassic: "Classic", captions: "Captions around the screen", brandbook: "Brand book →", todoCard: "Cards behind widgets", motto: "Your time. Your pace.", outside: "Outside your window", focusNote: "One small step is enough to begin.", dayLeft: "{n}% of the day ahead", retry: "Try again", wxError: "Weather could not be updated",
    showTodos: "Show tasks", dayOf: "Day {n} of {y}",
  },
  ru: {
    newTab: 'Новая вкладка', settings: 'Настройки', general: 'Основное', language: 'Язык',
    mode: 'Режим', themes: 'Тема', back: 'Назад', themeSettings: 'Настройки темы', themeSky: 'Небо', themePicture: 'Своя картинка', skyThemeNote: 'Солнце и звёзды следуют реальному восходу и закату в вашей локации.', removePicture: 'Убрать', themeDaylight: 'Дыхание неба', modeByTheme: 'Светлый или тёмный режим задаёт сама тема.', sunLabel: 'Солнце', sunSoft: 'Мягкий диск', sunAtmo: 'Атмосферное', sunSoftNote: 'Мягкий диск сохраняется в течение дня.', sunAtmoNote: 'У горизонта — светящийся диск и красноватая дымка. К полудню диск растворяется в заполняющем свете.', sharpness: 'Чёткость диска', warmth: 'Сила света', horizonHeight: 'Высота горизонта', fromBottom: '{n}% от низа', starSky: 'Звёздное небо', starSame: 'Как у солнца', bearing: 'Направление взгляда', bearPole: 'К небесному полюсу', north: 'Север', east: 'Восток', south: 'Юг', west: 'Запад', starlight: 'Свет звёзд', starsNote: 'Солнце следует сезону и вашей локации. Среди звёзд — ковш Большой Медведицы, Орион и Южный Крест с настоящими координатами.', resetLight: 'Вернуть мягкий свет', resetDefaults: 'Настройки по умолчанию', themeAuto: 'Авто', themeLight: 'Светлый', themeDark: 'Тёмный', themeSun: 'По солнцу', showSearch: 'Строка поиска', searchEngine: 'Поисковик', engineBrowser: 'Как в Chrome', searchWeb: 'Поиск или адрес сайта', soon: 'скоро',
    clock: 'Часы', h24: '24-часовой формат', seconds: 'Показывать секунды', clockFx: 'Погодные эффекты на часах',
    weather: 'Погода', showWeather: 'Показывать погоду', units: 'Единицы', location: 'Локация',
    searchCity: 'Найти город…', useMyLocation: 'Определить автоматически', locating: 'Определяю…',
    locError: 'Не удалось определить', noResults: 'Ничего не найдено', setLocation: 'Указать локацию',
    feelsLike: 'Ощущается как {t}', sunrise: 'Восход {t}', sunset: 'Закат {t}', now: 'Сейчас', tomorrow: 'Завтра', hourly: 'По часам', sunriseWord: 'Восход', sunsetWord: 'Закат', daylight: 'Световой день {t}', untilSunset: 'До заката {t}', untilSunrise: 'До восхода {t}', dur: '{h} ч {m} мин', humidity: 'Влажность', wind: 'Ветер', gusts: 'порывы {v}', pressure: 'Давление', uv: 'УФ-индекс', uvLow: 'Низкий', uvMod: 'Умеренный', uvHigh: 'Высокий', uvVHigh: 'Очень высокий', uvExt: 'Экстремальный', precipToday: 'Осадки за день', cloudCover: 'Облачность', updated: 'обновлено {t}', weatherSettings: 'Настройки погоды', loadingWx: 'Загружаю прогноз…', compass: 'С,СВ,В,ЮВ,Ю,ЮЗ,З,СЗ', unitMs: 'м/с', unitMmHg: 'мм рт. ст.', unitMm: 'мм', myLocation: 'Моё местоположение', notSet: 'Не задана',
    upload: 'Загрузить картинку', imageUrl: 'или вставьте ссылку на картинку', apply: 'OK',
    dim: 'Затемнение', blur: 'Размытие',
    data: 'Данные', export: 'Экспорт', import: 'Импорт', importError: 'Не удалось прочитать файл',
    privacyNote: 'Всё хранится локально в браузере. Погода — Open-Meteo. Никакой аналитики и трекеров.',
    today: 'Сегодня', yesterday: 'Вчера', week: 'Неделя {n}',
    addTodo: 'Добавить задачу', welcomeTodo: 'Попробовать Tabula — отметь, когда готово', bmNewTab: 'Закладки в новой вкладке', todoPlaceholder: 'Что нужно сделать?', moveToToday: 'Перенести на сегодня',
    delete: 'Удалить', edit: 'Изменить', close: 'Закрыть', add: 'Добавить',
    addBookmark: 'Новая закладка', editBookmark: 'Закладка', url: 'Адрес', title: 'Название',
    icon: 'Иконка', iconAuto: 'Иконка сайта', iconEmoji: 'Эмодзи', iconLetter: 'Буква',
    fetchIcon: 'Загрузить иконку', fetching: 'Загрузка…',
    iconHint: 'Для чёткой иконки Chrome один раз попросит доступ к этому сайту. Доступ сразу отзывается.',
    save: 'Сохранить', cancel: 'Отмена', invalidUrl: 'Введите корректный адрес',
    wx0: 'Ясно', wx1: 'Преимущественно ясно', wx2: 'Переменная облачность', wx3: 'Пасмурно', wx45: 'Туман',
    wx51: 'Морось', wx56: 'Ледяная морось', wx61: 'Дождь', wx65: 'Сильный дождь', wx66: 'Ледяной дождь',
    wx71: 'Снег', wx77: 'Снежная крупа', wx80: 'Ливень', wx85: 'Снегопад', wx95: 'Гроза', wx96: 'Гроза с градом',
    look: "Вид", typeset: "Типографика", typeAir: "Воздушная", typeClassic: "Классическая", captions: "Подписи по краям", brandbook: "Брендбук →", todoCard: "Подложки у виджетов", motto: "Ваше время. Ваш ритм.", outside: "За вашим окном", focusNote: "Чтобы начать, достаточно маленького шага.", dayLeft: "Впереди {n}% дня", retry: "Повторить", wxError: "Не удалось обновить погоду",
    showTodos: "Показывать задачи", dayOf: "День {n} из {y}",
  },
  de: {
    newTab: 'Neuer Tab', settings: 'Einstellungen', general: 'Allgemein', language: 'Sprache',
    mode: 'Modus', themes: 'Design', back: 'Zurück', themeSettings: 'Design-Einstellungen', themeSky: 'Himmel', themePicture: 'Eigenes Bild', skyThemeNote: 'Sonne und Sterne folgen dem echten Sonnenauf- und -untergang an deinem Ort.', removePicture: 'Entfernen', themeDaylight: 'Atmender Himmel', modeByTheme: 'Dieses Design bestimmt hell oder dunkel selbst.', sunLabel: 'Sonne', sunSoft: 'Weiche Scheibe', sunAtmo: 'Atmosphärisch', sunSoftNote: 'Die weiche Scheibe bleibt den ganzen Tag.', sunAtmoNote: 'Am Horizont eine leuchtende Scheibe und rötlicher Dunst; gegen Mittag löst sich die Scheibe im Licht auf.', sharpness: 'Schärfe der Scheibe', warmth: 'Lichtstärke', horizonHeight: 'Horizonthöhe', fromBottom: '{n} % von unten', starSky: 'Sternenhimmel', starSame: 'Wie bei der Sonne', bearing: 'Blickrichtung', bearPole: 'Himmelspol', north: 'Norden', east: 'Osten', south: 'Süden', west: 'Westen', starlight: 'Sternenlicht', starsNote: 'Die Sonne folgt der Jahreszeit und deinem Ort. Unter den Sternen: Großer Wagen, Orion und Kreuz des Südens an ihren echten Positionen.', resetLight: 'Zurück zum weichen Licht', resetDefaults: 'Standardeinstellungen', themeAuto: 'Auto', themeLight: 'Hell', themeDark: 'Dunkel', themeSun: 'Sonne', showSearch: 'Suchleiste', searchEngine: 'Suchmaschine', engineBrowser: 'Wie in Chrome', searchWeb: 'Suchen oder URL eingeben', soon: 'bald',
    clock: 'Uhr', h24: '24-Stunden-Format', seconds: 'Sekunden anzeigen', clockFx: 'Wettereffekte auf der Uhr',
    weather: 'Wetter', showWeather: 'Wetter anzeigen', units: 'Einheiten', location: 'Ort',
    searchCity: 'Stadt suchen…', useMyLocation: 'Meinen Standort verwenden', locating: 'Standort wird ermittelt…',
    locError: 'Standort nicht verfügbar', noResults: 'Nichts gefunden', setLocation: 'Ort festlegen',
    feelsLike: 'Gefühlt {t}', sunrise: 'Sonnenaufgang {t}', sunset: 'Sonnenuntergang {t}', now: 'Jetzt', tomorrow: 'Morgen', hourly: 'Stündlich', sunriseWord: 'Aufgang', sunsetWord: 'Untergang', daylight: 'Tageslicht {t}', untilSunset: 'Sonnenuntergang in {t}', untilSunrise: 'Sonnenaufgang in {t}', dur: '{h} Std. {m} Min.', humidity: 'Luftfeuchte', wind: 'Wind', gusts: 'Böen {v}', pressure: 'Luftdruck', uv: 'UV-Index', uvLow: 'Niedrig', uvMod: 'Mäßig', uvHigh: 'Hoch', uvVHigh: 'Sehr hoch', uvExt: 'Extrem', precipToday: 'Niederschlag heute', cloudCover: 'Bewölkung', updated: 'aktualisiert {t}', weatherSettings: 'Wettereinstellungen', loadingWx: 'Vorhersage wird geladen…', compass: 'N,NO,O,SO,S,SW,W,NW', unitMs: 'm/s', unitMmHg: 'mmHg', unitMm: 'mm', myLocation: 'Mein Standort', notSet: 'Nicht festgelegt',
    upload: 'Bild hochladen', imageUrl: 'oder Bild-URL einfügen', apply: 'OK',
    dim: 'Abdunkeln', blur: 'Weichzeichnen',
    data: 'Daten', export: 'Exportieren', import: 'Importieren', importError: 'Datei konnte nicht gelesen werden',
    privacyNote: 'Alles wird lokal in diesem Browser gespeichert. Wetter von Open-Meteo. Keine Analyse, keine Tracker.',
    today: 'Heute', yesterday: 'Gestern', week: 'KW {n}',
    addTodo: 'Aufgabe hinzufügen', welcomeTodo: 'Tabula ausprobieren — abhaken, wenn erledigt', bmNewTab: 'Lesezeichen in neuem Tab', todoPlaceholder: 'Was ist zu tun?', moveToToday: 'Auf heute verschieben',
    delete: 'Löschen', edit: 'Bearbeiten', close: 'Schließen', add: 'Hinzufügen',
    addBookmark: 'Lesezeichen hinzufügen', editBookmark: 'Lesezeichen', url: 'Adresse', title: 'Name',
    icon: 'Symbol', iconAuto: 'Website-Symbol', iconEmoji: 'Emoji', iconLetter: 'Buchstabe',
    fetchIcon: 'Symbol laden', fetching: 'Lädt…',
    iconHint: 'Für ein scharfes Symbol fragt Chrome einmalig nach Zugriff auf diese Website. Der Zugriff wird danach sofort entzogen.',
    save: 'Speichern', cancel: 'Abbrechen', invalidUrl: 'Gültige Adresse eingeben',
    wx0: 'Klar', wx1: 'Überwiegend klar', wx2: 'Teilweise bewölkt', wx3: 'Bedeckt', wx45: 'Nebel',
    wx51: 'Nieselregen', wx56: 'Gefrierender Nieselregen', wx61: 'Regen', wx65: 'Starker Regen', wx66: 'Gefrierender Regen',
    wx71: 'Schnee', wx77: 'Schneegriesel', wx80: 'Regenschauer', wx85: 'Schneeschauer', wx95: 'Gewitter', wx96: 'Gewitter mit Hagel',
    look: "Darstellung", typeset: "Typografie", typeAir: "Luftig", typeClassic: "Klassisch", captions: "Beschriftungen am Rand", brandbook: "Markenbuch →", todoCard: "Karten hinter Widgets", motto: "Deine Zeit. Dein Tempo.", outside: "Vor deinem Fenster", focusNote: "Ein kleiner Schritt ist ein guter Anfang.", dayLeft: "Noch {n} % des Tages", retry: "Erneut versuchen", wxError: "Wetter konnte nicht geladen werden",
    showTodos: "Aufgaben anzeigen", dayOf: "Tag {n} von {y}",
  },
  es: {
    newTab: 'Nueva pestaña', settings: 'Ajustes', general: 'General', language: 'Idioma',
    mode: 'Modo', themes: 'Tema', back: 'Atrás', themeSettings: 'Ajustes del tema', themeSky: 'Cielo', themePicture: 'Tu imagen', skyThemeNote: 'El sol y las estrellas siguen el amanecer y el atardecer reales de tu ubicación.', removePicture: 'Quitar', themeDaylight: 'Cielo que respira', modeByTheme: 'Este tema decide por sí mismo entre claro y oscuro.', sunLabel: 'Sol', sunSoft: 'Disco suave', sunAtmo: 'Atmosférico', sunSoftNote: 'El disco suave se mantiene todo el día.', sunAtmoNote: 'Junto al horizonte, un disco brillante y bruma rojiza; hacia el mediodía el disco se disuelve en la luz.', sharpness: 'Nitidez del disco', warmth: 'Intensidad de la luz', horizonHeight: 'Altura del horizonte', fromBottom: '{n} % desde abajo', starSky: 'Cielo estrellado', starSame: 'Igual que el sol', bearing: 'Dirección de la mirada', bearPole: 'Polo celeste', north: 'Norte', east: 'Este', south: 'Sur', west: 'Oeste', starlight: 'Luz de las estrellas', starsNote: 'El sol sigue la estación y tu ubicación. Entre las estrellas: la Osa Mayor, Orión y la Cruz del Sur en sus posiciones reales.', resetLight: 'Volver a la luz suave', resetDefaults: 'Ajustes predeterminados', themeAuto: 'Auto', themeLight: 'Claro', themeDark: 'Oscuro', themeSun: 'Sol', showSearch: 'Barra de búsqueda', searchEngine: 'Buscador', engineBrowser: 'Como en Chrome', searchWeb: 'Busca o escribe una URL', soon: 'pronto',
    clock: 'Reloj', h24: 'Formato 24 horas', seconds: 'Mostrar segundos', clockFx: 'Efectos del tiempo en el reloj',
    weather: 'Tiempo', showWeather: 'Mostrar el tiempo', units: 'Unidades', location: 'Ubicación',
    searchCity: 'Buscar ciudad…', useMyLocation: 'Usar mi ubicación', locating: 'Localizando…',
    locError: 'Ubicación no disponible', noResults: 'Sin resultados', setLocation: 'Elegir ubicación',
    feelsLike: 'Sensación {t}', sunrise: 'Amanecer {t}', sunset: 'Atardecer {t}', now: 'Ahora', tomorrow: 'Mañana', hourly: 'Por horas', sunriseWord: 'Amanecer', sunsetWord: 'Atardecer', daylight: 'Luz del día {t}', untilSunset: 'Atardecer en {t}', untilSunrise: 'Amanecer en {t}', dur: '{h} h {m} min', humidity: 'Humedad', wind: 'Viento', gusts: 'ráfagas {v}', pressure: 'Presión', uv: 'Índice UV', uvLow: 'Bajo', uvMod: 'Moderado', uvHigh: 'Alto', uvVHigh: 'Muy alto', uvExt: 'Extremo', precipToday: 'Precipitación hoy', cloudCover: 'Nubosidad', updated: 'actualizado {t}', weatherSettings: 'Ajustes del tiempo', loadingWx: 'Cargando el pronóstico…', compass: 'N,NE,E,SE,S,SO,O,NO', unitMs: 'm/s', unitMmHg: 'mmHg', unitMm: 'mm', myLocation: 'Mi ubicación', notSet: 'Sin definir',
    upload: 'Subir imagen', imageUrl: 'o pega la URL de una imagen', apply: 'OK',
    dim: 'Oscurecer', blur: 'Desenfocar',
    data: 'Datos', export: 'Exportar', import: 'Importar', importError: 'No se pudo leer el archivo',
    privacyNote: 'Todo se guarda localmente en este navegador. Tiempo de Open-Meteo. Sin analíticas ni rastreadores.',
    today: 'Hoy', yesterday: 'Ayer', week: 'Semana {n}',
    addTodo: 'Añadir tarea', welcomeTodo: 'Probar Tabula: márcame cuando termines', bmNewTab: 'Marcadores en pestaña nueva', todoPlaceholder: '¿Qué hay que hacer?', moveToToday: 'Mover a hoy',
    delete: 'Eliminar', edit: 'Editar', close: 'Cerrar', add: 'Añadir',
    addBookmark: 'Añadir marcador', editBookmark: 'Marcador', url: 'Dirección', title: 'Nombre',
    icon: 'Icono', iconAuto: 'Icono del sitio', iconEmoji: 'Emoji', iconLetter: 'Letra',
    fetchIcon: 'Obtener icono', fetching: 'Cargando…',
    iconHint: 'Para un icono nítido, Chrome pide acceso puntual a este sitio. El acceso se revoca enseguida.',
    save: 'Guardar', cancel: 'Cancelar', invalidUrl: 'Introduce una dirección válida',
    wx0: 'Despejado', wx1: 'Mayormente despejado', wx2: 'Parcialmente nublado', wx3: 'Nublado', wx45: 'Niebla',
    wx51: 'Llovizna', wx56: 'Llovizna helada', wx61: 'Lluvia', wx65: 'Lluvia intensa', wx66: 'Lluvia helada',
    wx71: 'Nieve', wx77: 'Cinarra', wx80: 'Chubascos', wx85: 'Chubascos de nieve', wx95: 'Tormenta', wx96: 'Tormenta con granizo',
    look: "Aspecto", typeset: "Tipografía", typeAir: "Ligera", typeClassic: "Clásica", captions: "Textos en los bordes", brandbook: "Libro de marca →", todoCard: "Tarjetas tras los widgets", motto: "Tu tiempo. Tu ritmo.", outside: "Al otro lado de tu ventana", focusNote: "Un pequeño paso basta para empezar.", dayLeft: "Queda el {n} % del día", retry: "Reintentar", wxError: "No se pudo actualizar el tiempo",
    showTodos: "Mostrar tareas", dayOf: "Día {n} de {y}",
  },
  fr: {
    newTab: 'Nouvel onglet', settings: 'Réglages', general: 'Général', language: 'Langue',
    mode: 'Mode', themes: 'Thème', back: 'Retour', themeSettings: 'Réglages du thème', themeSky: 'Ciel', themePicture: 'Votre image', skyThemeNote: 'Le soleil et les étoiles suivent le vrai lever et coucher du soleil chez vous.', removePicture: 'Retirer', themeDaylight: 'Ciel qui respire', modeByTheme: 'Ce thème choisit lui-même clair ou sombre.', sunLabel: 'Soleil', sunSoft: 'Disque doux', sunAtmo: 'Atmosphérique', sunSoftNote: 'Le disque doux reste toute la journée.', sunAtmoNote: 'Près de l’horizon, un disque lumineux et une brume rougeâtre ; vers midi, le disque se fond dans la lumière.', sharpness: 'Netteté du disque', warmth: 'Intensité de la lumière', horizonHeight: 'Hauteur de l’horizon', fromBottom: '{n} % depuis le bas', starSky: 'Ciel étoilé', starSame: 'Comme pour le soleil', bearing: 'Direction du regard', bearPole: 'Pôle céleste', north: 'Nord', east: 'Est', south: 'Sud', west: 'Ouest', starlight: 'Lumière des étoiles', starsNote: 'Le soleil suit la saison et votre lieu. Parmi les étoiles : la Grande Ourse, Orion et la Croix du Sud à leurs vraies positions.', resetLight: 'Revenir à la lumière douce', resetDefaults: 'Réglages par défaut', themeAuto: 'Auto', themeLight: 'Clair', themeDark: 'Sombre', themeSun: 'Soleil', showSearch: 'Barre de recherche', searchEngine: 'Moteur de recherche', engineBrowser: 'Comme dans Chrome', searchWeb: 'Rechercher ou saisir une URL', soon: 'bientôt',
    clock: 'Horloge', h24: 'Format 24 heures', seconds: 'Afficher les secondes', clockFx: 'Effets météo sur l’horloge',
    weather: 'Météo', showWeather: 'Afficher la météo', units: 'Unités', location: 'Lieu',
    searchCity: 'Rechercher une ville…', useMyLocation: 'Utiliser ma position', locating: 'Localisation…',
    locError: 'Position indisponible', noResults: 'Aucun résultat', setLocation: 'Choisir un lieu',
    feelsLike: 'Ressenti {t}', sunrise: 'Lever {t}', sunset: 'Coucher {t}', now: 'Maintenant', tomorrow: 'Demain', hourly: 'Heure par heure', sunriseWord: 'Lever', sunsetWord: 'Coucher', daylight: 'Durée du jour {t}', untilSunset: 'Coucher dans {t}', untilSunrise: 'Lever dans {t}', dur: '{h} h {m} min', humidity: 'Humidité', wind: 'Vent', gusts: 'rafales {v}', pressure: 'Pression', uv: 'Indice UV', uvLow: 'Faible', uvMod: 'Modéré', uvHigh: 'Élevé', uvVHigh: 'Très élevé', uvExt: 'Extrême', precipToday: 'Précipitations du jour', cloudCover: 'Nébulosité', updated: 'mis à jour {t}', weatherSettings: 'Réglages météo', loadingWx: 'Chargement des prévisions…', compass: 'N,NE,E,SE,S,SO,O,NO', unitMs: 'm/s', unitMmHg: 'mmHg', unitMm: 'mm', myLocation: 'Ma position', notSet: 'Non défini',
    upload: 'Choisir une image', imageUrl: 'ou collez l’URL d’une image', apply: 'OK',
    dim: 'Assombrir', blur: 'Flou',
    data: 'Données', export: 'Exporter', import: 'Importer', importError: 'Impossible de lire ce fichier',
    privacyNote: 'Tout est stocké localement dans ce navigateur. Météo par Open-Meteo. Aucune analyse, aucun traqueur.',
    today: 'Aujourd’hui', yesterday: 'Hier', week: 'Semaine {n}',
    addTodo: 'Ajouter une tâche', welcomeTodo: 'Essayer Tabula — coche-moi une fois fait', bmNewTab: 'Favoris dans un nouvel onglet', todoPlaceholder: 'Que faut-il faire ?', moveToToday: 'Déplacer à aujourd’hui',
    delete: 'Supprimer', edit: 'Modifier', close: 'Fermer', add: 'Ajouter',
    addBookmark: 'Ajouter un favori', editBookmark: 'Favori', url: 'Adresse', title: 'Nom',
    icon: 'Icône', iconAuto: 'Icône du site', iconEmoji: 'Emoji', iconLetter: 'Lettre',
    fetchIcon: 'Récupérer l’icône', fetching: 'Chargement…',
    iconHint: 'Pour une icône nette, Chrome demande un accès ponctuel à ce site. L’accès est retiré aussitôt.',
    save: 'Enregistrer', cancel: 'Annuler', invalidUrl: 'Saisissez une adresse valide',
    wx0: 'Dégagé', wx1: 'Plutôt dégagé', wx2: 'Partiellement nuageux', wx3: 'Couvert', wx45: 'Brouillard',
    wx51: 'Bruine', wx56: 'Bruine verglaçante', wx61: 'Pluie', wx65: 'Forte pluie', wx66: 'Pluie verglaçante',
    wx71: 'Neige', wx77: 'Neige en grains', wx80: 'Averses', wx85: 'Averses de neige', wx95: 'Orage', wx96: 'Orage avec grêle',
    look: "Apparence", typeset: "Typographie", typeAir: "Aérée", typeClassic: "Classique", captions: "Légendes sur les bords", brandbook: "Charte graphique →", todoCard: "Cartes sous les widgets", motto: "Votre temps. Votre rythme.", outside: "Dehors, à votre fenêtre", focusNote: "Un petit pas suffit pour commencer.", dayLeft: "Encore {n} % de la journée", retry: "Réessayer", wxError: "La météo n’a pas pu être actualisée",
    showTodos: "Afficher les tâches", dayOf: "Jour {n} sur {y}",
  },
};

let lang = 'en';

export function detectLang() {
  for (const l of navigator.languages || [navigator.language]) {
    const c = (l || '').slice(0, 2).toLowerCase();
    if (D[c]) return c;
  }
  return 'en';
}

export function setLang(l) {
  lang = D[l] ? l : 'en';
  document.documentElement.lang = lang;
}

export const getLang = () => lang;

export function t(key, vars) {
  let s = D[lang][key] ?? D.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute('aria-label', el.title);
  });
}
