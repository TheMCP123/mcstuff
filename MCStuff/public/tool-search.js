import { searchTools } from './tool-catalog.js';

export function setupToolSearch({ setMenu, mobileQuery, main, syncIndicator }) {
  const input = document.querySelector('#tool-query');
  const field = document.querySelector('.tool-search');
  const navigation = document.querySelector('#tool-navigation');
  const links = [...navigation.querySelectorAll('.nav-link')];
  const clear = document.querySelector('#clear-search');
  const empty = document.querySelector('#search-empty');
  const status = document.querySelector('#tool-search-status');
  const animations = new Set();
  let visible = links;

  function animate(element, frames) {
    if (typeof element.animate !== 'function') return;
    const animation = element.animate(frames, { duration: 170, easing: 'cubic-bezier(.2,.75,.25,1)' });
    animations.add(animation);
    animation.finished.catch(() => {}).finally(() => animations.delete(animation));
  }

  function update(animateResults = true) {
    const hasQuery = Boolean(input.value.trim());
    const matches = hasQuery ? searchTools(input.value).map(tool => tool.id) : links.map(link => link.dataset.page);
    const next = matches.map(id => links.find(link => link.dataset.page === id)).filter(Boolean);
    field.dataset.filled = String(Boolean(input.value));
    clear.hidden = !input.value;
    const announcement = hasQuery ? (next.length ? `${next.length} ${next.length === 1 ? 'tool' : 'tools'} found.` : 'No tools found.') : '';
    if (status.textContent !== announcement) status.textContent = announcement;
    if (next.length === visible.length && next.every((link, index) => link === visible[index])) return;

    const positions = new Map(visible.map(link => [link, link.getBoundingClientRect().top]));
    animations.forEach(animation => animation.cancel());
    animations.clear();
    for (const link of links) link.hidden = !next.includes(link);
    navigation.append(...next);
    empty.hidden = Boolean(next.length);
    if (document.activeElement?.hidden) input.focus({ preventScroll: true });
    visible = next;
    syncIndicator();

    if (!animateResults) return;
    for (const link of visible) {
      const previous = positions.get(link);
      const offset = previous === undefined ? 5 : previous - link.getBoundingClientRect().top;
      if (previous === undefined || Math.abs(offset) > .5) animate(link, [{ opacity: previous === undefined ? 0 : 1, transform: `translateY(${offset}px)` }, { opacity: 1, transform: 'translateY(0)' }]);
    }
    if (!next.length) animate(empty, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }]);
  }

  function focusSearch() {
    if (mobileQuery.matches) setMenu(true);
    input.focus({ preventScroll: true });
    input.select();
  }

  function reset() {
    input.value = '';
    update();
    input.focus({ preventScroll: true });
  }

  input.addEventListener('input', () => update());
  clear.addEventListener('click', reset);
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (input.value) reset();
      else if (mobileQuery.matches) setMenu(false, true);
      else main.focus({ preventScroll: true });
    }
    if (event.key === 'Enter') { event.preventDefault(); visible[0]?.click(); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      (event.key === 'ArrowDown' ? visible[0] : visible.at(-1))?.focus();
    }
  });
  navigation.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const index = visible.indexOf(event.target.closest('.nav-link'));
    if (index < 0) return;
    event.preventDefault();
    const next = index + (event.key === 'ArrowDown' ? 1 : -1);
    (visible[next] || input).focus();
  });
  document.querySelector('#mobile-search-toggle').addEventListener('click', focusSearch);
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); focusSearch(); }
  });
  update(false);
}
