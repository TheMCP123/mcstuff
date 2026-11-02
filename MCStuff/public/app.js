const paths = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  box: '<path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z"/><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5"/>',
  tools: '<path d="m14.5 6.5 3 3M4 20l5-5M14 3a6 6 0 0 0-6.3 8.1L3.6 15.2a3 3 0 0 0 4.2 4.2l4.1-4.1A6 6 0 0 0 20 9l-4 4-5-5 4-4-1-1Z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};

for (const element of document.querySelectorAll('[data-icon]')) {
  element.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[element.dataset.icon]}</svg>`;
}

const pages = {
  overview: { title: 'Overview', emptyText: 'No tools added yet.' },
  builder: { title: 'Pack Builder', emptyText: 'This section is empty.' },
  resources: { title: 'Resources', emptyText: 'This section is empty.' },
  tools: { title: 'Tools', emptyText: 'This section is empty.' },
};

const main = document.querySelector('#main');
const sidebar = document.querySelector('#sidebar');
const menuToggle = document.querySelector('#menu-toggle');
const scrim = document.querySelector('#scrim');
const mobileQuery = window.matchMedia('(max-width: 760px)');

function setMenu(open, restoreFocus = false) {
  const expanded = open && mobileQuery.matches;
  document.body.classList.toggle('menu-open', expanded);
  menuToggle.setAttribute('aria-expanded', String(expanded));
  menuToggle.setAttribute('aria-label', expanded ? 'Close menu' : 'Open menu');
  sidebar.inert = mobileQuery.matches && !expanded;
  scrim.hidden = !expanded;
  if (expanded) sidebar.querySelector('[aria-current="page"]').focus();
  else if (restoreFocus) menuToggle.focus();
}

function render(moveFocus = false) {
  const key = window.location.hash.slice(1);
  const page = Object.hasOwn(pages, key) ? key : 'overview';
  const { title, emptyText } = pages[page];
  main.innerHTML = `<h1>${title}</h1><p class="empty-state">${emptyText}</p>`;
  document.querySelectorAll('.nav-link').forEach(link => {
    const active = link.dataset.page === page;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = `MCStuff — ${title}`;
  setMenu(false);
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (moveFocus) main.focus({ preventScroll: true });
}

menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true', true));
scrim.addEventListener('click', () => setMenu(false, true));
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView({ block: 'start' });
});
mobileQuery.addEventListener('change', () => setMenu(false));
window.addEventListener('hashchange', () => render(true));
document.addEventListener('keydown', event => {
  if (!document.body.classList.contains('menu-open')) return;
  if (event.key === 'Escape') { setMenu(false, true); return; }
  if (event.key !== 'Tab') return;
  const targets = [...sidebar.querySelectorAll('a[href]'), menuToggle];
  const first = targets[0];
  const last = targets.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
document.querySelectorAll('.sidebar a').forEach(link => link.addEventListener('click', () => {
  if (link.hash === window.location.hash || (link.hash === '#overview' && !window.location.hash)) {
    setMenu(false);
    main.focus({ preventScroll: true });
  }
}));
render();
