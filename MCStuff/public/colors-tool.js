import { MINECRAFT_COLORS, DECORATIONS, MINIMESSAGE_SNIPPETS } from './formatting.js';

const FORMAT_REFERENCE = [
  ['MiniMessage', ['<green><bold>Text</bold></green>'], 'Close nested tags in reverse order.'],
  ['Legacy', ['&a&lText&r', '§a§lText§r'], '16 colors. A color code resets previous text styles.'],
  ['HEX', ['&#22C55EText', '§#22C55EText'], 'Requires a plugin that supports this RGB syntax.'],
  ['BungeeCord HEX', ['&x&2&2&C&5&5&EText', '§x§2§2§C§5§5§EText'], 'Each of the six HEX digits has its own prefix.'],
  ['JSON (Java)', ['{"text":"Text","color":"#22C55E","bold":true}'], 'For fields accepting Java text components.'],
];

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

function codeCell(codes) {
  const cell = element('td');
  const group = element('div', 'code-group');
  for (const code of codes) group.append(copyButton(code));
  cell.append(group);
  return cell;
}

export function mountColorsTool(host) {
  const content = element('div', 'colors-tool');
  content.innerHTML = `
    <section class="reference-section" aria-labelledby="colors-heading">
      <h2 id="colors-heading">Minecraft colors</h2>
      <div class="reference-scroll" tabindex="0" role="region" aria-label="Minecraft color codes">
        <table class="reference-table"><thead><tr><th scope="col">Color</th><th scope="col">HEX</th><th scope="col">Legacy</th><th scope="col">MiniMessage</th></tr></thead><tbody id="color-rows"></tbody></table>
      </div>
    </section>
    <section class="reference-section" aria-labelledby="formatting-heading">
      <h2 id="formatting-heading">Text formatting</h2>
      <div class="reference-scroll" tabindex="0" role="region" aria-label="Text formatting codes">
        <table class="reference-table"><thead><tr><th scope="col">Style</th><th scope="col">Legacy</th><th scope="col">MiniMessage</th></tr></thead><tbody id="style-rows"></tbody></table>
      </div>
      <p class="field-help">Legacy colors reset styles. &lt;reset&gt; is not allowed in strict MiniMessage.</p>
    </section>
    <section class="reference-section" aria-labelledby="syntax-heading">
      <h2 id="syntax-heading">Format syntax</h2>
      <p class="reference-note">Use the format supported by your plugin or config field.</p>
      <div class="format-reference"></div>
    </section>
    <section class="reference-section" aria-labelledby="snippets-heading">
      <h2 id="snippets-heading">MiniMessage examples</h2>
      <div class="snippet-list"></div>
    </section>
    <div class="reference-sources"><a href="https://docs.papermc.io/adventure/minimessage/format/" target="_blank" rel="noopener noreferrer">MiniMessage documentation ↗</a><a href="https://docs.papermc.io/adventure/serializer/legacy/" target="_blank" rel="noopener noreferrer">Legacy documentation ↗</a></div>
    <p class="copy-feedback" role="status" aria-live="polite" hidden></p>`;
  host.append(content);
  const find = selector => content.querySelector(selector);
  const feedback = find('.copy-feedback');
  let feedbackTimer;
  let disposed = false;

  for (const color of MINECRAFT_COLORS) {
    const row = element('tr');
    const name = element('th');
    name.scope = 'row';
    const label = element('span', 'color-name');
    const swatch = element('span', 'reference-swatch');
    swatch.style.backgroundColor = color.hex;
    swatch.setAttribute('aria-hidden', 'true');
    label.append(swatch, element('span', '', color.label));
    name.append(label);
    row.append(name, codeCell([color.hex]), codeCell([`&${color.code}`, `§${color.code}`]), codeCell([`<${color.name}>`]));
    find('#color-rows').append(row);
  }

  for (const style of [...DECORATIONS, { key: 'reset', label: 'Reset', code: 'r' }]) {
    const row = element('tr');
    const name = element('th', `style-${style.key}`, style.label);
    name.scope = 'row';
    row.append(name, codeCell([`&${style.code}`, `§${style.code}`]), codeCell(style.key === 'reset' ? ['<reset>'] : [`<${style.key}>`, `</${style.key}>`]));
    find('#style-rows').append(row);
  }

  for (const [title, codes, help] of FORMAT_REFERENCE) {
    const item = element('article', 'syntax-item');
    item.append(element('h3', '', title));
    for (const code of codes) item.append(copyButton(code));
    item.append(element('p', 'field-help', help));
    find('.format-reference').append(item);
  }

  for (const [title, code, help] of MINIMESSAGE_SNIPPETS) {
    const item = element('article', 'snippet-item');
    item.append(element('h3', '', title), copyButton(code), element('p', 'field-help', help));
    find('.snippet-list').append(item);
  }

  function notify(message) {
    clearTimeout(feedbackTimer);
    feedback.textContent = message;
    feedback.hidden = false;
    feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 1800);
  }

  content.addEventListener('click', async event => {
    const source = event.target.closest('[data-copy]');
    if (!source) return;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(source.dataset.copy);
      if (!disposed) notify('Copied to clipboard');
    } catch {
      if (disposed) return;
      const range = document.createRange();
      range.selectNodeContents(source.querySelector('code'));
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      notify('Copy is blocked. Copy the selected text manually.');
    }
  });
  return () => { disposed = true; clearTimeout(feedbackTimer); };
}
