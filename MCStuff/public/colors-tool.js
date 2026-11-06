import { MINECRAFT_COLORS, DECORATIONS, OUTPUT_FORMATS, MINIMESSAGE_SNIPPETS, normalizeHex, messageRuns, serializeMessage } from './formatting.js';

const state = { text: 'Hello, Minecraft!', start: '#55FF55', end: '#55FFFF', mode: 'solid', format: 'minimessage', decorations: [] };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function copyButton(code) {
  const button = element('button', 'code-button');
  button.type = 'button';
  button.dataset.copy = code;
  button.setAttribute('aria-label', `Copy ${code}`);
  button.title = 'Copy code';
  button.append(element('code', '', code));
  return button;
}

export function mountColorsTool(host) {
  const content = element('div', 'colors-tool');
  content.innerHTML = `
    <section class="message-builder" aria-labelledby="builder-heading">
      <div class="composer-controls">
        <h2 id="builder-heading">Message builder</h2>
        <label class="field-label" for="message-text">Plain text</label>
        <textarea id="message-text" rows="3" maxlength="2000" spellcheck="false" placeholder="Enter your message"></textarea>
        <div class="control-row">
          <label class="field">Color mode<select id="color-mode"><option value="solid">Single color</option><option value="gradient">Gradient</option></select></label>
          <label class="field">Output format<select id="output-format"></select></label>
        </div>
        <div class="color-controls">
          <div class="color-control"><label class="field-label" for="start-hex">Start color</label><div class="hex-control"><input type="color" id="start-picker" aria-label="Choose start color"><input type="text" id="start-hex" spellcheck="false" maxlength="7" aria-describedby="color-error" placeholder="#55FF55"></div></div>
          <div class="color-control" id="end-control" hidden><label class="field-label" for="end-hex">End color</label><div class="hex-control"><input type="color" id="end-picker" aria-label="Choose end color"><input type="text" id="end-hex" spellcheck="false" maxlength="7" aria-describedby="color-error" placeholder="#55FFFF"></div></div>
        </div>
        <p id="color-error" class="field-error" role="status" hidden>Enter a valid HEX color, such as #55FF55 or #5F5.</p>
        <div class="styles-heading"><span class="field-label">Text styles</span><button class="text-button" type="button" id="reset-styles">Reset styles</button></div>
        <div class="style-controls" role="group" aria-label="Text styles"></div>
        <p class="field-help" id="format-help"></p>
      </div>
      <div class="composer-result">
        <span class="field-label" id="preview-label">Browser preview</span>
        <div class="message-preview" aria-labelledby="preview-label"><span id="preview-text"></span></div>
        <div class="output-heading"><label class="field-label" for="message-output">Result</label><button class="action-button" type="button" id="copy-result">Copy result</button></div>
        <textarea id="message-output" class="code-output" rows="5" readonly spellcheck="false" aria-describedby="format-help"></textarea>
      </div>
    </section>
    <section class="reference-section" aria-labelledby="colors-heading">
      <div class="section-heading"><h2 id="colors-heading">Minecraft colors</h2><span class="field-help">Click a code to copy</span></div>
      <div class="reference-scroll" tabindex="0" role="region" aria-label="Minecraft color codes">
        <table class="reference-table"><thead><tr><th scope="col">Color</th><th scope="col">HEX</th><th scope="col">Legacy</th><th scope="col">MiniMessage</th></tr></thead><tbody id="color-rows"></tbody></table>
      </div>
    </section>
    <section class="reference-section" aria-labelledby="styles-heading">
      <h2 id="styles-heading">Text formatting</h2>
      <div class="reference-scroll" tabindex="0" role="region" aria-label="Text formatting codes">
        <table class="reference-table"><thead><tr><th scope="col">Style</th><th scope="col">Legacy</th><th scope="col">MiniMessage</th></tr></thead><tbody id="style-rows"></tbody></table>
      </div>
      <p class="field-help">Legacy color codes reset styles. The builder reapplies them after each color change. MiniMessage strict mode does not allow &lt;reset&gt;.</p>
    </section>
    <details class="snippet-section"><summary>MiniMessage snippets</summary><div class="snippet-list"></div></details>
    <div class="reference-sources"><a href="https://docs.papermc.io/adventure/minimessage/format/" target="_blank" rel="noopener noreferrer">MiniMessage documentation ↗</a><a href="https://docs.papermc.io/adventure/serializer/legacy/" target="_blank" rel="noopener noreferrer">Legacy documentation ↗</a></div>
    <p class="copy-feedback" role="status" aria-live="polite" hidden></p>`;
  host.append(content);
  const find = selector => content.querySelector(selector);
  const textInput = find('#message-text');
  const modeInput = find('#color-mode');
  const formatInput = find('#output-format');
  const startInput = find('#start-hex');
  const endInput = find('#end-hex');
  const startPicker = find('#start-picker');
  const endPicker = find('#end-picker');
  const output = find('#message-output');
  const preview = find('#preview-text');
  const copyResult = find('#copy-result');
  const feedback = find('.copy-feedback');
  let obfuscationTimer;
  let feedbackTimer;

  textInput.value = state.text;
  modeInput.value = state.mode;
  startInput.value = state.start;
  endInput.value = state.end;
  startPicker.value = state.start.toLowerCase();
  endPicker.value = state.end.toLowerCase();
  for (const format of OUTPUT_FORMATS) {
    const option = element('option', '', format.label);
    option.value = format.id;
    formatInput.append(option);
  }
  formatInput.value = state.format;
  for (const style of DECORATIONS) {
    const button = element('button', `style-button style-${style.key}`, style.short);
    button.type = 'button';
    button.dataset.style = style.key;
    button.setAttribute('aria-label', style.label);
    button.title = style.label;
    button.setAttribute('aria-pressed', String(state.decorations.includes(style.key)));
    find('.style-controls').append(button);
  }

  function notify(message) {
    clearTimeout(feedbackTimer);
    feedback.textContent = message;
    feedback.hidden = false;
    feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 1800);
  }

  async function copy(text, source) {
    if (!text) return;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      if (host.isConnected) notify('Copied to clipboard');
    } catch {
      if (!host.isConnected) return;
      if (source instanceof HTMLTextAreaElement) { source.focus(); source.select(); }
      else {
        const range = document.createRange();
        range.selectNodeContents(source.querySelector('code') || source);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
      notify('Copy is blocked. Copy the selected text manually.');
    }
  }

  for (const color of MINECRAFT_COLORS) {
    const row = document.createElement('tr');
    const nameCell = document.createElement('th');
    nameCell.scope = 'row';
    const useColor = element('button', 'color-name', color.label);
    useColor.type = 'button';
    useColor.setAttribute('aria-label', `Use ${color.label} color`);
    useColor.title = 'Use as start color';
    const swatch = element('span', 'reference-swatch');
    swatch.style.backgroundColor = color.hex;
    useColor.prepend(swatch);
    useColor.addEventListener('click', () => {
      startInput.value = color.hex;
      startPicker.value = color.hex.toLowerCase();
      update();
    });
    nameCell.append(useColor);
    row.append(nameCell);
    for (const codes of [[color.hex], [`&${color.code}`, `§${color.code}`], [`<${color.name}>`]]) {
      const cell = document.createElement('td');
      const group = element('div', 'code-group');
      codes.forEach(code => group.append(copyButton(code)));
      cell.append(group);
      row.append(cell);
    }
    find('#color-rows').append(row);
  }
  for (const style of [...DECORATIONS, { key: 'reset', label: 'Reset', code: 'r' }]) {
    const row = document.createElement('tr');
    const nameCell = element('th', `style-${style.key}`, style.label);
    nameCell.scope = 'row';
    const legacy = document.createElement('td');
    const group = element('div', 'code-group');
    group.append(copyButton(`&${style.code}`), copyButton(`§${style.code}`));
    legacy.append(group);
    const mini = document.createElement('td');
    mini.append(copyButton(`<${style.key}>`));
    row.append(nameCell, legacy, mini);
    find('#style-rows').append(row);
  }
  for (const [title, code, help] of MINIMESSAGE_SNIPPETS) {
    const item = element('div', 'snippet-item');
    item.append(element('h3', '', title), copyButton(code), element('p', 'field-help', help));
    find('.snippet-list').append(item);
  }
  content.addEventListener('click', event => {
    const source = event.target.closest('[data-copy]');
    if (source) void copy(source.dataset.copy, source);
    const styleButton = event.target.closest('[data-style]');
    if (styleButton) {
      const key = styleButton.dataset.style;
      state.decorations = state.decorations.includes(key) ? state.decorations.filter(style => style !== key) : [...state.decorations, key];
      update();
    }
  });

  function update() {
    clearInterval(obfuscationTimer);
    state.text = textInput.value;
    state.mode = modeInput.value;
    state.format = formatInput.value;
    find('#end-control').hidden = state.mode !== 'gradient';
    const start = normalizeHex(startInput.value);
    const end = normalizeHex(endInput.value);
    const invalid = !start || (state.mode === 'gradient' && !end);
    startInput.setAttribute('aria-invalid', String(!start));
    endInput.setAttribute('aria-invalid', String(state.mode === 'gradient' && !end));
    find('#color-error').hidden = !invalid;
    copyResult.disabled = invalid || !state.text;
    find('#format-help').textContent = OUTPUT_FORMATS.find(format => format.id === state.format).help;
    content.querySelectorAll('[data-style]').forEach(button => button.setAttribute('aria-pressed', String(state.decorations.includes(button.dataset.style))));
    if (invalid) { output.value = ''; return; }
    state.start = start;
    if (end) state.end = end;
    startPicker.value = start.toLowerCase();
    if (end) endPicker.value = end.toLowerCase();
    output.value = serializeMessage(state);
    preview.replaceChildren();
    preview.removeAttribute('aria-label');
    preview.className = state.decorations.map(style => `style-${style}`).join(' ');
    if (!state.text) { preview.textContent = 'Your message will appear here'; preview.className = 'preview-placeholder'; return; }
    const runs = messageRuns(state);
    const nodes = runs.map(run => {
      const span = element('span', '', run.text);
      span.style.color = run.color;
      preview.append(span);
      return span;
    });
    if (state.decorations.includes('obfuscated')) {
      preview.setAttribute('aria-label', state.text);
      nodes.forEach(node => node.setAttribute('aria-hidden', 'true'));
      const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      obfuscationTimer = setInterval(() => nodes.forEach((node, index) => {
        if (!/\s/.test(runs[index].text)) node.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      }), 90);
    } else preview.removeAttribute('aria-label');
  }

  for (const input of [textInput, modeInput, formatInput, startInput, endInput]) input.addEventListener('input', update);
  startPicker.addEventListener('input', () => { startInput.value = startPicker.value.toUpperCase(); update(); });
  endPicker.addEventListener('input', () => { endInput.value = endPicker.value.toUpperCase(); update(); });
  for (const input of [startInput, endInput]) input.addEventListener('blur', () => {
    const color = normalizeHex(input.value);
    if (color) { input.value = color; update(); }
  });
  find('#reset-styles').addEventListener('click', () => { state.decorations = []; update(); });
  copyResult.addEventListener('click', () => { void copy(output.value, output); });
  update();
  return () => { clearInterval(obfuscationTimer); clearTimeout(feedbackTimer); };
}
