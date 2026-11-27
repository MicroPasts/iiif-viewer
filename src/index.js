import './style.css';
import {
  parseIIIFManifest,
  parseAnnotationItems,
  normalizeNavPlace,
  extractLangValue,
} from './parser.js';
import { UrlResolver } from './url-resolver.js';
import { FullscreenController } from './fullscreen-controller.js';
import { OsdController } from './osd-controller.js';
import { SidebarPanel, configureExternalViewers } from './sidebar.js';
import { Filmstrip } from './filmstrip.js';
import { ManifestSearchController } from './search-controller.js';
import { renderShell } from './template.js';
import { InspectionTools } from './inspection-tools.js';
import { ImageDownload, configureImageDownload } from './image-download.js';

function extractDroppedManifestUrl(dataTransfer) {
  if (!dataTransfer) return null;
  const plain = (dataTransfer.getData('text/plain') || '').trim();
  const uriList = (dataTransfer.getData('text/uri-list') || '').trim();

  if (plain.startsWith('{')) {
    try {
      const parsed = JSON.parse(plain);
      const target = Array.isArray(parsed.target) ? parsed.target[0] : parsed.target;
      const partOf = Array.isArray(target?.partOf) ? target.partOf[0] : target?.partOf;
      if (partOf?.id && /^https?:\/\//i.test(partOf.id)) return partOf.id;
      if (target?.id && /manifest/i.test(target.id)) return target.id;
    } catch {
      // Not JSON
    }
  }

  for (const candidate of [plain, uriList.split('\n')[0]?.trim()]) {
    if (!candidate) continue;
    try {
      const u = new URL(candidate);
      const manifestParam = u.searchParams.get('manifest');
      if (manifestParam && /^https?:\/\//i.test(manifestParam)) return manifestParam;
      if (/^https?:$/i.test(u.protocol)) return candidate;
    } catch {
      // Not a valid URL
    }
  }
  return null;
}

export class IIIFViewer {
  constructor(target, options = {}) {
    this.container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this.container) {
      throw new Error('IIIFViewer: Target container element not found.');
    }

    const defaultSidebarOpen =
      typeof window !== 'undefined' ? window.innerWidth >= 768 : true;

    this.options = {
      manifestUrl: options.manifestUrl || options.url || '',
      manifest: options.manifest || options.data || null,
      proxyUrl: options.proxyUrl || '',
      assetProxyUrl: options.assetProxyUrl || '',
      proxyRoutes: options.proxyRoutes || null,
      dracoDecoderPath: options.dracoDecoderPath || undefined,
      mapStyle: options.mapStyle || undefined,
      theme: options.theme || 'dark',
      language: options.language || 'en',
      showUrlInput: options.showUrlInput ?? true,
      allowManifestDrop: options.allowManifestDrop ?? true,
      showSidebar: options.showSidebar ?? defaultSidebarOpen,
      summaryCollapseLength: options.summaryCollapseLength ?? 300,
      physicalRuler: options.physicalRuler ?? false,
      layersCurtain: options.layersCurtain ?? false,
      imageDownload: configureImageDownload(options.imageDownload),
      externalViewers: configureExternalViewers(options.externalViewers),
      height: options.height || '680px',
      initialCanvas: options.initialCanvas || 0,
      fetchOptions: options.fetchOptions || {},
      onSelectScene: options.onSelectScene || null,
      onManifestLoad: options.onManifestLoad || null,
      onCanvasChange: options.onCanvasChange || null,
      onSelectLocation: options.onSelectLocation || null,
    };

    this.state = {
      theme: this.options.theme,
      language: this.options.language,
      currentUrl: this.options.manifestUrl,
      manifest: null,
      rawManifest: null,
      canvasIndex: this.options.initialCanvas,
      modelStats: null,
    };

    this.resolver = new UrlResolver({
      proxyUrl: this.options.proxyUrl,
      assetProxyUrl: this.options.assetProxyUrl,
      proxyRoutes: this.options.proxyRoutes,
    });

    this.searchController = new ManifestSearchController({
      resolveUrl: (u, t) => this.resolveUrl(u, t),
      fetchOptions: this.options.fetchOptions,
    });

    this.fetchAbortController = null;
    this.activeModelViewer = null;
    this.activeNavMap = null;

    this.mount();

    if (this.options.manifest) {
      this.setManifest(this.options.manifest);
    } else if (this.options.manifestUrl) {
      this.loadManifest(this.options.manifestUrl);
    }
  }

  resolveUrl(url, resourceType = 'asset') {
    return this.resolver.resolve(url, resourceType);
  }

  setProxyRoutes(proxyRoutes) {
    this.options.proxyRoutes = proxyRoutes;
    this.resolver.setProxyRoutes(proxyRoutes);
    if (this.state.manifest) {
      this.filmstrip.render(this.state.manifest.canvases, (u, t) => this.resolveUrl(u, t));
      this.goToCanvas(this.state.canvasIndex);
    }
  }

  mount() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = this.state.theme === 'dark' ? 'dark' : '';
    this.wrapper.innerHTML = renderShell({
      showUrlInput: this.options.showUrlInput,
      allowManifestDrop: this.options.allowManifestDrop,
      currentUrl: this.state.currentUrl,
      height: this.options.height,
    });

    this.container.innerHTML = '';
    this.container.appendChild(this.wrapper);
    this.setTheme(this.state.theme);

    this.osdController = new OsdController(
      this.wrapper.querySelector('[data-el="osd-container"]'),
      {
        onAnnotationClick: () => {
          this.sidebar.setOpen(true);
          this.sidebar.setTab('annotations');
          this.renderSidebar();
        },
      }
    );

    this.createInspectionTools();
    if (this.options.imageDownload) {
      this.imageDownload = new ImageDownload(this.wrapper, this.osdController, this.options.imageDownload, {
        resolveUrl: (url, type) => this.resolveUrl(url, type),
        getLayers: () => this.inspectionTools?.getVisibleLayers() ?? (this.inspectionTools?.curtainEnabled ? null : []),
        getRights: () => this.state.manifest?.rights,
        closeInspection: () => {
          this.inspectionTools?.closePanels();
          this.wrapper.querySelector('[data-el="filter-bar"]')?.classList.add('hidden');
          this.wrapper.querySelector('[data-action="toggle-filters"]')?.setAttribute('aria-expanded', 'false');
        },
      });
    }

    this.sidebar = new SidebarPanel(this.wrapper, {
      isOpen: this.options.showSidebar,
      summaryCollapseLength: this.options.summaryCollapseLength,
      externalViewers: this.options.externalViewers,
      onTabChange: () => {
        if (this.sidebar.activeTab !== 'map') {
          this.destroyNavMap();
        }
        this.renderSidebar();
      },
      onSelectCanvas: (idx) => this.goToCanvas(idx),
      onFocusAnnotation: (annoIdx) => {
        const current = this.state.manifest?.canvases[this.state.canvasIndex];
        const anno = current?.annotations?.[annoIdx];
        if (anno) this.osdController.focusAnnotation(anno);
      },
      onToggleAnnotations: (visible) => this.osdController.setAnnotationsVisible(visible),
      onChangeLanguage: (lang) => this.setLanguage(lang),
      onCopyText: (text, btn) => this.copyToClipboard(text, btn),
      onSearch: (q) => this.searchController.search(q, this.state.manifest),
      onSelectSearchHit: (hit) => this.goToCanvas(hit.canvasIndex, { focusRegion: hit.xywh }),
      onMountMap: (hostEl, featureCollection) => this.mountNavMap(hostEl, featureCollection),
      onPanMap: (x, y) => this.activeNavMap?.panBy(x, y),
      onFocusMapFeature: (feat) => {
        this.activeNavMap?.focusFeature?.(feat);
        const cIdx = feat?.properties?._canvasIndex;
        if (typeof cIdx === 'number' && !Number.isNaN(cIdx) && cIdx !== this.state.canvasIndex) {
          this.goToCanvas(cIdx);
        }
        this.options.onSelectLocation?.(feat, { canvasIndex: cIdx });
      },
    });

    this.filmstrip = new Filmstrip(this.wrapper, {
      onSelectCanvas: (idx) => this.goToCanvas(idx),
    });

    this.fullscreen = new FullscreenController(this.wrapper, {
      height: this.options.height,
      onResize: () => this.handleViewportResize(),
    });

    this.bindEvents();
  }

  createInspectionTools() {
    if (!this.options.physicalRuler && !this.options.layersCurtain) return;
    this.inspectionTools = new InspectionTools(this.wrapper, this.osdController.osd, {
      ruler: this.options.physicalRuler,
      curtain: this.options.layersCurtain,
      resolveUrl: (url, type) => this.resolveUrl(url, type),
    });
  }

  setInspectionTools({ physicalRuler = this.options.physicalRuler, layersCurtain = this.options.layersCurtain } = {}) {
    if (physicalRuler === this.options.physicalRuler && layersCurtain === this.options.layersCurtain) return;
    const hadFocus = this.wrapper.querySelector('[data-el="inspection-tools"]')?.contains(document.activeElement) ||
      this.wrapper.querySelector('[data-el="inspection-buttons"]')?.contains(document.activeElement);
    this.inspectionTools?.destroy();
    this.inspectionTools = null;
    this.options.physicalRuler = physicalRuler;
    this.options.layersCurtain = layersCurtain;
    this.createInspectionTools();
    if (this.inspectionTools && this.state.manifest) {
      this.inspectionTools.setCanvas(this.state.manifest, this.state.canvasIndex);
      if (!this.osdController.awaitingImage) this.inspectionTools.imageOpened();
    }
    if (hadFocus) this.wrapper.querySelector('[data-el="viewer-root"]')?.focus();
  }

  bindEvents() {
    this.wrapper.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;

      const action = actionEl.dataset.action;
      if (action === 'toggle-theme') this.toggleTheme();
      if (action === 'toggle-sidebar') this.toggleSidebar();
      if (action === 'toggle-fullscreen') this.toggleFullscreen();
      if (action === 'zoom-in') this.osdController.zoomBy(1.4);
      if (action === 'zoom-out') this.osdController.zoomBy(0.7);
      if (action === 'zoom-home') this.osdController.goHome();
      if (action === 'rotate') this.osdController.rotateBy(90);
      if (action === 'pan-left') this.osdController.panBy(-1, 0);
      if (action === 'pan-right') this.osdController.panBy(1, 0);
      if (action === 'pan-up') this.osdController.panBy(0, -1);
      if (action === 'pan-down') this.osdController.panBy(0, 1);
      if (action === 'prev-canvas') this.goToCanvas(this.state.canvasIndex - 1);
      if (action === 'next-canvas') this.goToCanvas(this.state.canvasIndex + 1);
      if (action === 'toggle-filters') {
        const bar = this.wrapper.querySelector('[data-el="filter-bar"]');
        const open = bar?.classList.toggle('hidden') === false;
        actionEl.setAttribute('aria-expanded', String(open));
      }
      if (action === 'reset-filters') {
        this.osdController.resetFilters();
        this.syncFilterUI();
      }
    });

    this.wrapper.addEventListener('input', (e) => {
      const slider = e.target.closest('[data-filter]');
      if (!slider) return;
      const key = slider.dataset.filter;
      const val = Number(slider.value);
      this.osdController.setFilter({ [key]: val });
      slider.setAttribute('aria-valuetext', `${val}%`);
      const label = this.wrapper.querySelector(`[data-el="${key}-val"]`);
      if (label) label.textContent = `${val}%`;
    });

    this.wrapper.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('[data-filter-toggle]');
      if (!toggleBtn) return;
      const key = toggleBtn.dataset.filterToggle;
      const next = !this.osdController.filters[key];
      this.osdController.setFilter({ [key]: next });
      toggleBtn.setAttribute('aria-pressed', String(next));
    });

    const form = this.wrapper.querySelector('[data-el="url-form"]');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = this.wrapper.querySelector('[data-el="url-input"]');
      if (input?.value.trim()) {
        this.loadManifest(input.value.trim());
      }
    });

    const root = this.wrapper.querySelector('[data-el="viewer-root"]');
    root?.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    root?.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!this.options.allowManifestDrop) return;
      const droppedUrl = extractDroppedManifestUrl(e.dataTransfer);
      if (droppedUrl) {
        this.loadManifest(droppedUrl);
      }
    });

    root?.addEventListener('keydown', (e) => {
      if (e.target !== root || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.goToCanvas(this.state.canvasIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.goToCanvas(this.state.canvasIndex + 1);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        this.osdController.zoomBy(1.4);
      } else if (e.key === '-') {
        e.preventDefault();
        this.osdController.zoomBy(0.7);
      } else if (e.key === '0') {
        e.preventDefault();
        this.osdController.goHome();
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        this.toggleSidebar();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        this.toggleFullscreen();
      }
    });
  }

  syncFilterUI() {
    const { brightness, contrast, grayscale, invert } = this.osdController.filters;
    const bSlider = this.wrapper.querySelector('[data-filter="brightness"]');
    const cSlider = this.wrapper.querySelector('[data-filter="contrast"]');
    if (bSlider) {
      bSlider.value = String(brightness);
      bSlider.setAttribute('aria-valuetext', `${brightness}%`);
    }
    if (cSlider) {
      cSlider.value = String(contrast);
      cSlider.setAttribute('aria-valuetext', `${contrast}%`);
    }
    const bVal = this.wrapper.querySelector('[data-el="brightness-val"]');
    const cVal = this.wrapper.querySelector('[data-el="contrast-val"]');
    if (bVal) bVal.textContent = `${brightness}%`;
    if (cVal) cVal.textContent = `${contrast}%`;
    this.wrapper
      .querySelector('[data-filter-toggle="grayscale"]')
      ?.setAttribute('aria-pressed', String(grayscale));
    this.wrapper
      .querySelector('[data-filter-toggle="invert"]')
      ?.setAttribute('aria-pressed', String(invert));
  }

  handleViewportResize() {
    this.osdController.resize();
    this.activeModelViewer?.handleResize?.();
    this.activeNavMap?.resize?.();
  }

  setTheme(theme) {
    this.state.theme = theme === 'light' ? 'light' : 'dark';
    this.wrapper.classList.toggle('dark', this.state.theme === 'dark');
    this.wrapper.querySelector('[data-action="toggle-theme"]')?.setAttribute('aria-pressed', String(this.state.theme === 'dark'));
    this.activeModelViewer?.setTheme?.(this.state.theme);
  }

  toggleTheme() {
    this.setTheme(this.state.theme === 'dark' ? 'light' : 'dark');
  }

  toggleSidebar() {
    this.sidebar.toggle();
    requestAnimationFrame(() => this.handleViewportResize());
  }

  enterFullscreen() {
    return this.fullscreen.enter();
  }

  exitFullscreen() {
    return this.fullscreen.exit();
  }

  toggleFullscreen() {
    return this.fullscreen.toggle();
  }

  setLanguage(lang) {
    this.state.language = lang;
    this.sidebar.selectedLang = lang;
    const manifest = this.state.manifest;
    if (!manifest) return;

    manifest.label = extractLangValue(manifest.rawLabel, lang) || 'Untitled IIIF Manifest';
    manifest.summary = extractLangValue(manifest.rawSummary, lang);
    manifest.attribution = extractLangValue(manifest.rawAttribution, lang);
    manifest.metadata = manifest.rawMetadata.map((m) => ({
      ...m,
      label: extractLangValue(m.rawLabel, lang),
      value: extractLangValue(m.rawValue, lang),
    }));
    manifest.canvases.forEach((c, idx) => {
      c.label =
        extractLangValue(c.rawLabel, lang) ||
        (c.kind === 'scene' ? `3D Scene ${idx + 1}` : `Canvas ${idx + 1}`);
    });
    this.inspectionTools?.setLanguage(lang);

    const relabelTree = (nodes) =>
      nodes.forEach((n) => {
        n.label = extractLangValue(n.rawLabel, lang) || 'Section';
        if (n.children?.length) relabelTree(n.children);
      });
    relabelTree(manifest.structures);

    const titleEl = this.wrapper.querySelector('[data-el="manifest-title"]');
    if (titleEl) titleEl.textContent = manifest.label;

    this.filmstrip.render(manifest.canvases, (u, t) => this.resolveUrl(u, t));
    this.filmstrip.setActive(this.state.canvasIndex);
    this.renderSidebar();
  }

  async loadManifest(url) {
    this.state.currentUrl = url;
    const input = this.wrapper.querySelector('[data-el="url-input"]');
    if (input) input.value = url;

    this.fetchAbortController?.abort();
    const controller = new AbortController();
    this.fetchAbortController = controller;

    this.setLoading(true);
    this.setError(null);

    try {
      const fetchOpts = {
        ...this.options.fetchOptions,
        signal: controller.signal,
      };
      if (this.options.fetchOptions.headers) {
        fetchOpts.headers = this.options.fetchOptions.headers;
      }

      const targetUrl = this.resolveUrl(url, 'manifest');
      const res = await fetch(targetUrl, fetchOpts);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      if (controller.signal.aborted) return;
      this.setManifest(json);
    } catch (err) {
      if (err.name === 'AbortError') return;
      const isCorsOrNetwork =
        err instanceof TypeError && /fetch|network/i.test(err.message);
      this.setError(
        isCorsOrNetwork
          ? `Network or CORS error fetching manifest from ${url}. Ensure the server allows cross-origin requests or configure proxyUrl / proxyRoutes.`
          : err.message || 'Failed to load IIIF Manifest.'
      );
    } finally {
      if (this.fetchAbortController === controller) {
        this.setLoading(false);
      }
    }
  }

  async setManifest(jsonOrString) {
    try {
      const raw = typeof jsonOrString === 'string' ? JSON.parse(jsonOrString) : jsonOrString;
      const parsed = parseIIIFManifest(raw, this.state.language);
      if (!parsed.canvases.length) {
        throw new Error('Manifest contains no displayable canvases or 3D scenes.');
      }

      this.destroyNavMap();
      this.state.rawManifest = raw;
      this.state.manifest = parsed;
      this.inspectionTools?.resetManifest();
      this.state.canvasIndex = Math.min(this.options.initialCanvas, parsed.canvases.length - 1);
      this.setError(null);
      this.sidebar.resetSearch();
      this.searchController.setManifest(raw);

      if (
        parsed.availableLanguages.length > 0 &&
        !parsed.availableLanguages.includes(this.state.language)
      ) {
        this.state.language = parsed.availableLanguages[0];
        this.sidebar.selectedLang = this.state.language;
      }

      this.wrapper.querySelector('[data-el="empty-state"]')?.classList.add('hidden');

      const vBadge = this.wrapper.querySelector('[data-el="version-badge"]');
      if (vBadge) {
        vBadge.textContent = `v${parsed.version}`;
        vBadge.classList.remove('hidden');
      }

      const titleEl = this.wrapper.querySelector('[data-el="manifest-title"]');
      if (titleEl) titleEl.textContent = parsed.label;

      this.options.onManifestLoad?.(parsed, raw);
      this.filmstrip.render(parsed.canvases, (u, t) => this.resolveUrl(u, t));
      this.goToCanvas(this.state.canvasIndex);

      if (parsed.navPlaceRefUrl && !parsed.navPlaceLoaded) {
        await this.loadExternalNavPlace(parsed.navPlaceRefUrl, {
          scope: 'manifest',
          canvasIndex: null,
          canvasLabel: parsed.label,
        });
      }
    } catch (err) {
      this.setError(err.message);
    }
  }

  async loadExternalNavPlace(refUrl, { scope, canvasIndex, canvasLabel }) {
    const manifest = this.state.manifest;
    if (!manifest) return;
    if (scope === 'manifest') manifest.navPlaceLoaded = true;
    else if (typeof canvasIndex === 'number' && manifest.canvases[canvasIndex]) {
      manifest.canvases[canvasIndex].navPlaceLoaded = true;
    }

    try {
      const res = await fetch(this.resolveUrl(refUrl, 'navplace'));
      if (!res.ok) return;
      const json = await res.json();
      const normalized = normalizeNavPlace(json, {
        scope,
        canvasIndex,
        canvasLabel,
        lang: this.state.language,
      });
      if (!normalized.featureCollection) return;

      if (scope === 'manifest') {
        manifest.navPlace = normalized.featureCollection;
      } else if (typeof canvasIndex === 'number' && manifest.canvases[canvasIndex]) {
        manifest.canvases[canvasIndex].navPlace = normalized.featureCollection;
      }
      this.renderSidebar();
    } catch {
      // Non-fatal if referenced GeoJSON endpoint is unreachable
    }
  }

  collectNavFeatures(manifest, currentCanvas) {
    const seen = new Set();
    const combined = [];
    const pushList = (fc) => {
      for (const f of fc?.features || []) {
        const key = f.id || JSON.stringify(f.geometry);
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(f);
        }
      }
    };
    pushList(manifest?.navPlace);
    pushList(currentCanvas?.navPlace);
    return combined;
  }

  async mountNavMap(hostEl, featureCollection) {
    this.destroyNavMap();
    const { NavPlaceMap } = await import('./navplace-map.js');
    if (this.sidebar.activeTab !== 'map') return;

    this.activeNavMap = new NavPlaceMap(hostEl, {
      featureCollection,
      mapStyle: this.options.mapStyle,
      onSelectCanvas: (idx) => this.goToCanvas(idx),
      onSelectFeature: (feat, meta) => this.options.onSelectLocation?.(feat, meta),
    });
  }

  destroyNavMap() {
    this.activeNavMap?.destroy?.();
    this.activeNavMap = null;
  }

  async goToCanvas(index, { focusRegion } = {}) {
    const manifest = this.state.manifest;
    if (!manifest || index < 0 || index >= manifest.canvases.length) return;

    this.state.canvasIndex = index;
    this.state.modelStats = null;
    const item = manifest.canvases[index];
    this.inspectionTools?.setCanvas(manifest, index);
    this.imageDownload?.setCanvas(item);

    const osdEl = this.wrapper.querySelector('[data-el="osd-container"]');
    const sceneEl = this.wrapper.querySelector('[data-el="scene-container"]');
    const zoomControls = this.wrapper.querySelector('[data-el="zoom-controls"]');
    const filterBar = this.wrapper.querySelector('[data-el="filter-bar"]');

    if (item.kind === 'scene' && item.scene?.modelUrl) {
      this.osdController.clearAnnotations();
      const focusedControl = zoomControls?.contains(document.activeElement) ||
        filterBar?.contains(document.activeElement);
      osdEl?.classList.add('hidden');
      zoomControls?.classList.add('hidden');
      zoomControls?.classList.remove('inline-flex');
      filterBar?.classList.add('hidden');
      this.wrapper.querySelector('[data-action="toggle-filters"]')?.setAttribute('aria-expanded', 'false');
      if (focusedControl) this.wrapper.querySelector('[data-el="viewer-root"]')?.focus();
      sceneEl?.classList.remove('hidden');
      this.mountSceneViewer(sceneEl, item);
    } else {
      this.destroySceneViewer();
      sceneEl?.classList.add('hidden');
      osdEl?.classList.remove('hidden');
      zoomControls?.classList.remove('hidden');
      zoomControls?.classList.add('inline-flex');

      const tileSource = item.image.infoJsonUrl
        ? this.resolveUrl(item.image.infoJsonUrl, 'image')
        : item.image.staticUrl
          ? { type: 'image', url: this.resolveUrl(item.image.staticUrl, 'image') }
          : null;

      if (tileSource) {
        if (Array.isArray(focusRegion) && focusRegion.length === 4) {
          this.osdController.open(tileSource, item.annotations, { xywh: focusRegion });
        } else {
          this.osdController.open(tileSource, item.annotations);
        }
      } else {
        this.osdController.clearAnnotations();
      }
    }

    const pager = this.wrapper.querySelector('[data-el="pager-controls"]');
    const counter = this.wrapper.querySelector('[data-el="canvas-counter"]');
    if (pager && counter) {
      const showPager = manifest.canvases.length > 1;
      const focusedControl = !showPager && pager.contains(document.activeElement);
      pager.classList.toggle('hidden', !showPager);
      pager.classList.toggle('inline-flex', showPager);
      if (focusedControl) this.wrapper.querySelector('[data-el="viewer-root"]')?.focus();
      counter.textContent = `${index + 1} / ${manifest.canvases.length}`;
      counter.setAttribute('aria-label', `Canvas ${index + 1} of ${manifest.canvases.length}`);
    }
    const status = this.wrapper.querySelector('[data-el="status-message"]');
    if (status) status.textContent = `Canvas ${index + 1} of ${manifest.canvases.length}: ${item.label}`;

    this.filmstrip.setActive(index);
    this.renderSidebar();
    this.options.onCanvasChange?.(item, index);

    if (item.navPlaceRefUrl && !item.navPlaceLoaded) {
      await this.loadExternalNavPlace(item.navPlaceRefUrl, {
        scope: 'canvas',
        canvasIndex: item.index,
        canvasLabel: item.label,
      });
    }

    if (item.externalAnnotationUrls?.length && !item.externalAnnotationsLoaded) {
      await this.loadExternalAnnotations(item, manifest.isV3);
    }
  }

  async loadExternalAnnotations(item, isV3) {
    item.externalAnnotationsLoaded = true;
    try {
      const fetched = await Promise.all(
        item.externalAnnotationUrls.map(async (rawUrl) => {
          const res = await fetch(this.resolveUrl(rawUrl, 'annotation'));
          if (!res.ok) return [];
          const data = await res.json();
          const list = isV3 ? data.items || [] : data.resources || [];
          return parseAnnotationItems(list, isV3);
        })
      );

      const newAnnos = fetched.flat();
      if (newAnnos.length) {
        item.annotations.push(...newAnnos);
        if (this.state.manifest?.canvases[this.state.canvasIndex] === item) {
          const boxed = item.annotations.filter((a) => Array.isArray(a.xywh) && a.xywh.length === 4);
          if (boxed.length && item.kind !== 'scene' && (item.image.infoJsonUrl || item.image.staticUrl)) {
            this.osdController.renderAnnotationOverlays(boxed);
          }
          this.renderSidebar();
        }
      }
    } catch {
      // Non-fatal if external annotation endpoint is unreachable
    }
  }

  async mountSceneViewer(container, item) {
    this.destroySceneViewer();
    if (!container) return;

    const resolvedModelUrl = this.resolveUrl(item.scene.modelUrl, 'model');

    if (typeof this.options.onSelectScene === 'function') {
      this.activeModelViewer = this.options.onSelectScene(
        container,
        { ...item.scene, modelUrl: resolvedModelUrl },
        {
          theme: this.state.theme,
          title: item.label,
        }
      );
      return;
    }

    const { BuiltInSceneViewer } = await import('./scene-viewer.js');
    if (this.state.canvasIndex !== item.index) return;

    this.activeModelViewer = new BuiltInSceneViewer(container, item.scene, {
      theme: this.state.theme,
      title: item.label,
      resolvedModelUrl,
      dracoDecoderPath: this.options.dracoDecoderPath,
      onModelLoaded: (stats) => {
        this.state.modelStats = stats;
        this.renderSidebar();
      },
    });
  }

  destroySceneViewer() {
    this.activeModelViewer?.destroy?.();
    this.activeModelViewer = null;
    const sceneEl = this.wrapper.querySelector('[data-el="scene-container"]');
    if (sceneEl) sceneEl.innerHTML = '';
  }

  renderSidebar() {
    const manifest = this.state.manifest;
    if (!manifest) return;
    const currentCanvas = manifest.canvases[this.state.canvasIndex];
    this.sidebar.render(manifest, currentCanvas, {
      manifestUrl: this.state.currentUrl,
      modelStats: this.state.modelStats,
      hasRemoteSearch: this.searchController.hasRemoteSearch(),
      navFeatures: this.collectNavFeatures(manifest, currentCanvas),
    });
  }

  async copyToClipboard(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = original;
      }, 1500);
    } catch {
      // Clipboard API unavailable
    }
  }

  setLoading(loading) {
    this.wrapper.querySelector('[data-el="loading-box"]')?.classList.toggle('hidden', !loading);
    const status = this.wrapper.querySelector('[data-el="status-message"]');
    if (status && loading) status.textContent = 'Loading IIIF manifest.';
    else if (status?.textContent === 'Loading IIIF manifest.') status.textContent = '';
  }

  setError(message) {
    const box = this.wrapper.querySelector('[data-el="error-box"]');
    if (!box) return;
    box.textContent = message || '';
    box.classList.toggle('hidden', !message);
    const alert = this.wrapper.querySelector('[data-el="error-message"]');
    if (alert) alert.textContent = message || '';
  }

  destroy() {
    this.fetchAbortController?.abort();
    this.searchController?.destroy();
    this.fullscreen?.destroy();
    this.destroyNavMap();
    this.destroySceneViewer();
    this.inspectionTools?.destroy();
    this.imageDownload?.destroy();
    this.osdController?.destroy();
    this.container.innerHTML = '';
  }
}