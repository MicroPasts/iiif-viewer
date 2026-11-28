import OpenSeadragon from 'openseadragon';
import { OsdController } from './osd-controller.js';
import { ManifestSearchController } from './search-controller.js';
import { parseIIIFManifest, extractLangValue, parseAnnotationItems, normalizeNavPlace } from './parser.js';
import { MediaStage } from './media-stage.js';

export class SideBySide {
  constructor(viewer) {
    this.viewer = viewer;
    this.host = viewer.wrapper.querySelector('[data-el="secondary-pane"]');
    this.stage = viewer.wrapper.querySelector('[data-el="comparison-stage"]');
    this.primary = viewer.wrapper.querySelector('[data-el="primary-pane"]');
    this.abort = new AbortController();
    this.generation = 0;
    this.syncEnabled = true;
    this.activePane = 'primary';
    const { signal } = this.abort;
    const settingsId = `${this.host.id}-settings`;

    this.host.innerHTML = `
      <div class="iiif-compare-header">
        <strong class="iiif-compare-heading">Secondary</strong>
        <div class="iiif-compare-actions" role="group" aria-label="Comparison controls">
          <button type="button" data-compare="sync" aria-pressed="true">Sync View</button>
          <button type="button" data-compare="settings" aria-expanded="false" aria-controls="${settingsId}">Comparison settings</button>
          <button type="button" data-compare="close">Close Split</button>
        </div>
      </div>
      <div class="iiif-compare-error" data-compare="error" role="alert"></div>
      <div class="iiif-compare-view relative flex-1 min-h-0 min-w-0">
        <div data-compare="osd" class="w-full h-full"></div>
        <div data-compare="scene" class="hidden w-full h-full overflow-hidden"></div>
        <div data-compare="media" class="iiif-media-stage hidden"></div>
        <section id="${settingsId}" data-compare="settings-panel" class="iiif-compare-settings" aria-label="Comparison settings" hidden>
          <div class="iiif-compare-settings-heading">
            <strong>Comparison settings</strong>
            <button type="button" data-compare="dismiss-settings" aria-label="Close comparison settings">&times;</button>
          </div>
          <label class="iiif-compare-selection">Secondary canvas <select data-compare="canvas" aria-label="Secondary canvas"></select></label>
          <button type="button" data-compare="swap">Swap Panes</button>
          ${viewer.options.showUrlInput ? `<details class="iiif-compare-manifest"><summary>Secondary manifest</summary><form data-compare="manifest-form">
            <input type="url" required aria-label="Secondary manifest URL" placeholder="https://example.org/manifest.json">
            <button type="submit">Load</button></form></details>` : ''}
          <button type="button" data-compare="reset">Use primary manifest</button>
        </section>
      </div>`;
    this.host.hidden = false;
    this.stage.classList.add('is-comparing');
    this.search = new ManifestSearchController({
      resolveUrl: (url, type) => viewer.resolveUrl(url, type),
      fetchOptions: viewer.options.fetchOptions,
    });
    this.osd = new OsdController(this.host.querySelector('[data-compare="osd"]'), {
      onTransformChange: () => { if (this.activePane === 'secondary') viewer.syncTransformUI(); },
      onAnnotationClick: () => {
        this.setActivePane('secondary');
        if (viewer.sidebar.availableTabs.includes('annotations')) {
          viewer.sidebar.setOpen(true);
          viewer.sidebar.setTab('annotations');
        }
      },
    });
    const activatePrimary = (event) => {
      if (event.target.closest('[data-el="osd-container"], [data-el="scene-container"], [data-el="media-container"]')) this.setActivePane('primary');
    };
    this.primary.addEventListener('pointerdown', activatePrimary, { signal });
    this.primary.addEventListener('focusin', activatePrimary, { signal });
    this.host.addEventListener('pointerdown', () => this.setActivePane('secondary'), { signal });
    this.host.addEventListener('focusin', () => this.setActivePane('secondary'), { signal });
    this.host.addEventListener('change', (event) => {
      if (event.target.matches('[data-compare="canvas"]')) this.selectCanvas(Number(event.target.value));
    }, { signal });
    this.host.addEventListener('click', (event) => {
      const action = event.target.closest('[data-compare]')?.dataset.compare;
      if (action === 'close') viewer.exitSideBySide();
      if (action === 'settings') this.setSettingsOpen(this.settingsPanel.hidden);
      if (action === 'dismiss-settings') this.setSettingsOpen(false, true);
      if (action === 'reset') this.usePrimary();
      if (action === 'swap') this.swap();
      if (action === 'sync') {
        this.syncEnabled = !this.syncEnabled;
        this.updateSync();
        if (this.syncEnabled) this.synchronize(this.activePane);
      }
    }, { signal });
    this.settingsPanel = this.host.querySelector('[data-compare="settings-panel"]');
    this.settingsButton = this.host.querySelector('[data-compare="settings"]');
    this.host.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.settingsPanel.hidden && this.settingsPanel.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        this.setSettingsOpen(false, true);
      }
    }, { signal });
    this.host.addEventListener('submit', (event) => {
      if (!event.target.matches('[data-compare="manifest-form"]')) return;
      event.preventDefault();
      this.loadManifest(event.target.querySelector('input').value.trim());
    }, { signal });

    this.primaryAnimation = () => this.synchronize('primary');
    this.secondaryAnimation = () => this.synchronize('secondary');
    viewer.osdController.osd.addHandler('animation', this.primaryAnimation);
    this.osd.osd.addHandler('animation', this.secondaryAnimation);
    this.primaryOpen = () => { this.updateSync(); this.synchronize('secondary', true); };
    this.secondaryOpen = () => { this.updateSync(); this.synchronize('primary', true); };
    this.secondaryOpenFailed = (event) => {
      this.host.querySelector('[data-compare="error"]').textContent = `Could not load comparison image: ${event.message || 'Image loading failed.'}`;
    };
    viewer.osdController.osd.addHandler('open', this.primaryOpen);
    this.osd.osd.addHandler('open', this.secondaryOpen);
    this.osd.osd.addHandler('open-failed', this.secondaryOpenFailed);
    this.resizeObserver = new ResizeObserver(() => viewer.handleViewportResize());
    this.resizeObserver.observe(this.stage);
    this.resizeObserver.observe(this.host);
  }

  setSettingsOpen(open, restoreFocus = false) {
    this.settingsPanel.hidden = !open;
    this.settingsButton.setAttribute('aria-expanded', String(open));
    if (restoreFocus) this.settingsButton.focus();
  }

  notify() {
    this.viewer.options.onCompareChange?.({
      open: true,
      activePane: this.activePane,
      secondaryManifest: this.manifest,
      secondaryManifestUrl: this.sourceUrl,
      secondaryCanvasIndex: this.index,
      secondaryCanvas: this.manifest?.canvases[this.index],
    });
  }

  setActivePane(pane) {
    if (pane === this.activePane) return;
    this.activePane = pane;
    this.viewer.sidebar.resetSearch();
    this.viewer.sidebar.annotationsVisible = this.viewer.getActivePane().controller.showAnnotations;
    this.viewer.destroyNavMap();
    this.viewer.syncFilterUI();
    this.viewer.syncTransformUI();
    this.viewer.syncActiveControls();
    this.viewer.renderSidebar();
  }

  usePrimary() {
    this.fetchController?.abort();
    this.fetchController = null;
    this.manifest = this.viewer.state.manifest;
    this.raw = this.viewer.state.rawManifest;
    this.sourceUrl = this.viewer.manifestSourceUrl || null;
    this.usesPrimary = true;
    this.search.setManifest(this.raw);
    this.viewer.sidebar.resetSearch();
    this.osd.resetTransform();
    const next = this.viewer.state.canvasIndex + 1;
    this.selectCanvas(next < this.manifest.canvases.length ? next : 0);
  }

  async loadManifest(url) {
    this.fetchController?.abort();
    const controller = new AbortController();
    this.fetchController = controller;
    const error = this.host.querySelector('[data-compare="error"]');
    error.textContent = '';
    try {
      const parsedUrl = new URL(url, window.location.href);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Enter an HTTP or HTTPS manifest URL.');
      const response = await fetch(this.viewer.resolveUrl(url, 'manifest'), {
        ...this.viewer.options.fetchOptions, signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const raw = await response.json();
      if (controller.signal.aborted) return;
      const manifest = parseIIIFManifest(raw, this.viewer.state.language);
      if (!manifest.canvases.length) throw new Error('Manifest contains no displayable canvases or 3D scenes.');
      this.manifest = manifest;
      this.raw = raw;
      this.sourceUrl = url;
      this.usesPrimary = false;
      this.osd.resetTransform();
      this.search.setManifest(raw);
      this.viewer.sidebar.resetSearch();
      this.selectCanvas(0);
    } catch (err) {
      if (controller.signal.aborted) return;
      error.textContent = err instanceof TypeError && /fetch|network/i.test(err.message)
        ? `Network or CORS error fetching ${url}. Configure proxyUrl / proxyRoutes or allow cross-origin requests.`
        : err.message;
    } finally {
      if (this.fetchController === controller) this.fetchController = null;
    }
  }

  selectCanvas(index, { focusRegion, temporal } = {}) {
    if (!Number.isInteger(index) || !this.manifest?.canvases[index]) return;
    const previous = this.manifest?.canvases[this.index];
    this.index = index;
    const item = this.manifest.canvases[index];
    const select = this.host.querySelector('[data-compare="canvas"]');
    select.replaceChildren(...this.manifest.canvases.map((canvas, i) => {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = canvas.label;
      return option;
    }));
    select.value = String(index);
    if (previous !== item && !this.viewer.options.persistCanvasTransform) this.osd.resetTransform();
    this.host.querySelector('[data-compare="error"]').textContent = '';
    if (previous === item && this.media && temporal) this.media.seek(temporal);
    else this.renderCanvas(item, focusRegion, temporal);
    this.updateSync();
    this.viewer.syncActiveControls();
    this.viewer.renderSidebar();
    this.notify();
    this.loadSupplemental(item, this.manifest);
  }

  async loadSupplemental(item, manifest) {
    const signal = this.abort.signal;
    const requests = [];
    for (const [resource, scope] of [[manifest, 'manifest'], [item, 'canvas']]) {
      if (!resource.navPlaceRefUrl || resource.navPlaceLoaded) continue;
      resource.navPlaceLoaded = true;
      requests.push((async () => {
        try {
          const response = await fetch(this.viewer.resolveUrl(resource.navPlaceRefUrl, 'navplace'), { ...this.viewer.options.fetchOptions, signal });
          if (!response.ok) throw new Error(`navPlace HTTP ${response.status}`);
          const json = await response.json();
          if (signal.aborted) { resource.navPlaceLoaded = false; return; }
          const normalized = normalizeNavPlace(json, {
            scope, canvasIndex: scope === 'canvas' ? item.index : null,
            canvasLabel: resource.label, lang: this.viewer.state.language,
          });
          resource.navPlace = normalized.featureCollection;
        } catch (error) {
          resource.navPlaceLoaded = false;
          throw error;
        }
      })());
    }
    if (item.externalAnnotationUrls?.length && !item.externalAnnotationsLoaded) {
      item.externalAnnotationsLoaded = true;
      requests.push((async () => {
        try {
          const results = await Promise.all(item.externalAnnotationUrls.map(async (url) => {
            const response = await fetch(this.viewer.resolveUrl(url, 'annotation'), { ...this.viewer.options.fetchOptions, signal });
            if (!response.ok) throw new Error(`Annotation HTTP ${response.status}`);
            const json = await response.json();
            return parseAnnotationItems(manifest.isV3 ? json.items || [] : json.resources || [], manifest.isV3);
          }));
          if (signal.aborted) { item.externalAnnotationsLoaded = false; return; }
          item.annotations.push(...results.flat());
          if (this.manifest === manifest && this.manifest.canvases[this.index] === item && item.kind === 'canvas') {
            this.osd.renderAnnotationOverlays(item.annotations.filter((annotation) => Array.isArray(annotation.xywh)));
          }
          if (this.viewer.state.manifest === manifest && manifest.canvases[this.viewer.state.canvasIndex] === item && item.kind === 'canvas') {
            this.viewer.osdController.renderAnnotationOverlays(item.annotations.filter((annotation) => Array.isArray(annotation.xywh)));
          }
        } catch (error) {
          item.externalAnnotationsLoaded = false;
          throw error;
        }
      })());
    }
    try {
      await Promise.all(requests);
      if (!signal.aborted && this.manifest === manifest) this.viewer.renderSidebar();
    } catch (error) {
      if (!signal.aborted) this.host.querySelector('[data-compare="error"]').textContent = `Could not load comparison data: ${error.message}`;
    }
  }

  async renderCanvas(item, focusRegion, temporal) {
    const generation = ++this.generation;
    this.modelStats = null;
    this.model?.destroy?.();
    this.model = null;
    this.media?.destroy();
    this.media = null;
    const scene = this.host.querySelector('[data-compare="scene"]');
    const osd = this.host.querySelector('[data-compare="osd"]');
    const media = this.host.querySelector('[data-compare="media"]');
    scene.innerHTML = '';
    const isScene = item.kind === 'scene' && item.scene?.modelUrl;
    scene.classList.toggle('hidden', !isScene);
    osd.classList.toggle('hidden', Boolean(isScene || item.kind === 'media'));
    media.classList.toggle('hidden', item.kind !== 'media');
    if (item.kind === 'media') {
      this.osd.clearAnnotations();
      this.osd.osd.close();
      this.media = new MediaStage(media, item, (url, type) => this.viewer.resolveUrl(url, type));
      if (temporal) this.media.seek(temporal);
    } else if (isScene) {
      this.osd.clearAnnotations();
      const resolvedModelUrl = this.viewer.resolveUrl(item.scene.modelUrl, 'model');
      try {
        if (this.viewer.options.onSelectScene) {
          this.model = this.viewer.options.onSelectScene(scene, { ...item.scene, modelUrl: resolvedModelUrl }, { theme: this.viewer.state.theme, title: item.label });
        } else {
          const { BuiltInSceneViewer } = await import('./scene-viewer.js');
          if (generation !== this.generation) return;
          this.model = new BuiltInSceneViewer(scene, item.scene, {
            theme: this.viewer.state.theme, title: item.label, resolvedModelUrl,
            dracoDecoderPath: this.viewer.options.dracoDecoderPath,
            onModelLoaded: (stats) => {
              if (generation !== this.generation) return;
              this.modelStats = stats;
              this.viewer.renderSidebar();
            },
          });
        }
      } catch (error) {
        if (generation === this.generation) this.host.querySelector('[data-compare="error"]').textContent = `Could not open 3D scene: ${error.message}`;
      }
    } else {
      const image = item.image;
      const source = image?.infoJsonUrl ? this.viewer.resolveUrl(image.infoJsonUrl, 'image')
        : image?.staticUrl ? { type: 'image', url: this.viewer.resolveUrl(image.staticUrl, 'image') } : null;
      if (source) this.osd.open(source, item.annotations, focusRegion ? { xywh: focusRegion } : null);
      else {
        this.osd.clearAnnotations();
        this.osd.osd.close();
        this.host.querySelector('[data-compare="error"]').textContent = 'This canvas has no displayable image.';
      }
    }
    this.viewer.handleViewportResize();
  }

  updateSync() {
    const primary = this.viewer.state.manifest?.canvases[this.viewer.state.canvasIndex];
    const secondary = this.manifest?.canvases[this.index];
    const compatible = primary?.kind === 'canvas' && secondary?.kind === 'canvas';
    const button = this.host.querySelector('[data-compare="sync"]');
    button.disabled = !compatible;
    button.setAttribute('aria-pressed', String(Boolean(compatible && this.syncEnabled)));
    button.title = compatible ? 'Synchronize image views' : 'Sync View requires two 2D canvases';
  }

  synchronize(sourcePane, force = false) {
    if ((!force && sourcePane !== this.activePane) || this.syncing || !this.syncEnabled || this.viewer.osdController.awaitingImage || this.osd.awaitingImage ||
        this.host.querySelector('[data-compare="sync"]').disabled) return;
    const source = sourcePane === 'primary' ? this.viewer.osdController.osd : this.osd.osd;
    const target = sourcePane === 'primary' ? this.osd.osd : this.viewer.osdController.osd;
    const sourceItem = source.world.getItemAt(0);
    const targetItem = target.world.getItemAt(0);
    if (!sourceItem || !targetItem || !source.viewport || !target.viewport) return;
    const sourceSize = sourceItem.getContentSize();
    const targetSize = targetItem.getContentSize();
    if (!sourceSize.x || !sourceSize.y || !targetSize.x || !targetSize.y) return;
    const center = sourceItem.viewportToImageCoordinates(source.viewport.getCenter(true));
    const targetCenter = targetItem.imageToViewportCoordinates(new OpenSeadragon.Point(
      center.x / sourceSize.x * targetSize.x, center.y / sourceSize.y * targetSize.y
    ));
    const zoom = source.viewport.getZoom(true) / source.viewport.getHomeZoom() * target.viewport.getHomeZoom();
    if (!Number.isFinite(zoom) || !Number.isFinite(targetCenter.x) || !Number.isFinite(targetCenter.y)) return;
    this.syncing = true;
    try {
      target.viewport.zoomTo(zoom, null, true);
      target.viewport.panTo(targetCenter, true);
    } finally {
      this.syncing = false;
    }
  }

  async swap() {
    const viewer = this.viewer;
    this.fetchController?.abort();
    this.fetchController = null;
    const old = { raw: viewer.state.rawManifest, sourceUrl: viewer.manifestSourceUrl, index: viewer.state.canvasIndex };
    const next = { raw: this.raw, sourceUrl: this.sourceUrl, index: this.index };
    if (this.usesPrimary) {
      viewer.goToCanvas(next.index);
      this.selectCanvas(old.index);
      return;
    }
    viewer.state.currentUrl = next.sourceUrl || '';
    const input = viewer.wrapper.querySelector('[data-el="url-input"]');
    if (input) input.value = viewer.state.currentUrl;
    const loading = viewer.setManifest(next.raw, { sourceUrl: next.sourceUrl, compareSwap: true, canvasIndex: next.index });
    if (viewer.comparison !== this) return;
    this.raw = old.raw;
    this.sourceUrl = old.sourceUrl;
    this.manifest = parseIIIFManifest(old.raw, viewer.state.language);
    this.usesPrimary = false;
    this.search.setManifest(this.raw);
    this.selectCanvas(old.index);
    await loading;
  }

  relabel(lang) {
    if (!this.manifest) return;
    this.manifest.label = extractLangValue(this.manifest.rawLabel, lang) || 'Untitled IIIF Manifest';
    this.manifest.summary = extractLangValue(this.manifest.rawSummary, lang);
    this.manifest.attribution = extractLangValue(this.manifest.rawAttribution, lang);
    this.manifest.metadata = this.manifest.rawMetadata.map((item) => ({
      ...item, label: extractLangValue(item.rawLabel, lang), value: extractLangValue(item.rawValue, lang),
    }));
    this.manifest.canvases.forEach((canvas, index) => {
      canvas.label = extractLangValue(canvas.rawLabel, lang) || `${canvas.kind === 'scene' ? '3D Scene' : 'Canvas'} ${index + 1}`;
    });
    const relabelTree = (nodes) => nodes.forEach((node) => {
      node.label = extractLangValue(node.rawLabel, lang) || 'Section';
      if (node.children?.length) relabelTree(node.children);
    });
    relabelTree(this.manifest.structures);
    const select = this.host.querySelector('[data-compare="canvas"]');
    [...select.options].forEach((option, index) => { option.textContent = this.manifest.canvases[index].label; });
  }

  destroy() {
    this.generation++;
    this.fetchController?.abort();
    this.abort.abort();
    this.resizeObserver.disconnect();
    this.search.destroy();
    this.viewer.osdController.osd.removeHandler('animation', this.primaryAnimation);
    this.viewer.osdController.osd.removeHandler('open', this.primaryOpen);
    this.osd.osd.removeHandler('animation', this.secondaryAnimation);
    this.osd.osd.removeHandler('open', this.secondaryOpen);
    this.osd.osd.removeHandler('open-failed', this.secondaryOpenFailed);
    this.osd.destroy();
    this.model?.destroy?.();
    this.media?.destroy();
    this.host.replaceChildren();
    this.host.hidden = true;
    this.stage.classList.remove('is-comparing');
  }
}
