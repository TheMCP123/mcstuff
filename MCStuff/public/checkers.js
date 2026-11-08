import { normalizeUuid, validUsername, waypointColor } from './checker-data.js';
import { createSkinPreview } from './skin-preview.js';

const tools = {
  skin: { label: 'Java username or UUID', placeholder: 'e.g. Notch', button: 'Find skin', help: 'Look up a player’s public Java Edition skin.' },
  waypoint: { label: 'Java username or UUID', placeholder: 'Username or UUID', button: 'Find color', help: 'Default Locator Bar marker color. A UUID can be checked without a network request.' },
  ign: { label: 'Java username', placeholder: '3–16 letters, numbers or underscores', button: 'Check name', help: 'Check whether a public Java Edition profile uses this name.' },
};
const memory = Object.fromEntries(Object.keys(tools).map(key => [key, { input: '', result: null }]));

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountChecker(host, kind) {
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
  input.placeholder = config.placeholder;
  input.maxLength = kind === 'ign' ? 16 : 36;
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
    info.append(element('p', 'field-help', `${data.skin.model} model · Original PNG from Mojang`), download);
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
    preview.setAttribute('aria-label', `Locator Bar marker sizes in ${color.hex}`);
    preview.append(element('div', 'locator-track'));
    for (const [distance, size] of [['Near', 14], ['Mid', 10], ['Far', 6]]) {
      const sample = element('span', 'locator-sample');
      const marker = element('i', 'locator-marker');
      marker.style.backgroundColor = color.hex;
      marker.style.width = marker.style.height = `${size}px`;
      sample.append(marker, element('span', '', distance));
      preview.append(sample);
    }
    result.append(layout, preview, element('p', 'field-help', 'Default Java Edition color. Teams, /waypoint commands and server plugins can override it.'));
  }

  function renderIgn(data) {
    const label = data.verification === 'cached' ? 'Registered (cached)' : data.registered === null ? 'No public profile found' : data.registered ? 'Taken' : 'Not registered';
    result.append(element('h2', '', data.name), element('p', `ign-status ${data.registered ? 'is-taken' : 'is-unregistered'}`, label));
    if (data.registered) {
      result.append(element('p', 'field-help', data.verification === 'cached' ? `PlayerDB last recorded this name as registered to ${data.profile.name}. Live registration could not be confirmed.` : `This name is registered to ${data.profile.name}.`), copyValue('UUID', data.profile.id));
    } else result.append(element('p', 'field-help', data.registered === null ? 'The backup service found no profile. Live Mojang registration could not be confirmed; this is not a guarantee the name can be claimed.' : 'No public Java profile found. This does not guarantee the name can be claimed: Mojang may reserve it or hold it in a cooldown.'));
    if (data.source === 'PlayerDB') {
      const date = data.cachedAt ? ` · ${new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(data.cachedAt))}` : '';
      result.append(element('p', 'field-help', `Source: PlayerDB${date}`));
    }
    const time = element('time', 'checker-checked', `Checked ${new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.checkedAt))}`);
    time.dateTime = data.checkedAt;
    result.append(time);
  }

  function render(data) {
    clearResult();
    ({ skin: renderSkin, waypoint: renderWaypoint, ign: renderIgn })[kind](data);
  }

  async function lookup(value, signal) {
    const uuid = normalizeUuid(value);
    if (kind === 'waypoint' && uuid) return { id: uuid, name: null };
    const route = kind === 'skin' ? 'player' : kind === 'waypoint' ? 'uuid' : 'ign';
    let response;
    try { response = await fetch(`/api/${route}/${encodeURIComponent(value)}`, { signal, credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' } }); }
    catch (error) { if (error.name === 'AbortError') throw error; throw new Error('The lookup service could not be reached. Try again shortly.'); }
    let data;
    try { data = await response.json(); } catch { throw new Error('The lookup service returned an invalid response. Try again shortly.'); }
    if (!response.ok) throw new Error(data.message || 'This lookup could not be completed.');
    if (kind === 'ign') {
      const unconfirmed = data.registered === null && data.verification === 'unconfirmed' && data.source === 'PlayerDB';
      if ((!unconfirmed && typeof data.registered !== 'boolean') || !validUsername(data.name, 3) || !Number.isFinite(Date.parse(data.checkedAt)) || (data.registered && !normalizeUuid(data.profile?.id))) throw new Error('The lookup returned an invalid response.');
    } else if (!normalizeUuid(data.id) || (data.skin && !/^\/api\/skin\/[a-f\d]{64}$/.test(data.skin.url))) throw new Error('The lookup returned an invalid response.');
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
    const valid = kind === 'ign' ? validUsername(value, 3) : Boolean(normalizeUuid(value) || validUsername(value));
    if (!valid) {
      input.setAttribute('aria-invalid', 'true');
      report(kind === 'ign' ? 'Use 3–16 letters, numbers or underscores.' : 'Enter a Java username or a valid UUID.', true);
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
