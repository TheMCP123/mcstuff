export const TOOL_CATALOG = [
  { id: 'colors', title: 'Colors & Formatting', category: 'general', detail: 'MiniMessage, Legacy, HEX & JSON', keywords: 'color colour colors colours format formatting text chat minimessage mini message legacy hex rgb gradient gradients json code codes bold italic underline underlined strikethrough obfuscated style styles decoration palette rainbow bungee bungeecord minecraft цвет цвета цветовые палитра формат форматирование текст градиент градиенты коды жирный курсив' },
  { id: 'builder', title: 'Pack Builder', category: 'general', detail: '', keywords: 'pack packs builder packbuilder modrinth mod mods plugin plugins modpack modpacks minecraft сборка сборки сборок билдер мод моды модпак модпаки плагин плагины' },
  { id: 'skin', title: 'Skin Stealer', category: 'checkers', detail: 'Public Java skins · PNG download', keywords: 'skin skins stealer texture png download player username uuid скин скины скачать игрок' },
  { id: 'waypoint', title: 'Waypoint Color', category: 'checkers', detail: 'Java Locator Bar marker color', keywords: 'waypoint locator marker color colour uuid player цвет метка локатор' },
  { id: 'ign', title: 'IGN Availability', category: 'checkers', detail: 'Java username registration check', keywords: 'ign availability available name names username usernames nickname registration taken registered check bulk batch multiple ник ники имя занят свободен массовая пакетная' },
];

const ignoredWords = new Set('a an the and for to of with in on find search tool tools how и для по на с из как найти инструмент инструменты'.split(' '));
const russianKeys = 'ёйцукенгшщзхъфывапролджэячсмитьбю';
const englishKeys = "`qwertyuiop[]asdfghjkl;'zxcvbnm,.";

function normalize(value) {
  return String(value).normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

// Adjacent swapped letters count as one edit, just like a missing or extra letter.
function editDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

function wordScore(query, word, title) {
  if (query === word) return title ? 100 : 70;
  if (word.startsWith(query)) return title ? 82 : 54;
  if (query.length >= 3 && word.includes(query)) return title ? 64 : 42;
  if (query.length < 3 || word.length < 3 || (query.length === 3 && query[0] !== word[0])) return 0;
  const limit = query.length >= 8 ? 2 : 1;
  if (Math.abs(query.length - word.length) > limit) return 0;
  const distance = editDistance(query, word);
  return distance <= limit ? (title ? 62 : 38) - distance * 10 : 0;
}

function scoreTool(query, tool) {
  const words = query.split(' ').filter(word => !ignoredWords.has(word));
  if (!words.length) return 0;
  const title = normalize(tool.title);
  const titleWords = title.split(' ').filter(word => !ignoredWords.has(word));
  const aliases = normalize(`${tool.category || ''} ${tool.detail || ''} ${tool.keywords || ''}`).split(' ');
  const acronym = titleWords.map(word => word[0]).join('');
  if (words.length === 1 && words[0] === acronym) return 140;
  let score = 0;
  for (const word of words) {
    const match = Math.max(0, ...titleWords.map(token => wordScore(word, token, true)), ...aliases.map(token => wordScore(word, token, false)));
    if (!match) return 0;
    score += match;
  }
  const phrase = words.join(' ');
  if (phrase === titleWords.join(' ')) score += 200;
  else if (title.includes(phrase)) score += 80;
  return score / words.length;
}

export function searchTools(value, catalog = TOOL_CATALOG) {
  const raw = String(value).slice(0, 120);
  if (!raw.trim()) return [...catalog];
  const query = normalize(raw);
  if (!query) return [];
  const variants = [query];
  if (/[а-яё]/i.test(raw)) {
    const corrected = normalize(raw.toLowerCase().replace(/[а-яё]/g, char => englishKeys[russianKeys.indexOf(char)]));
    if (corrected && corrected !== query) variants.push(corrected);
  }
  return catalog.map((tool, index) => ({ tool, index, score: Math.max(...variants.map((variant, i) => scoreTool(variant, tool) * (i ? .9 : 1))) }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(result => result.tool);
}
