import { normalizeUuid, validUsername, waypointColor } from './checker-data.js';

const tools = {
  skin: { label: 'Java username or UUID', placeholder: 'e.g. Notch', button: 'Find skin', help: 'Look up a player’s current public Java Edition skin.' },
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
    return info;
  }

  function renderSkin(data) {
    const info = playerInfo(data);
    if (!data.skin) {
      info.append(element('p', 'field-help', 'This player has no custom skin set.'));
      result.append(info);
      return;
    }
    const layout = element('div', 'skin-result');
    const preview = element('div', 'skin-texture');
    const image = element('img');
    image.alt = `${data.name} skin texture`;
    image.src = data.skin.url;
    const head = element('canvas', 'skin-head');
    head.width = 64;
    head.height = 64;
    head.setAttribute('role', 'img');
    head.setAttribute('aria-label', `${data.name} skin head`);
    const download = element('a', 'action-button', 'Download skin PNG');
    download.href = data.skin.url;
    download.download = `${data.name}.png`;
    image.addEventListener('load', () => {
      if (disposed) return;
      const context = head.getContext('2d');
      if (!context) return;
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, 64, 64);
      context.drawImage(image, 8, 8, 8, 8, 0, 0, 64, 64);
      const hat = document.createElement('canvas');
      hat.width = hat.height = 8;
      const hatContext = hat.getContext('2d');
      if (hatContext) {
        hatContext.drawImage(image, 40, 8, 8, 8, 0, 0, 8, 8);
        const pixels = hatContext.getImageData(0, 0, 8, 8).data;
        const opaqueLegacyHat = image.naturalHeight === 32 && pixels.every((channel, index) => index % 4 !== 3 || channel >= 128);
        if (!opaqueLegacyHat) context.drawImage(hat, 0, 0, 8, 8, 0, 0, 64, 64);
      }
    });
    image.addEventListener('error', () => {
      if (disposed) return;
      download.removeAttribute('href');
      download.setAttribute('aria-disabled', 'true');
      report('The skin preview could not load. Run the lookup again to retry.', true);
    });
    preview.append(image);
    info.prepend(head);
    info.append(element('p', 'field-help', `${data.skin.model} model · Original PNG from Mojang`), download);
    layout.append(preview, info);
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
    const marker = element('span', 'locator-marker');
    marker.style.backgroundColor = color.hex;
    preview.setAttribute('aria-label', 'Marker color preview');
    preview.append(marker);
    result.append(layout, preview, element('p', 'field-help', 'Default Java Edition color. Teams, /waypoint commands and server plugins can override it.'));
  }

  function renderIgn(data) {
    result.append(element('h2', '', data.name), element('p', `ign-status ${data.registered ? 'is-taken' : 'is-unregistered'}`, data.registered ? 'Taken' : 'Not registered'));
    if (data.registered) {
      result.append(element('p', 'field-help', `This name is registered to ${data.profile.name}.`), copyValue('UUID', data.profile.id));
    } else result.append(element('p', 'field-help', 'No public Java profile found. This does not guarantee the name can be claimed: Mojang may reserve it or hold it in a cooldown.'));
    const time = element('time', 'checker-checked', `Checked ${new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.checkedAt))}`);
    time.dateTime = data.checkedAt;
    result.append(time);
  }

  function render(data) {
    result.replaceChildren();
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
      if (typeof data.registered !== 'boolean' || !validUsername(data.name, 3) || !Number.isFinite(Date.parse(data.checkedAt)) || (data.registered && !normalizeUuid(data.profile?.id))) throw new Error('The lookup returned an invalid response.');
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
    result.replaceChildren();
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
    result.replaceChildren();
    const activeController = new AbortController();
    controller = activeController;
    const active = requestId;
    const timeout = setTimeout(() => activeController.abort(), 20000);
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
  return () => { disposed = true; cancel(); clearTimeout(feedbackTimer); };
}
