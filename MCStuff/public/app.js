import { iconMarkup } from './icons.js';
import { mountColorsTool } from './colors-tool.js';
import { setupToolSearch } from './tool-search.js';
import { mountChecker } from './checkers.js';
import { mountPackBuilder } from './pack-builder.js';

for (const element of document.querySelectorAll('[data-icon]')) {
  element.innerHTML = iconMarkup(element.dataset.icon);
}
const pages = {
  home: { title: 'MCStuff' },
  builder: { title: 'Pack Builder' },
  colors: { title: 'Colors & Formatting' },
  skin: { title: 'Skin Stealer' },
  waypoint: { title: 'Waypoint Color' },
  ign: { title: 'IGN Availability' },
};

const sounds = {
  accent: { type: 'sine', start: 760, end: 580, volume: 0.025, duration: 0.07 },
  category: { type: 'triangle', start: 440, end: 300, volume: 0.025, duration: 0.05 },
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
let disposePage = () => {};

function getPage() {
  const key = window.location.hash.slice(1);
  return Object.hasOwn(pages, key) ? key : 'home';
}

function syncIndicator() {
  const active = navLinks.find(link => link.dataset.page === currentPage && !link.hidden);
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
    (sidebar.querySelector('[aria-current="page"]:not([hidden])') || sidebar.querySelector('a')).focus();
  } else if (restoreFocus) menuToggle.focus();
}

function showPage(page) {
  disposePage();
  disposePage = () => {};
  const view = document.createElement('div');
  view.className = 'page-view';
  const { title, emptyText } = pages[page];
  const heading = document.createElement('h1');
  heading.textContent = title;
  view.append(heading);
  if (emptyText) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = emptyText;
    view.append(empty);
  }
  if (page === 'home') {
    const entry = document.createElement('a');
    entry.className = 'tool-entry';
    entry.href = '#colors';
    entry.dataset.page = 'colors';
    entry.innerHTML = '<span><strong>Colors &amp; Formatting</strong><span>MiniMessage, Legacy, HEX &amp; JSON</span></span><span aria-hidden="true">↗</span>';
    view.append(entry);
  }
  stage.replaceChildren(view);
  if (page === 'colors') disposePage = mountColorsTool(view);
  if (page === 'builder') disposePage = mountPackBuilder(view);
  if (['skin', 'waypoint', 'ign'].includes(page)) disposePage = mountChecker(view, page);
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
  const targets = [...sidebar.querySelectorAll('a[href], button, input'), menuToggle].filter(target => !target.hidden && !target.disabled && target.getClientRects().length);
  const first = targets[0];
  const last = targets.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

document.addEventListener('click', event => {
  const link = event.target.closest('a[data-page], a[data-home-link]');
  if (!link) return;
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const target = link.dataset.homeLink !== undefined ? 'home' : link.dataset.page;
  if (target === currentPage) {
    setMenu(false);
    main.focus({ preventScroll: true });
  } else if (target !== getPage()) void playSound(sounds.category);
});

setupToolSearch({ setMenu, mobileQuery, main, syncIndicator });

applyTheme(root.dataset.theme, false);
render();
