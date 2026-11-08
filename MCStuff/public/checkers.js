import { normalizeUuid, validUsername, waypointColor } from './checker-data.js';
import { createSkinPreview } from './skin-preview.js';
import { mountIgnTool } from './ign-tool.js';

const tools = {
  skin: { label: 'Java username or UUID', placeholder: 'Username or UUID', button: 'Find skin', help: '' },
  waypoint: { label: 'Java username or UUID', placeholder: 'Username or UUID', button: 'Find color', help: 'Java Edition Locator Bar · UUID works offline' },
};
const memory = Object.fromEntries(Object.keys(tools).map(key => [key, { input: '', result: null }]));

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountChecker(host, kind) {
  if (kind === 'ign') return mountIgnTool(host, id => {
    memory.skin.input = id;
    memory.skin.result = null;
    window.location.hash = 'skin';
  });
  const config = tools[kind];
  const state = memory[kind];
  const content = element('section', 'checker-tool');
  content.innerHTML = `<form class="checker-form" novalidate><label class="field-label" for="checker-input"></label><div class="checker-input-row"><input type="text" id="checker-input" autocomplete="off" spellcheck="false" aria-describedby="checker-help checker-status"><button type="submit" class="action-button"></button></div><p class="field-help" id="checker-help"></p></form><p class="checker-status" id="checker-status" role="status" hidden></p><div class="checker-result"></div><p class="copy-feedback" role="status" hidden></p>`;
  host.append(content);
  const form = content.querySelector('form');
  const input = content.querySelector('input');
  const submit = form.querySelector('button');
  const status = content.querySelector('#checker-status');
  const result = content.querySelector('.checker-result');
  const feedback = content.querySelector('.copy-feedback');
  content.querySelector('label').textContent = config.label;
  content.querySelector('#checker-help').textContent = config.help;
  content.querySelector('#checker-help').hidden = !config.help;
  input.placeholder = config.placeholder;
  input.maxLength = 36;
  input.value = state.input;
  submit.textContent = config.button;
  let controller;
  let requestId = 0;
  let disposed = false;
  let feedbackTimer;
  let disposePreview = () => {};

  function clearResult() {
    disposePreview();
    disposePreview = () => {};
    result.replaceChildren();
  }

  function report(message, error = false) {
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle('is-error', error);
  }

  function copyValue(label, value) {
    const row = element('div', 'checker-code-row');
    const text = element('code', '', value);
    const button = element('button', 'text-button', `Copy ${label}`);
    button.type = 'button';
    button.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(value);
        if (disposed) return;
        feedback.textContent = 'Copied to clipboard';
      } catch {
        if (disposed) return;
        const range = document.createRange();
        range.selectNodeContents(text);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
        feedback.textContent = 'Copy is blocked. Copy the selected text manually.';
      }
      clearTimeout(feedbackTimer);
      feedback.hidden = false;
      feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 1800);
    });
    row.append(text, button);
    return row;
  }

  function playerInfo(data) {
    const info = element('div', 'checker-player-info');
    info.append(element('h2', '', data.name || 'UUID waypoint'), copyValue('UUID', data.id));
    if (data.source === 'PlayerDB') {
      const date = data.cachedAt ? ` · ${new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(data.cachedAt))}` : '';
      info.append(element('p', 'field-help', `Cached profile via PlayerDB${date}`));
    }
    return info;
  }

  function renderSkin(data) {
    const info = playerInfo(data);
    if (!data.skin) {
      info.append(element('p', 'field-help', 'No custom skin was found in this profile.'));
      result.append(info);
      return;
    }
    const layout = element('div', 'skin-result');
    const preview = createSkinPreview(data);
    disposePreview = preview.dispose;
    const download = element('a', 'action-button', 'Download skin PNG');
    download.href = data.skin.url;
    download.download = `${data.name}.png`;
    preview.element.querySelector('.skin-texture-details img').addEventListener('error', () => {
      if (disposed) return;
      download.removeAttribute('href');
      download.setAttribute('aria-disabled', 'true');
      report('The skin texture could not be loaded. Run the lookup again to retry.', true);
    });
    info.append(element('p', 'field-help', `${data.skin.model} model`), download);
    layout.append(preview.element, info);
    result.append(layout);
  }

  function renderWaypoint(data) {
    const color = waypointColor(data.id);
    const layout = element('div', 'waypoint-result');
    const swatch = element('div', 'waypoint-swatch');
    swatch.style.backgroundColor = color.hex;
    swatch.setAttribute('aria-label', `Waypoint color ${color.hex}`);
    const info = playerInfo(data);
    info.append(copyValue('HEX', color.hex), element('p', 'field-help', `RGB ${color.rgb.join(', ')}`));
    layout.append(swatch, info);
    const preview = element('div', 'locator-preview');
    preview.setAttribute('role', 'img');
    preview.setAttribute('aria-label', `Minecraft Locator Bar with four marker sizes in ${color.hex}`);
    const bar = element('div', 'locator-bar');
    bar.append(element('div', 'locator-track'));
    const labels = element('div', 'locator-labels');
    for (const [index, distance] of ['Near', '', '', 'Far'].entries()) {
      const sample = element('span', 'locator-sample');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 9 9');
      svg.setAttribute('aria-hidden', 'true');
      svg.classList.add('locator-marker');
      const filterId = `waypoint-tint-${index}`;
      const factors = color.rgb.map(channel => channel / 255);
      svg.innerHTML = `<defs><filter id="${filterId}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${factors[0]} 0 0 0 0 0 ${factors[1]} 0 0 0 0 0 ${factors[2]} 0 0 0 0 0 1 0"/></filter></defs><image href="/textures/minecraft/default_${index}.png" width="9" height="9" filter="url(#${filterId})"/>`;
      sample.append(svg);
      bar.append(sample);
      labels.append(element('span', '', distance));
    }
    preview.append(bar, labels);
    result.append(layout, preview, element('p', 'field-help', 'Servers can override the default color.'));
  }

  function render(data) {
    clearResult();
    ({ skin: renderSkin, waypoint: renderWaypoint })[kind](data);
  }

  async function lookup(value, signal) {
    const uuid = normalizeUuid(value);
    if (kind === 'waypoint' && uuid) return { id: uuid, name: null };
    const route = kind === 'skin' ? 'player' : 'uuid';
    let response;
    try { response = await fetch(`/api/${route}/${encodeURIComponent(value)}`, { signal, credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' } }); }
    catch (error) { if (error.name === 'AbortError') throw error; throw new Error('The lookup service could not be reached. Try again shortly.'); }
    let data;
    try { data = await response.json(); } catch { throw new Error('The lookup service returned an invalid response. Try again shortly.'); }
    if (!response.ok) throw new Error(data.message || 'This lookup could not be completed.');
    if (!normalizeUuid(data.id) || (data.skin && !/^\/api\/skin\/[a-f\d]{64}$/.test(data.skin.url))) throw new Error('The lookup returned an invalid response.');
    return data;
  }

  function cancel() {
    requestId++;
    controller?.abort();
    submit.disabled = false;
    submit.textContent = config.button;
    form.removeAttribute('aria-busy');
  }

  input.addEventListener('input', () => {
    cancel();
    state.input = input.value;
    state.result = null;
    clearResult();
    input.removeAttribute('aria-invalid');
    report('');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    cancel();
    const value = input.value.trim();
    const valid = Boolean(normalizeUuid(value) || validUsername(value));
    if (!valid) {
      input.setAttribute('aria-invalid', 'true');
      report('Enter a Java username or a valid UUID.', true);
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    state.input = value;
    state.result = null;
    clearResult();
    const activeController = new AbortController();
    controller = activeController;
    const active = requestId;
    const timeout = setTimeout(() => activeController.abort(), 30000);
    submit.disabled = true;
    submit.textContent = 'Checking…';
    form.setAttribute('aria-busy', 'true');
    report('Looking up player…');
    try {
      const data = await lookup(value, activeController.signal);
      if (disposed || active !== requestId) return;
      state.result = data;
      render(data);
      report('');
    } catch (error) {
      if (disposed || active !== requestId) return;
      report(error.name === 'AbortError' ? 'The lookup timed out. Try again.' : error.message || 'The lookup failed. Try again shortly.', true);
    } finally {
      clearTimeout(timeout);
      if (!disposed && active === requestId) {
        submit.disabled = false;
        submit.textContent = config.button;
        form.removeAttribute('aria-busy');
      }
    }
  });
  if (state.result) render(state.result);
  return () => { disposed = true; cancel(); disposePreview(); clearTimeout(feedbackTimer); };
}
