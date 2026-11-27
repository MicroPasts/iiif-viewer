import OpenSeadragon from 'openseadragon';
import { escapeHtml } from './sanitize.js';
import { extractLangValue } from './parser.js';
import { preserveSecureTileUrls } from './iiif-tile-source.js';

function sourceFor(image, resolveUrl) {
  if (image?.infoJsonUrl) return resolveUrl(image.infoJsonUrl, 'image');
  if (image?.staticUrl) return { type: 'image', url: resolveUrl(image.staticUrl, 'image') };
  return null;
}

export class InspectionTools {
  constructor(wrapper, osd, { ruler, curtain, resolveUrl }) {
    this.wrapper = wrapper;
    this.osd = osd;
    this.rulerEnabled = ruler;
    this.curtainEnabled = curtain;
    this.resolveUrl = resolveUrl;
    this.generation = 0;
    this.layers = [];
    this.layersReady = false;
    this.calibrations = new Map();
    this.visible = false;
    this.drawing = false;
    this.host = wrapper.querySelector('[data-el="inspection-tools"]');
    this.toolbar = wrapper.querySelector('[data-el="inspection-buttons"]');
    const panelId = this.host.id;
    this.toolbar.innerHTML = `
      ${ruler ? `<button type="button" data-inspect="ruler" aria-expanded="false" aria-controls="${panelId}-ruler"><span aria-hidden="true">&#x2301;</span> Ruler</button>` : ''}
      ${curtain ? `<button type="button" data-inspect="curtain" aria-expanded="false" aria-controls="${panelId}-curtain"><span aria-hidden="true">&#x25e7;</span> Curtain</button>` : ''}`;
    this.host.innerHTML = `
      <section id="${panelId}-ruler" data-inspect-panel="ruler" class="iiif-inspection-panel" aria-label="Physical ruler" hidden>
        <div class="iiif-inspection-heading"><span class="iiif-inspection-icon" aria-hidden="true">&#x2301;</span><div><strong>Physical ruler</strong><p>Measure at the current zoom level</p></div></div>
        <p data-inspect="scale-status" class="iiif-inspection-status" role="status"></p>
        <div class="iiif-inspection-section">
          <label class="iiif-inspection-field">Millimetres per image pixel <input data-inspect="scale" type="number" min="0" step="any" placeholder="e.g. 0.0171"></label>
          <div class="iiif-inspection-actions"><button type="button" data-inspect="apply-scale" class="iiif-inspection-primary">Apply scale</button><button type="button" data-inspect="reset-scale">Use manifest scale</button></div>
        </div>
        <div class="iiif-inspection-section">
          <strong class="iiif-inspection-label">Calibrate from a known distance</strong>
          <p class="iiif-inspection-help">Draw a line across the image, then enter its known length.</p>
          <button type="button" data-inspect="draw" class="iiif-inspection-wide">Draw calibration line</button>
          <label class="iiif-inspection-field">Line length (mm) <input data-inspect="line-length" type="number" min="0" step="any" placeholder="Enter length"></label>
          <button type="button" data-inspect="apply-line" class="iiif-inspection-primary iiif-inspection-wide">Calibrate from line</button>
        </div>
      </section>
      <section id="${panelId}-curtain" data-inspect-panel="curtain" class="iiif-inspection-panel" aria-label="Image curtain" hidden>
        <div class="iiif-inspection-heading"><span class="iiif-inspection-icon" aria-hidden="true">&#x25e7;</span><div><strong>Image curtain</strong><p>Compare image layers</p></div></div>
        <div class="iiif-inspection-fields">
          <label class="iiif-inspection-field">Compare canvas <select data-inspect="compare"></select></label>
          <label class="iiif-inspection-field">Direction <select data-inspect="orientation"><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option></select></label>
        </div>
        <div class="iiif-inspection-section"><strong class="iiif-inspection-label">Layers</strong><p class="iiif-inspection-help">Show a layer and drag its slider to reveal it.</p><div data-inspect="layers"></div><p data-inspect="layer-status" class="iiif-inspection-help" role="status"></p></div>
      </section>
      <div data-inspect="ruler-display" class="iiif-physical-ruler" hidden aria-label="Physical scale"></div>
      <svg data-inspect="drawing" class="iiif-calibration-drawing" hidden aria-label="Draw calibration line">
        <line stroke="#f59e0b" stroke-width="3"></line>
      </svg>`;
    this.onClick = (event) => this.handleClick(event);
    this.onInput = (event) => this.handleInput(event);
    this.host.addEventListener('click', this.onClick);
    this.toolbar.addEventListener('click', this.onClick);
    this.host.addEventListener('input', this.onInput);
    this.host.addEventListener('change', this.onInput);
    this.onOpen = () => this.imageOpened();
    this.onAnimation = () => this.updateRuler();
    this.onOpenFailed = () => {
      if (this.curtainEnabled) this.host.querySelector('[data-inspect="layer-status"]').textContent = 'Could not load the current image.';
      if (this.rulerEnabled) this.setScaleStatus('Could not load the current image.');
    };
    this.osd.addHandler('open', this.onOpen);
    this.osd.addHandler('open-failed', this.onOpenFailed);
    this.osd.addHandler('animation', this.onAnimation);
    this.osd.addHandler('resize', this.onAnimation);
    this.onKeyDown = (event) => {
      if (event.key === 'Escape' && this.drawing) {
        this.cancelDrawing();
        this.setScaleStatus('Calibration cancelled.');
      }
    };
    this.wrapper.addEventListener('keydown', this.onKeyDown);
    this.drawingElement = this.host.querySelector('[data-inspect="drawing"]');
    this.drawingElement.addEventListener('pointerdown', (event) => this.startLine(event));
    this.drawingElement.addEventListener('pointermove', (event) => this.moveLine(event));
    this.drawingElement.addEventListener('pointerup', (event) => this.finishLine(event));
    this.drawingElement.addEventListener('pointercancel', () => this.cancelDrawing());
  }

  setCanvas(manifest, index) {
    this.generation += 1;
    this.cancelDrawing();
    this.removeLayers();
    this.layersReady = false;
    this.manifest = manifest;
    this.canvas = manifest?.canvases[index];
    this.base = null;
    this.linePixels = null;
    const restoreFocus = this.host.contains(document.activeElement) || this.toolbar.contains(document.activeElement);
    this.host.hidden = !this.canvas || this.canvas.kind !== 'canvas' ||
      !sourceFor(this.canvas.image, this.resolveUrl);
    this.toolbar.hidden = this.host.hidden;
    if (this.host.hidden && restoreFocus) {
      this.wrapper.querySelector('[data-el="viewer-root"]')?.focus();
    }
    this.host.querySelector('[data-inspect="ruler-display"]').hidden = true;
    if (this.host.hidden) return;
    this.millimetersPerPixel = this.calibrations.get(this.canvas) ?? null;
    this.syncScaleStatus();
    if (this.curtainEnabled) {
      const current = this.canvas;
      const choices = manifest.canvases.map((canvas, i) => ({ canvas, i })).filter(({ canvas, i }) =>
        i !== index && canvas.kind === 'canvas' && current.imageCoversCanvas && canvas.imageCoversCanvas &&
        current.canvasWidth > 0 && current.canvasHeight > 0 &&
        canvas.canvasWidth === current.canvasWidth && canvas.canvasHeight === current.canvasHeight &&
        sourceFor(canvas.image, this.resolveUrl));
      this.host.querySelector('[data-inspect="compare"]').innerHTML =
        '<option value="">None</option>' + choices.map(({ canvas, i }) =>
          `<option value="${i}">${escapeHtml(canvas.label)}</option>`).join('');
      this.host.querySelector('[data-inspect="layer-status"]').textContent = 'Waiting for image.';
      this.host.querySelector('[data-inspect="layers"]').innerHTML = '';
    }
  }

  imageOpened() {
    if (!this.canvas || this.host.hidden) return;
    this.base = this.osd.world.getItemAt(0);
    if (!this.base) return;
    this.useManifestScale();
    this.syncScaleStatus();
    this.updateRuler();
    if (this.curtainEnabled) this.loadLayers();
  }

  removeLayers() {
    for (const layer of this.layers) {
      if (layer.item && this.osd.world.getIndexOfItem(layer.item) !== -1) {
        this.osd.world.removeItem(layer.item);
      }
    }
    this.layers = [];
  }

  loadLayers() {
    const generation = ++this.generation;
    this.removeLayers();
    this.layersReady = false;
    const baseSource = this.canvas.image.infoJsonUrl || this.canvas.image.staticUrl;
    const candidates = (this.canvas.imageCoversCanvas ? this.canvas.layers || [] : []).filter((layer) =>
      (layer.infoJsonUrl || layer.staticUrl) !== baseSource);
    const selected = this.host.querySelector('[data-inspect="compare"]').value;
    if (selected !== '') {
      const comparison = this.manifest.canvases[Number(selected)];
      if (comparison) candidates.push({ ...comparison.image, label: comparison.label, comparisonCanvas: comparison });
    }
    const status = this.host.querySelector('[data-inspect="layer-status"]');
    const size = this.base.getContentSize();
    const errors = [];
    const next = (index) => {
      if (generation !== this.generation) return;
      if (index >= candidates.length) {
        this.layersReady = errors.length === 0;
        status.textContent = errors.length ? errors.join(' ') :
          candidates.length ? '' : 'No additional full-canvas images available.';
        this.renderLayers();
        return;
      }
      const candidate = candidates[index];
      const tileSource = sourceFor(candidate, this.resolveUrl);
      this.osd.addTiledImage({
        tileSource,
        opacity: 0,
        success: ({ item }) => {
          if (generation !== this.generation) {
            if (this.osd.world.getIndexOfItem(item) !== -1) this.osd.world.removeItem(item);
            return;
          }
          const otherSize = item.getContentSize();
          if (otherSize.x !== size.x || otherSize.y !== size.y) {
            this.osd.world.removeItem(item);
            errors.push(`Cannot compare ${candidate.label}: image dimensions do not match.`);
            next(index + 1);
            return;
          }
          const bounds = this.base.getBounds(true);
          preserveSecureTileUrls(item, tileSource);
          item.setPosition(bounds.getTopLeft(), true);
          item.setWidth(bounds.width, true);
          item.setOpacity(0);
          this.layers.push({ item, label: candidate.comparisonCanvas?.label || candidate.label,
            image: candidate, rawLabel: candidate.rawLabel, comparisonCanvas: candidate.comparisonCanvas, clip: 1, visible: false });
          next(index + 1);
        },
        error: () => {
          if (generation === this.generation) {
            errors.push(`Could not load comparison image: ${candidate.label}.`);
            next(index + 1);
          }
        },
      });
    };
    status.textContent = candidates.length ? 'Loading comparison images.' : '';
    next(0);
  }

  renderLayers() {
    this.host.querySelector('[data-inspect="layers"]').innerHTML = this.layers.map((layer, i) => `
      <div class="iiif-inspection-layer">
        <div class="iiif-inspection-layer-header">
          <span class="iiif-inspection-layer-name">${escapeHtml(layer.label)}</span>
          <button type="button" data-layer-visibility="${i}" aria-pressed="${layer.visible}" aria-label="${layer.visible ? 'Hide' : 'Show'} ${escapeHtml(layer.label)}">${layer.visible ? 'Hide' : 'Show'}</button>
          <button type="button" data-layer-up="${i}" ${i === this.layers.length - 1 ? 'disabled' : ''} aria-label="Move ${escapeHtml(layer.label)} up">Up</button>
        </div>
        <label class="iiif-inspection-reveal"><span>Reveal</span><input type="range" min="0" max="100" value="${layer.clip * 100}" data-layer-clip="${i}" aria-label="Reveal ${escapeHtml(layer.label)}"></label>
      </div>`).join('');
  }

  applyClips() {
    const horizontal = this.host.querySelector('[data-inspect="orientation"]').value === 'horizontal';
    for (const layer of this.layers) {
      const size = layer.item.getContentSize();
      layer.item.setClip(new OpenSeadragon.Rect(0, 0,
        size.x * (horizontal ? 1 : layer.clip), size.y * (horizontal ? layer.clip : 1)));
    }
  }

  handleClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const action = button.dataset.inspect;
    if (action === 'ruler' || action === 'curtain') {
      const panel = this.host.querySelector(`[data-inspect-panel="${action}"]`);
      const other = action === 'ruler' ? 'curtain' : 'ruler';
      this.host.querySelector(`[data-inspect-panel="${other}"]`).hidden = true;
      this.toolbar.querySelector(`[data-inspect="${other}"]`)?.setAttribute('aria-expanded', 'false');
      if (other === 'ruler') this.cancelDrawing();
      panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded', String(!panel.hidden));
      if (action === 'ruler') {
        this.visible = !panel.hidden;
        if (!this.visible) this.cancelDrawing();
        this.updateRuler();
      }
    } else if (action === 'draw') {
      if (!this.base) return this.setScaleStatus('Wait for the image to load.');
      this.linePixels = null;
      this.drawing = true;
      this.drawingElement.removeAttribute('hidden');
      this.drawingElement.querySelector('line').setAttribute('x1', 0);
      this.drawingElement.querySelector('line').setAttribute('x2', 0);
      this.setScaleStatus('Drag a line across a known distance on the image, or press Escape to cancel.');
    } else if (action === 'apply-scale') {
      this.applyScale(Number(this.host.querySelector('[data-inspect="scale"]').value));
    } else if (action === 'apply-line') {
      const length = Number(this.host.querySelector('[data-inspect="line-length"]').value);
      if (!this.linePixels || !Number.isFinite(length) || length <= 0) {
        return this.setScaleStatus('Draw a non-zero line and enter a positive length.');
      }
      this.applyScale(length / this.linePixels);
    } else if (action === 'reset-scale') {
      this.calibrations.delete(this.canvas);
      this.useManifestScale();
      this.syncScaleStatus();
      this.updateRuler();
    } else if (button.dataset.layerVisibility !== undefined) {
      const layer = this.layers[Number(button.dataset.layerVisibility)];
      layer.visible = !layer.visible;
      layer.item.setOpacity(layer.visible ? 1 : 0);
      this.renderLayers();
      this.host.querySelector(`[data-layer-visibility="${button.dataset.layerVisibility}"]`)?.focus();
    } else if (button.dataset.layerUp !== undefined) {
      const i = Number(button.dataset.layerUp);
      if (i < this.layers.length - 1) {
        [this.layers[i], this.layers[i + 1]] = [this.layers[i + 1], this.layers[i]];
        this.osd.world.setItemIndex(this.layers[i + 1].item, i + 2);
        this.renderLayers();
        this.host.querySelector(`[data-layer-visibility="${i + 1}"]`)?.focus();
      }
    }
  }

  handleInput(event) {
    const input = event.target;
    if (event.type === 'change' && input.dataset.inspect === 'compare' && this.base) this.loadLayers();
    if (input.dataset.inspect === 'orientation' && this.base) this.applyClips();
    if (input.dataset.layerClip !== undefined) {
      const layer = this.layers[Number(input.dataset.layerClip)];
      if (layer) {
        layer.clip = Number(input.value) / 100;
        this.applyClips();
      }
    }
  }

  applyScale(value) {
    if (!Number.isFinite(value) || value <= 0) return this.setScaleStatus('Enter a positive finite scale.');
    this.millimetersPerPixel = value;
    this.calibrations.set(this.canvas, value);
    this.syncScaleStatus();
    this.updateRuler();
  }

  setScaleStatus(message) {
    this.host.querySelector('[data-inspect="scale-status"]').textContent = message;
  }

  syncScaleStatus() {
    this.host.querySelector('[data-inspect="scale"]').value = this.millimetersPerPixel ?? '';
    this.setScaleStatus(this.millimetersPerPixel ? `Scale: ${this.millimetersPerPixel} mm per image pixel.` : 'No physical scale. Calibrate to show a ruler.');
  }

  useManifestScale() {
    if (this.calibrations.has(this.canvas)) {
      this.millimetersPerPixel = this.calibrations.get(this.canvas);
      return;
    }
    this.millimetersPerPixel = null;
    if (!this.base || !this.canvas.imageCoversCanvas || !this.canvas.millimetersPerPixel ||
        !(this.canvas.canvasWidth > 0) || !(this.canvas.canvasHeight > 0)) return;
    const size = this.base.getContentSize();
    const xRatio = this.canvas.canvasWidth / size.x;
    const yRatio = this.canvas.canvasHeight / size.y;
    if (Number.isFinite(xRatio) && xRatio > 0 && Math.abs(xRatio - yRatio) < xRatio * 0.000001) {
      const scale = this.canvas.millimetersPerPixel * xRatio;
      if (Number.isFinite(scale) && scale > 0) this.millimetersPerPixel = scale;
    }
  }

  updateRuler() {
    const display = this.host.querySelector('[data-inspect="ruler-display"]');
    display.hidden = !this.visible || !this.base || !this.millimetersPerPixel || this.host.hidden;
    if (display.hidden) return;
    const a = this.base.imageToViewerElementCoordinates(new OpenSeadragon.Point(0, 0));
    const b = this.base.imageToViewerElementCoordinates(new OpenSeadragon.Point(1, 0));
    const screenPixelsPerImagePixel = Math.hypot(b.x - a.x, b.y - a.y);
    if (!(screenPixelsPerImagePixel > 0)) { display.hidden = true; return; }
    const targetPixels = Math.min(100, Math.max(1, this.host.clientWidth - 32));
    const target = targetPixels * this.millimetersPerPixel / screenPixelsPerImagePixel;
    const magnitude = 10 ** Math.floor(Math.log10(target));
    if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(magnitude) || magnitude <= 0) {
      display.hidden = true;
      this.setScaleStatus('The current scale is outside the displayable range.');
      return;
    }
    const physicalLength = [5, 2, 1].map((n) => n * magnitude).find((n) => n <= target);
    display.style.width = `${physicalLength / this.millimetersPerPixel * screenPixelsPerImagePixel}px`;
    display.textContent = `${Number(physicalLength.toPrecision(3))} mm`;
  }

  linePosition(event) {
    const bounds = this.drawingElement.getBoundingClientRect();
    return new OpenSeadragon.Point(event.clientX - bounds.left, event.clientY - bounds.top);
  }

  startLine(event) {
    if (!this.drawing || event.button !== 0) return;
    this.lineStart = this.linePosition(event);
    this.drawingElement.setPointerCapture(event.pointerId);
    this.moveLine(event);
  }

  moveLine(event) {
    if (!this.lineStart) return;
    const end = this.linePosition(event);
    const line = this.drawingElement.querySelector('line');
    for (const [name, value] of Object.entries({ x1: this.lineStart.x, y1: this.lineStart.y, x2: end.x, y2: end.y })) line.setAttribute(name, value);
  }

  finishLine(event) {
    if (!this.lineStart || !this.base) return;
    const end = this.linePosition(event);
    const startImage = this.base.viewportToImageCoordinates(this.osd.viewport.pointFromPixel(this.lineStart, true), true);
    const endImage = this.base.viewportToImageCoordinates(this.osd.viewport.pointFromPixel(end, true), true);
    const size = this.base.getContentSize();
    const inImage = (point) => point.x >= 0 && point.y >= 0 && point.x <= size.x && point.y <= size.y;
    this.linePixels = inImage(startImage) && inImage(endImage)
      ? Math.hypot(endImage.x - startImage.x, endImage.y - startImage.y)
      : null;
    this.cancelDrawing();
    this.setScaleStatus(this.linePixels > 0 ? `Line: ${this.linePixels.toFixed(2)} image pixels. Enter its length in mm.` : 'Draw a non-zero line within the image.');
  }

  cancelDrawing() {
    this.lineStart = null;
    this.drawing = false;
    this.drawingElement?.setAttribute('hidden', '');
  }

  resetManifest() {
    this.calibrations.clear();
  }

  getVisibleLayers() {
    if (!this.curtainEnabled) return [];
    if (!this.layersReady) return null;
    const horizontal = this.host.querySelector('[data-inspect="orientation"]').value === 'horizontal';
    return this.layers.filter((layer) => layer.visible).map((layer) => ({
      image: layer.image, clip: layer.clip, horizontal,
    }));
  }

  closePanels() {
    for (const panel of this.host.querySelectorAll('[data-inspect-panel]')) panel.hidden = true;
    for (const button of this.toolbar.querySelectorAll('[data-inspect]')) button.setAttribute('aria-expanded', 'false');
    this.cancelDrawing();
  }

  setLanguage(language) {
    for (const canvas of this.manifest?.canvases || []) {
      for (const layer of canvas.layers || []) {
        layer.label = extractLangValue(layer.rawLabel, language) || layer.label;
      }
    }
    for (const option of this.host.querySelectorAll('[data-inspect="compare"] option')) {
      if (option.value !== '') option.textContent = this.manifest.canvases[Number(option.value)].label;
    }
    for (const layer of this.layers) {
      layer.label = layer.comparisonCanvas?.label || extractLangValue(layer.rawLabel, language) || layer.label;
    }
    if (this.curtainEnabled) this.renderLayers();
  }

  destroy() {
    this.generation += 1;
    this.cancelDrawing();
    this.removeLayers();
    this.osd.removeHandler('open', this.onOpen);
    this.osd.removeHandler('open-failed', this.onOpenFailed);
    this.osd.removeHandler('animation', this.onAnimation);
    this.osd.removeHandler('resize', this.onAnimation);
    this.host.removeEventListener('click', this.onClick);
    this.toolbar.removeEventListener('click', this.onClick);
    this.host.removeEventListener('input', this.onInput);
    this.host.removeEventListener('change', this.onInput);
    this.wrapper.removeEventListener('keydown', this.onKeyDown);
    this.host.innerHTML = '';
    this.toolbar.innerHTML = '';
    this.toolbar.hidden = true;
    this.host.hidden = true;
  }
}
