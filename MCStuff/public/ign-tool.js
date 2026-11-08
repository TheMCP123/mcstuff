import { IGN_LIMIT, parseIgnNames, validateIgnResult, ignStatus, runIgnBatch, ignResultsText } from './ign-data.js';

const memory = { mode: 'single', single: '', bulk: '', rows: [] };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountIgnTool(host, openSkin) {
  const content = element('section', 'checker-tool ign-tool');
  content.innerHTML = `<form class="ign-form" novalidate>
    <div class="ign-mode" role="group" aria-label="Check mode"><button type="button" data-mode="single">Single</button><button type="button" data-mode="bulk">Bulk</button></div>
    <label class="field-label" id="ign-label" for="checker-input">Java username</label>
    <div class="checker-input-row"><input id="checker-input" type="text" maxlength="64" autocomplete="off" spellcheck="false" placeholder="Username" aria-describedby="ign-validation ign-count checker-status"><button type="submit" class="action-button">Check name</button></div>
    <textarea id="checker-names" rows="4" maxlength="4096" autocomplete="off" spellcheck="false" placeholder="Notch&#10;Dinnerbone&#10;YourName" aria-describedby="ign-validation ign-count checker-status" hidden></textarea>
    <div class="ign-input-meta"><span id="ign-validation" role="status"></span><span id="ign-count"></span></div>
    <div class="ign-bulk-actions" hidden><button type="submit" class="action-button">Check names</button></div>
    <button type="button" class="text-button ign-stop" hidden>Stop checking</button>
  </form>
  <p id="checker-status" class="checker-status" role="status" hidden></p>
  <div class="ign-results" hidden><div class="ign-results-heading"><span class="field-label"></span><button type="button" class="text-button ign-copy">Copy results</button></div><ol class="ign-results-list"></ol></div>
  <p class="copy-feedback" role="status" hidden></p>`;
  host.append(content);
  const form = content.querySelector('form');
  const single = content.querySelector('#checker-input');
  const bulk = content.querySelector('#checker-names');
  const modeButtons = [...content.querySelectorAll('[data-mode]')];
  const buttons = [...content.querySelectorAll('[type="submit"]')];
  const stop = content.querySelector('.ign-stop');
  const validation = content.querySelector('#ign-validation');
  const count = content.querySelector('#ign-count');
  const status = content.querySelector('#checker-status');
  const results = content.querySelector('.ign-results');
  const list = content.querySelector('ol');
  const copyAll = content.querySelector('.ign-copy');
  const feedback = content.querySelector('.copy-feedback');
  let controller;
  let runId = 0;
  let disposed = false;
  let running = false;
  let feedbackTimer;
  single.value = memory.single;
  bulk.value = memory.bulk;

  function currentInput() { return memory.mode === 'bulk' ? bulk : single; }
  function report(text) { status.textContent = text; status.hidden = !text; }
  function setBusy(value) {
    running = value;
    form.setAttribute('aria-busy', String(value));
    buttons.forEach(button => { button.disabled = value; });
    stop.hidden = !value;
  }
  function cancel() {
    runId++;
    controller?.abort();
    memory.rows = memory.rows.map(row => ['queued', 'checking'].includes(row.phase) ? { name: row.name, phase: 'cancelled' } : row);
    setBusy(false);
  }
  function validate() {
    const value = currentInput().value;
    const parsed = parseIgnNames(value, memory.mode === 'bulk');
    validation.textContent = parsed.error || (memory.mode === 'bulk' ? `One name per line, or separated by commas.${parsed.duplicates ? ' Duplicates removed.' : ''}` : '3–16 letters, numbers or underscores');
    validation.classList.toggle('is-error', Boolean(parsed.error));
    currentInput().setAttribute('aria-invalid', String(Boolean(parsed.error)));
    count.textContent = memory.mode === 'bulk' ? `${parsed.names.length} / ${IGN_LIMIT} names` : `${value.trim().length} / 16`;
    buttons.forEach(button => { button.disabled = running || Boolean(parsed.error) || !parsed.names.length; });
    return parsed;
  }
  async function copy(value, source) {
    try {
      if (!navigator.clipboard) throw new Error('Unavailable');
      await navigator.clipboard.writeText(value);
      if (disposed) return;
      feedback.textContent = 'Copied to clipboard';
    } catch {
      if (disposed) return;
      const manual = element('textarea', 'ign-manual-copy');
      manual.value = value;
      manual.readOnly = true;
      manual.setAttribute('aria-label', 'Results to copy');
      source.append(manual);
      manual.focus();
      manual.select();
      feedback.textContent = 'Copy the selected text manually.';
      manual.addEventListener('blur', () => manual.remove(), { once: true });
    }
    clearTimeout(feedbackTimer);
    feedback.hidden = false;
    feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 1800);
  }
  function renderRows() {
    results.hidden = !memory.rows.length;
    results.classList.toggle('is-single', memory.mode === 'single');
    const complete = memory.rows.filter(row => ['complete', 'error'].includes(row.phase)).length;
    content.querySelector('.ign-results-heading .field-label').textContent = memory.mode === 'bulk' ? `${complete} / ${memory.rows.length} checked` : 'Result';
    copyAll.disabled = running || !memory.rows.some(row => row.phase === 'complete');
    list.replaceChildren();
    for (const row of memory.rows) {
      const item = element('li', 'ign-result-row');
      const info = element('div', 'ign-result-info');
      const heading = element('div', 'ign-result-title');
      heading.append(element('h2', '', row.data?.profile?.name || row.name));
      const state = row.phase === 'complete' ? ignStatus(row.data) : { label: { queued: 'Queued', checking: 'Checking…', error: 'Could not check', cancelled: 'Not checked' }[row.phase], tone: row.phase, note: row.message || '' };
      heading.append(element('span', `ign-badge is-${state.tone}`, state.label));
      info.append(heading);
      if (state.note) info.append(element('p', 'field-help', state.note));
      if (row.data) {
        const metadata = element('div', 'ign-result-meta');
        metadata.append(element('span', '', row.data.source));
        if (row.data.cachedAt) {
          const cached = element('time', '', `Cached ${new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(row.data.cachedAt))}`);
          cached.dateTime = row.data.cachedAt;
          metadata.append(cached);
        }
        const checked = element('time', '', `Checked ${new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(new Date(row.data.checkedAt))}`);
        checked.dateTime = row.data.checkedAt;
        metadata.append(checked);
        info.append(metadata);
        if (row.data.profile) {
          const uuidRow = element('div', 'checker-code-row');
          const uuid = element('code', '', row.data.profile.id);
          const copyUuid = element('button', 'text-button', 'Copy UUID');
          copyUuid.type = 'button';
          copyUuid.addEventListener('click', () => copy(row.data.profile.id, item));
          uuidRow.append(uuid, copyUuid);
          info.append(uuidRow);
          const view = element('button', 'text-button ign-view-skin', 'View skin');
          view.type = 'button';
          view.addEventListener('click', () => openSkin(row.data.profile.id));
          info.append(view);
        }
      }
      item.append(info);
      list.append(item);
    }
  }
  function switchMode(mode, focus = false) {
    memory.mode = mode;
    modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    single.closest('.checker-input-row').hidden = mode === 'bulk';
    bulk.hidden = mode !== 'bulk';
    content.querySelector('.ign-bulk-actions').hidden = mode !== 'bulk';
    const label = content.querySelector('#ign-label');
    label.htmlFor = mode === 'bulk' ? 'checker-names' : 'checker-input';
    label.textContent = mode === 'bulk' ? 'Java usernames' : 'Java username';
    validate();
    renderRows();
    if (focus) currentInput().focus();
  }
  modeButtons.forEach(button => button.addEventListener('click', () => {
    if (memory.mode === button.dataset.mode) return;
    cancel();
    memory.rows = [];
    report('');
    switchMode(button.dataset.mode, true);
  }));
  for (const input of [single, bulk]) input.addEventListener('input', () => {
    cancel();
    memory[input === single ? 'single' : 'bulk'] = input.value;
    memory.rows = [];
    report('');
    validate();
    renderRows();
  });
  stop.addEventListener('click', () => { cancel(); validate(); renderRows(); report('Check stopped.'); });
  copyAll.addEventListener('click', () => copy(ignResultsText(memory.rows), results));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const { names, error } = validate();
    if (running || error || !names.length) return;
    cancel();
    const active = runId;
    controller = new AbortController();
    setBusy(true);
    report('');
    await runIgnBatch(names, async (name, signal) => {
      const timeout = AbortSignal.timeout(30000);
      let response;
      try { response = await fetch(`/api/ign/${encodeURIComponent(name)}`, { signal: AbortSignal.any([signal, timeout]), credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' } }); }
      catch (error) {
        if (signal.aborted) throw error;
        throw new Error(timeout.aborted ? 'Lookup timed out. Try again.' : 'The lookup service could not be reached. Try again.');
      }
      let data;
      try { data = await response.json(); } catch { throw new Error('Invalid service response. Try again.'); }
      if (!response.ok) { const failure = new Error(data.message || 'Lookup failed. Try again.'); failure.status = response.status; throw failure; }
      if (!validateIgnResult(data, name)) throw new Error('Invalid profile response. Try again.');
      return data;
    }, { signal: controller.signal, onChange(rows) { if (!disposed && active === runId) { memory.rows = rows; renderRows(); } } });
    if (!disposed && active === runId) {
      setBusy(false);
      validate();
      renderRows();
      report(memory.rows.some(row => row.phase === 'error' && /rate limit/i.test(row.message)) ? 'Rate limited. Wait a minute before checking again.' : '');
    }
  });
  switchMode(memory.mode);
  return () => { disposed = true; cancel(); clearTimeout(feedbackTimer); };
}
