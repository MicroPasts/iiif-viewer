function canvasFromManifest(raw, parsed, index) {
  if (!raw || !parsed || raw.type === 'AnnotationPage') return null;
  const canvases = parsed.isV3 ? raw.items : raw.sequences?.[0]?.canvases;
  return Array.isArray(canvases) ? canvases[index] ?? null : null;
}

function valueClass(value) {
  if (value === null) return 'literal';
  return typeof value === 'string' ? 'string' : typeof value === 'number' ? 'number' : 'literal';
}

function treeNode(key, value, ancestors = new Set()) {
  const node = document.createElement('div');
  node.className = 'iiif-json-node';
  const prefix = document.createElement('span');
  prefix.className = 'iiif-json-key';
  prefix.textContent = `${JSON.stringify(key)}: `;
  if (value !== null && typeof value === 'object') {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.append(prefix, document.createTextNode(
      `${Array.isArray(value) ? 'Array' : 'Object'} (${Object.keys(value).length})`));
    details.append(summary);
    if (ancestors.has(value)) {
      summary.append(document.createTextNode(' [circular reference]'));
    } else {
      details.addEventListener('toggle', () => {
        if (!details.open || details.dataset.loaded) return;
        details.dataset.loaded = 'true';
        const children = document.createElement('div');
        children.className = 'iiif-json-children';
        const next = new Set(ancestors);
        next.add(value);
        for (const [childKey, childValue] of Object.entries(value)) {
          children.append(treeNode(childKey, childValue, next));
        }
        details.append(children);
      });
    }
    node.append(details);
  } else {
    const text = document.createElement('span');
    text.className = `iiif-json-${valueClass(value)}`;
    text.textContent = JSON.stringify(value) ?? String(value);
    node.append(prefix, text);
  }
  return node;
}

function highlightJson(json, target) {
  target.replaceChildren();
  const tokens = /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b/g;
  let end = 0;
  for (const match of json.matchAll(tokens)) {
    target.append(document.createTextNode(json.slice(end, match.index)));
    const token = document.createElement('span');
    const value = match[0];
    let next = match.index + value.length;
    while (/\s/.test(json[next] || '')) next++;
    const type = value[0] === '"' ? (json[next] === ':' ? 'key' : 'string')
      : /^-?\d/.test(value) ? 'number' : 'literal';
    token.className = `iiif-json-${type}`;
    token.textContent = value;
    target.append(token);
    end = match.index + value.length;
  }
  target.append(document.createTextNode(json.slice(end)));
}

export class JsonInspector {
  constructor(wrapper) {
    this.wrapper = wrapper;
    this.drawer = wrapper.querySelector('[data-el="json-inspector"]');
    this.toggleButton = wrapper.querySelector('[data-action="toggle-json-inspector"]');
    this.scope = 'manifest';
    this.view = 'tree';
    this.index = 0;
    this.drawer.innerHTML = `
      <header class="iiif-json-header"><strong>IIIF JSON inspector</strong><button type="button" data-json-action="close" aria-label="Close inspector">Close</button></header>
      <div class="iiif-json-controls">
        <label>Resource <select data-json-scope><option value="manifest">Manifest</option><option value="canvas">Current canvas</option></select></label>
        <div role="group" aria-label="JSON view"><button type="button" data-json-view="tree" aria-pressed="true">Tree</button><button type="button" data-json-view="raw" aria-pressed="false">Raw JSON</button></div>
        <div><button type="button" data-json-action="copy">Copy JSON</button><button type="button" data-json-action="download">Download JSON</button></div>
      </div>
      <p data-json-context class="iiif-json-context"></p>
      <p data-json-status role="status" class="iiif-json-status"></p>
      <div data-json-content class="iiif-json-content" tabindex="0"></div>`;
    this.content = this.drawer.querySelector('[data-json-content]');
    this.status = this.drawer.querySelector('[data-json-status]');
    this.onClick = (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.jsonView) {
        this.view = button.dataset.jsonView;
        for (const option of this.drawer.querySelectorAll('[data-json-view]')) {
          option.setAttribute('aria-pressed', String(option === button));
        }
        this.render();
      } else if (button.dataset.jsonAction === 'close') {
        this.toggle(false);
        this.toggleButton.focus();
      } else if (button.dataset.jsonAction === 'copy') {
        this.copy();
      } else if (button.dataset.jsonAction === 'download') {
        this.download();
      }
    };
    this.onChange = (event) => {
      if (!event.target.matches('[data-json-scope]')) return;
      this.scope = event.target.value;
      this.render();
    };
    this.onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        this.toggle(false);
        this.toggleButton.focus();
      }
    };
    this.drawer.addEventListener('click', this.onClick);
    this.drawer.addEventListener('change', this.onChange);
    this.drawer.addEventListener('keydown', this.onKeyDown);
  }

  toggle(open = this.drawer.hidden) {
    this.drawer.hidden = !open;
    this.toggleButton.setAttribute('aria-expanded', String(open));
    if (open) this.render();
  }

  setManifest(raw, parsed) {
    this.raw = raw;
    this.parsed = parsed;
    this.index = 0;
    if (!this.drawer.hidden) this.render();
  }

  setCanvas(index) {
    this.index = index;
    if (this.drawer.hidden) return;
    if (this.scope === 'canvas') this.render();
    else this.updateContext();
  }

  setLanguage() {
    if (!this.drawer.hidden) this.updateContext();
  }

  updateContext() {
    const current = this.parsed?.canvases[this.index];
    this.drawer.querySelector('[data-json-context]').textContent = current
      ? `Current ${current.kind === 'scene' ? 'scene' : 'canvas'} ${this.index + 1} of ${this.parsed.canvases.length}: ${current.label}`
      : 'No manifest loaded.';
  }

  selected() {
    return this.scope === 'manifest' ? this.raw : canvasFromManifest(this.raw, this.parsed, this.index);
  }

  serialize() {
    const value = this.selected();
    if (value == null) {
      this.status.textContent = this.raw && this.scope === 'canvas'
        ? 'No original canvas JSON is available for this resource.'
        : 'Load a manifest to inspect its JSON.';
      return null;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      this.status.textContent = `Unable to serialize JSON: ${error.message}`;
      return null;
    }
  }

  render() {
    this.updateContext();
    this.status.textContent = '';
    this.content.replaceChildren();
    const json = this.serialize();
    for (const button of this.drawer.querySelectorAll('[data-json-action="copy"], [data-json-action="download"]')) {
      button.disabled = json === null;
    }
    if (json === null) return;
    if (this.view === 'tree') {
      const root = treeNode(this.scope === 'manifest' ? 'Manifest' : 'Canvas', this.selected());
      this.content.append(root);
      const details = root.querySelector('details');
      if (details) details.open = true;
    } else {
      const pre = document.createElement('pre');
      highlightJson(json, pre);
      this.content.append(pre);
    }
  }

  async copy() {
    const json = this.serialize();
    if (json === null) return;
    try {
      await navigator.clipboard.writeText(json);
      this.status.textContent = 'JSON copied.';
    } catch (error) {
      this.status.textContent = `Could not copy JSON: ${error.message}`;
    }
  }

  download() {
    const json = this.serialize();
    if (json === null) return;
    let url;
    try {
      url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = this.scope === 'manifest' ? 'manifest.json' : `canvas-${this.index + 1}.json`;
      link.click();
      this.status.textContent = 'JSON download started.';
    } catch (error) {
      this.status.textContent = `Could not download JSON: ${error.message}`;
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  destroy() {
    this.drawer.removeEventListener('click', this.onClick);
    this.drawer.removeEventListener('change', this.onChange);
    this.drawer.removeEventListener('keydown', this.onKeyDown);
  }
}
