import { searchTools } from './tool-catalog.js';

export function setupToolSearch({ navigate, setMenu, mobileQuery, main }) {
  const dialog = document.querySelector('#tool-search');
  const input = document.querySelector('#tool-query');
  const list = document.querySelector('#tool-results');
  const empty = document.querySelector('#search-empty');
  const sidebarTrigger = document.querySelector('#search-toggle');
  const mobileTrigger = document.querySelector('#mobile-search-toggle');
  let matches = [];
  let selected = 0;
  let closeAnimation = null;

  function select(index) {
    selected = matches.length ? (index + matches.length) % matches.length : 0;
    [...list.children].forEach((option, position) => option.setAttribute('aria-selected', String(position === selected)));
    if (matches.length) {
      input.setAttribute('aria-activedescendant', `tool-option-${matches[selected].id}`);
      list.children[selected]?.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }

  function updateResults() {
    matches = searchTools(input.value);
    list.replaceChildren();
    for (const tool of matches) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'search-result';
      option.tabIndex = -1;
      option.id = `tool-option-${tool.id}`;
      option.dataset.tool = tool.id;
      option.setAttribute('role', 'option');
      const text = document.createElement('span');
      const name = document.createElement('span');
      name.className = 'search-result-name';
      name.textContent = tool.title;
      text.append(name);
      if (tool.detail) {
        const detail = document.createElement('span');
        detail.className = 'search-result-detail';
        detail.textContent = tool.detail;
        text.append(detail);
      }
      const arrow = document.createElement('span');
      arrow.className = 'search-result-arrow';
      arrow.textContent = '↗';
      arrow.setAttribute('aria-hidden', 'true');
      option.append(text, arrow);
      list.append(option);
    }
    empty.hidden = Boolean(matches.length);
    select(0);
    if (typeof list.animate === 'function') list.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 130, easing: 'ease-out' });
  }

  function close(restoreFocus = true) {
    if (!dialog.open) return Promise.resolve();
    if (closeAnimation) return closeAnimation.finished.catch(() => {});
    const finish = () => {
      dialog.close();
      document.body.classList.remove('search-open');
      (restoreFocus ? (mobileQuery.matches ? mobileTrigger : sidebarTrigger) : main).focus({ preventScroll: true });
    };
    if (typeof dialog.animate !== 'function') { finish(); return Promise.resolve(); }
    const animation = dialog.animate([{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(-8px) scale(.98)' }], { duration: 120, easing: 'ease-in', fill: 'forwards' });
    closeAnimation = animation;
    return animation.finished.then(() => {
      if (closeAnimation === animation) { finish(); closeAnimation = null; animation.cancel(); }
    }).catch(() => {});
  }

  function open() {
    closeAnimation?.cancel();
    closeAnimation = null;
    if (dialog.open) { input.focus(); return; }
    setMenu(false);
    input.value = '';
    updateResults();
    dialog.showModal();
    document.body.classList.add('search-open');
    input.focus();
  }

  function choose(tool) {
    if (!tool || closeAnimation) return;
    navigate(tool.id);
    void close(false);
  }

  sidebarTrigger.addEventListener('click', open);
  mobileTrigger.addEventListener('click', open);
  document.querySelector('#search-close').addEventListener('click', () => { void close(); });
  input.addEventListener('input', updateResults);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); void close(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); select(selected + (event.key === 'ArrowDown' ? 1 : -1)); }
    if (event.key === 'Enter') { event.preventDefault(); choose(matches[selected]); }
  });
  list.addEventListener('click', event => {
    const option = event.target.closest('[data-tool]');
    if (option) choose(matches.find(tool => tool.id === option.dataset.tool));
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); void close(); });
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) void close();
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); open(); }
  });
}
