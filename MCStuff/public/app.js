const paths = {
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  box: '<path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z"/><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5"/>',
  tools: '<path d="m14.5 6.5 3 3M4 20l5-5M14 3a6 6 0 0 0-6.3 8.1L3.6 15.2a3 3 0 0 0 4.2 4.2l4.1-4.1A6 6 0 0 0 20 9l-4 4-5-5 4-4-1-1Z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};

for (const element of document.querySelectorAll('[data-icon]')) {
  element.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[element.dataset.icon]}</svg>`;
}

const pages = {
  home: { title: 'MCStuff', emptyText: 'No tools added yet.' },
  builder: { title: 'Pack Builder', emptyText: 'This section is empty.' },
  resources: { title: 'Resources', emptyText: 'This section is empty.' },
  tools: { title: 'Tools', emptyText: 'This section is empty.' },
};

const sounds = {
  accent: { type: 'sine', start: 760, end: 580, volume: 0.025, duration: 0.07 },
  category: { type: 'triangle', start: 440, end: 300, volume: 0.018, duration: 0.05 },
};

const root = document.documentElement;
const main = document.querySelector('#main');
const stage = document.querySelector('#page-stage');
const sidebar = document.querySelector('#sidebar');
const navigation = document.querySelector('.navigation');
const indicator = document.querySelector('.nav-indicator');
const navLinks = [...navigation.querySelectorAll('.nav-link')];
const homeLinks = [...document.querySelectorAll('[data-home-link]')];
const themeButtons = [...document.querySelectorAll('[data-theme-option]')];
const themeNames = new Set(themeButtons.map(button => button.dataset.themeOption));
const menuToggle = document.querySelector('#menu-toggle');
const scrim = document.querySelector('#scrim');
const mobileQuery = window.matchMedia('(max-width: 760px)');
let currentPage = null;
let selectedTheme = null;
let audioContext = null;
let soundRequest = 0;

function getPage() {
  const key = window.location.hash.slice(1);
  return Object.hasOwn(pages, key) ? key : 'home';
}

function syncIndicator() {
  const active = navLinks.find(link => link.dataset.page === currentPage);
  navigation.dataset.active = String(Boolean(active));
  if (!active) return;
  indicator.style.height = `${active.offsetHeight}px`;
  indicator.style.transform = `translateY(${active.offsetTop}px)`;
}

function setMenu(open, restoreFocus = false) {
  const expanded = open && mobileQuery.matches;
  document.body.classList.toggle('menu-open', expanded);
  menuToggle.setAttribute('aria-expanded', String(expanded));
  menuToggle.setAttribute('aria-label', expanded ? 'Close menu' : 'Open menu');
  sidebar.inert = mobileQuery.matches && !expanded;
  scrim.hidden = !expanded;
  if (expanded) {
    syncIndicator();
    (sidebar.querySelector('[aria-current="page"]') || sidebar.querySelector('a')).focus();
  } else if (restoreFocus) menuToggle.focus();
}

function showPage(page) {
  const view = document.createElement('div');
  view.className = 'page-view';
  const { title, emptyText } = pages[page];
  view.innerHTML = `<h1>${title}</h1><p class="empty-state">${emptyText}</p>`;
  stage.replaceChildren(view);
}

function render(moveFocus = false) {
  const page = getPage();
  if (page !== currentPage) {
    currentPage = page;
    showPage(page);
    navLinks.forEach(link => {
      const active = link.dataset.page === page;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    homeLinks.forEach(link => {
      if (page === 'home') link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.title = 'MCStuff';
    syncIndicator();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  setMenu(false);
  if (moveFocus) main.focus({ preventScroll: true });
}

function applyTheme(theme, persist = true) {
  selectedTheme = themeNames.has(theme) ? theme : 'green';
  root.dataset.theme = selectedTheme;
  themeButtons.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeOption === selectedTheme));
  });
  if (persist) {
    try { localStorage.setItem('mcstuff-theme', selectedTheme); } catch {}
  }
}

async function playSound(sound) {
  const request = ++soundRequest;
  try {
    if (typeof window.AudioContext !== 'function') return;
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new window.AudioContext();
    }
    if (audioContext.state !== 'running') await audioContext.resume();
    if (request !== soundRequest || audioContext.state !== 'running') return;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = sound.type;
    oscillator.frequency.setValueAtTime(sound.start, now);
    oscillator.frequency.exponentialRampToValueAtTime(sound.end, now + sound.duration - 0.015);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(sound.volume, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + sound.duration - 0.005);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      gain.disconnect();
    }, { once: true });
    oscillator.start(now);
    oscillator.stop(now + sound.duration);
  } catch {}
}

function selectTheme(button) {
  const theme = button.dataset.themeOption;
  if (theme === selectedTheme) return;
  applyTheme(theme);
  void playSound(sounds.accent);
}

themeButtons.forEach(button => button.addEventListener('click', () => selectTheme(button)));
menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true', true));
scrim.addEventListener('click', () => setMenu(false, true));
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView({ block: 'start' });
});
mobileQuery.addEventListener('change', () => { setMenu(false); syncIndicator(); });
window.addEventListener('resize', syncIndicator);
window.addEventListener('hashchange', () => render(true));

document.addEventListener('keydown', event => {
  if (!document.body.classList.contains('menu-open')) return;
  if (event.key === 'Escape') { setMenu(false, true); return; }
  if (event.key !== 'Tab') return;
  const targets = [...sidebar.querySelectorAll('a[href], button'), menuToggle];
  const first = targets[0];
  const last = targets.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

[...new Set([...navLinks, ...homeLinks])].forEach(link => link.addEventListener('click', event => {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const target = link.dataset.homeLink !== undefined ? 'home' : link.dataset.page;
  if (target === currentPage) {
    setMenu(false);
    main.focus({ preventScroll: true });
  } else if (target !== getPage()) void playSound(sounds.category);
}));

applyTheme(root.dataset.theme, false);
render();
