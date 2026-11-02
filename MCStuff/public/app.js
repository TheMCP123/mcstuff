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
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let currentPage = null;
let pageAnimations = [];
let themeTransition = null;
let themeWaves = [];
let themeRequest = 0;
let selectedTheme = null;
let requestedTheme = null;

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
  if (!expanded) cancelThemeMotion();
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

function cancelPageAnimations() {
  pageAnimations.forEach(animation => animation.cancel());
  pageAnimations = [];
  stage.querySelectorAll('.page-leaving').forEach(view => view.remove());
}

function cancelThemeMotion() {
  themeTransition?.skipTransition();
  themeWaves.forEach(animation => animation.cancel());
  themeWaves = [];
}

function showPage(page, previous) {
  cancelPageAnimations();
  const outgoing = stage.querySelector('.page-view');
  const incoming = document.createElement('div');
  incoming.className = 'page-view';
  const { title, emptyText } = pages[page];
  incoming.innerHTML = `<h1>${title}</h1><p class="empty-state">${emptyText}</p>`;

  if (!outgoing || motionQuery.matches || typeof incoming.animate !== 'function') {
    stage.replaceChildren(incoming);
    return;
  }

  const order = Object.keys(pages);
  const direction = Math.sign(order.indexOf(page) - order.indexOf(previous)) || 1;
  outgoing.classList.add('page-leaving');
  outgoing.setAttribute('aria-hidden', 'true');
  outgoing.inert = true;
  stage.append(incoming);
  pageAnimations = [
    outgoing.animate([
      { opacity: 1, transform: 'translateX(0)' },
      { opacity: 0, transform: `translateX(${-direction * 18}px)` },
    ], { duration: 180, easing: 'ease-out', fill: 'forwards' }),
    incoming.animate([
      { opacity: 0, transform: `translateX(${direction * 24}px)` },
      { opacity: 1, transform: 'translateX(0)' },
    ], { duration: 300, easing: 'cubic-bezier(.2,.75,.25,1)' }),
  ];
  Promise.allSettled(pageAnimations.map(animation => animation.finished)).then(() => outgoing.remove());
}

function render(moveFocus = false) {
  const page = getPage();
  const previous = currentPage;
  if (page !== previous) {
    cancelThemeMotion();
    currentPage = page;
    showPage(page, previous);
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
    document.title = page === 'home' ? 'MCStuff' : `MCStuff — ${pages[page].title}`;
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

async function selectTheme(button, event) {
  const theme = button.dataset.themeOption;
  if (theme === requestedTheme) return;
  requestedTheme = theme;
  const request = ++themeRequest;
  cancelPageAnimations();
  navigation.classList.add('nav-snap');
  void indicator.offsetHeight;
  navigation.classList.remove('nav-snap');
  cancelThemeMotion();
  root.classList.remove('theme-wave');
  if (motionQuery.matches || typeof document.startViewTransition !== 'function') {
    applyTheme(theme);
    return;
  }

  const rect = button.getBoundingClientRect();
  const x = event.detail ? event.clientX : rect.left + rect.width / 2;
  const y = event.detail ? event.clientY : rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const parts = [
    { name: 'theme-brand', element: document.querySelector('.brand-mark') },
    { name: 'theme-nav', element: navigation.querySelector('.active .nav-content') },
  ].filter(part => part.element).map(part => ({ ...part, rect: part.element.getBoundingClientRect() }));
  let transition;
  try {
    root.classList.add('theme-wave');
    transition = document.startViewTransition(() => {
      if (request === themeRequest) applyTheme(theme);
    });
    themeTransition = transition;
    await transition.ready;
    if (request !== themeRequest) return;
    themeWaves = parts.map(part => root.animate({ clipPath: [
      `circle(0px at ${x - part.rect.left}px ${y - part.rect.top}px)`,
      `circle(${radius}px at ${x - part.rect.left}px ${y - part.rect.top}px)`,
    ] }, {
      duration: 680,
      easing: 'cubic-bezier(.45,0,.25,1)',
      pseudoElement: `::view-transition-new(${part.name})`,
    }));
    await Promise.allSettled([...themeWaves.map(animation => animation.finished), transition.finished]);
  } catch {
    transition?.skipTransition();
    if (request === themeRequest) applyTheme(theme);
  } finally {
    if (request === themeRequest) {
      root.classList.remove('theme-wave');
      themeTransition = null;
      themeWaves = [];
    }
  }
}

themeButtons.forEach(button => button.addEventListener('click', event => selectTheme(button, event)));
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
motionQuery.addEventListener('change', () => {
  if (!motionQuery.matches) return;
  cancelPageAnimations();
  cancelThemeMotion();
});

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

[...new Set([...sidebar.querySelectorAll('a[href]'), ...homeLinks])].forEach(link => link.addEventListener('click', () => {
  const target = link.dataset.homeLink !== undefined ? 'home' : link.dataset.page;
  if (target === currentPage) {
    setMenu(false);
    main.focus({ preventScroll: true });
  }
}));

applyTheme(root.dataset.theme, false);
requestedTheme = selectedTheme;
render();
