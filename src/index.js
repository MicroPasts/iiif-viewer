import OpenSeadragon from 'openseadragon';
import './style.css';
import { parseIIIFManifest } from './parser.js';
import { BuiltInSceneViewer } from './scene-viewer.js';
import {
  renderShell,
  renderMetadataTab,
  renderStructuresTab,
  renderAnnotationsTab,
  escapeHtml,
} from './template.js';

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
      theme: options.theme || 'dark',
      showUrlInput: options.showUrlInput ?? true,
      showSidebar: options.showSidebar ?? defaultSidebarOpen,
      height: options.height || '680px',
      initialCanvas: options.initialCanvas || 0,
      fetchOptions: options.fetchOptions || {},
      onSelectScene: options.onSelectScene || null,
    };

    this.state = {
      theme: this.options.theme,
      currentUrl: this.options.manifestUrl,
      manifest: null,
      canvasIndex: this.options.initialCanvas,
      activeTab: 'metadata',
      sidebarOpen: Boolean(this.options.showSidebar),
      isFullscreen: false,
    };

    this.osd = null;
    this.activeModelViewer = null;
    this._onFullscreenChange = this.handleFullscreenChange.bind(this);
    this._onKeyDown = this.handleKeyDown.bind(this);

    this.mount();

    if (this.options.manifest) {
      this.setManifest(this.options.manifest);
    } else if (this.options.manifestUrl) {
      this.loadManifest(this.options.manifestUrl);
    }
  }

  /**
   * Resolves a manifest or asset URL through proxyRoutes, assetProxyUrl, or proxyUrl.
   * @param {string} url
   * @param {'manifest'|'image'|'model'|'thumbnail'} resourceType
   */
  resolveUrl(url, resourceType = 'asset') {
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }

    const routes = this.options.proxyRoutes;
    if (typeof routes === 'function') {
      const rewritten = routes(url, resourceType);
      if (rewritten) return rewritten;
    } else if (Array.isArray(routes)) {
      for (const rule of routes) {
        if (!rule) continue;
        if (rule.types && !rule.types.includes(resourceType)) continue;
        if (typeof rule.match === 'string' && url.startsWith(rule.match)) {
          return `${rule.replace}${url.slice(rule.match.length)}`;
        }
        if (rule.match instanceof RegExp && rule.match.test(url)) {
          return url.replace(rule.match, rule.replace);
        }
      }
    } else if (routes && typeof routes === 'object') {
      for (const [prefix, replacement] of Object.entries(routes)) {
        if (url.startsWith(prefix)) {
          return `${replacement}${url.slice(prefix.length)}`;
        }
      }
    }

    if (resourceType === 'manifest' && this.options.proxyUrl) {
      return `${this.options.proxyUrl}${encodeURIComponent(url)}`;
    }

    if (resourceType !== 'manifest' && this.options.assetProxyUrl) {
      return `${this.options.assetProxyUrl}${encodeURIComponent(url)}`;
    }

    return url;
  }

  setProxyRoutes(proxyRoutes) {
    this.options.proxyRoutes = proxyRoutes;
    if (this.state.manifest) {
      this.renderFilmstrip();
      this.goToCanvas(this.state.canvasIndex);
    }
  }

  mount() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = this.state.theme === 'dark' ? 'dark' : '';
    this.wrapper.innerHTML = renderShell({
      showUrlInput: this.options.showUrlInput,
      currentUrl: this.state.currentUrl,
      height: this.options.height,
    });

    this.container.innerHTML = '';
    this.container.appendChild(this.wrapper);

    this.syncSidebarUI();
    this.initOpenSeadragon();
    this.bindEvents();
    this.updateTabStyles();
  }

  syncSidebarUI() {
    const sidebar = this.wrapper.querySelector('[data-el="sidebar"]');
    sidebar?.classList.toggle('hidden', !this.state.sidebarOpen);

    const toggleBtn = this.wrapper.querySelector('button[data-action="toggle-sidebar"]');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', String(this.state.sidebarOpen));
    }
  }

  initOpenSeadragon() {
    const osdEl = this.wrapper.querySelector('[data-el="osd-container"]');
    this.osd = OpenSeadragon({
      element: osdEl,
      showNavigationControl: false,
      crossOriginPolicy: 'Anonymous',
      animationTime: 0.4,
      blendTime: 0.1,
      maxZoomPixelRatio: 2.5,
      visibilityRatio: 0.8,
      constrainDuringPan: true,
    });
  }

  bindEvents() {
    this.wrapper.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (actionEl) {
        const action = actionEl.dataset.action;
        if (action === 'toggle-theme') this.toggleTheme();
        if (action === 'toggle-sidebar') this.toggleSidebar();
        if (action === 'toggle-fullscreen') this.toggleFullscreen();
        if (action === 'zoom-in') this.osd?.viewport.zoomBy(1.4);
        if (action === 'zoom-out') this.osd?.viewport.zoomBy(0.7);
        if (action === 'zoom-home') this.osd?.viewport.goHome();
        if (action === 'rotate') {
          const current = this.osd?.viewport.getRotation() || 0;
          this.osd?.viewport.setRotation((current + 90) % 360);
        }
        if (action === 'prev-canvas') this.goToCanvas(this.state.canvasIndex - 1);
        if (action === 'next-canvas') this.goToCanvas(this.state.canvasIndex + 1);
        return;
      }

      const tabEl = e.target.closest('[data-tab]');
      if (tabEl) {
        this.state.activeTab = tabEl.dataset.tab;
        this.updateTabStyles();
        this.renderSidebarContent();
        return;
      }

      const canvasBtn = e.target.closest('[data-canvas-index]');
      if (canvasBtn) {
        this.goToCanvas(parseInt(canvasBtn.dataset.canvasIndex, 10));
      }
    });

    const form = this.wrapper.querySelector('[data-el="url-form"]');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = this.wrapper.querySelector('[data-el="url-input"]');
        if (input?.value.trim()) {
          this.loadManifest(input.value.trim());
        }
      });
    }

    document.addEventListener('fullscreenchange', this._onFullscreenChange);
    document.addEventListener('keydown', this._onKeyDown);
  }

  // --- Fullscreen Lifecycle ---

  async enterFullscreen() {
    if (this.state.isFullscreen) return;

    if (this.wrapper.requestFullscreen && document.fullscreenEnabled) {
      try {
        await this.wrapper.requestFullscreen();
        return;
      } catch {
        // Fallback for sandboxed iframes
      }
    }

    this.applyFullscreenStyles(true);
  }

  async exitFullscreen() {
    if (!this.state.isFullscreen) return;

    if (document.fullscreenElement === this.wrapper && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
        return;
      } catch {
        // Fallback
      }
    }

    this.applyFullscreenStyles(false);
  }

  toggleFullscreen() {
    if (this.state.isFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  handleFullscreenChange() {
    const active = document.fullscreenElement === this.wrapper;
    this.applyFullscreenStyles(active);
  }

  handleKeyDown(e) {
    if (e.key === 'Escape' && this.state.isFullscreen && !document.fullscreenElement) {
      this.exitFullscreen();
    }
  }

  applyFullscreenStyles(active) {
    this.state.isFullscreen = active;
    const root = this.wrapper.querySelector('[data-el="viewer-root"]');
    const enterIcon = this.wrapper.querySelector('[data-icon="enter-fullscreen"]');
    const exitIcon = this.wrapper.querySelector('[data-icon="exit-fullscreen"]');

    if (root) {
      if (active) {
        this.wrapper.classList.add('fixed', 'inset-0', 'z-50');
        root.style.height = '100vh';
        root.classList.remove('rounded-xl', 'border');
      } else {
        this.wrapper.classList.remove('fixed', 'inset-0', 'z-50');
        root.style.height = this.options.height;
        root.classList.add('rounded-xl', 'border');
      }
    }

    enterIcon?.classList.toggle('hidden', active);
    exitIcon?.classList.toggle('hidden', !active);

    requestAnimationFrame(() => {
      this.osd?.viewport?.resize();
      this.osd?.viewport?.applyConstraints();
      this.activeModelViewer?.handleResize?.();
    });
  }

  // --- Public API ---

  setTheme(theme) {
    this.state.theme = theme === 'light' ? 'light' : 'dark';
    this.wrapper.classList.toggle('dark', this.state.theme === 'dark');
    this.activeModelViewer?.setTheme?.(this.state.theme);
  }

  toggleTheme() {
    this.setTheme(this.state.theme === 'dark' ? 'light' : 'dark');
  }

  toggleSidebar() {
    this.state.sidebarOpen = !this.state.sidebarOpen;
    this.syncSidebarUI();

    requestAnimationFrame(() => {
      this.osd?.viewport?.resize();
      this.osd?.viewport?.applyConstraints();
      this.activeModelViewer?.handleResize?.();
    });
  }

  async loadManifest(url) {
    this.state.currentUrl = url;
    const input = this.wrapper.querySelector('[data-el="url-input"]');
    if (input) input.value = url;

    this.setLoading(true);
    this.setError(null);

    try {
      const fetchOpts = { ...this.options.fetchOptions };
      if (this.options.fetchOptions.headers) {
        fetchOpts.headers = this.options.fetchOptions.headers;
      }

      const targetUrl = this.resolveUrl(url, 'manifest');
      const res = await fetch(targetUrl, fetchOpts);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      this.setManifest(json);
    } catch (err) {
      const isCorsOrNetwork =
        err instanceof TypeError && /fetch|network/i.test(err.message);
      this.setError(
        isCorsOrNetwork
          ? `Network or CORS error fetching manifest from ${url}. Ensure the server allows cross-origin requests or configure proxyUrl / proxyRoutes.`
          : err.message || 'Failed to load IIIF Manifest.'
      );
    } finally {
      this.setLoading(false);
    }
  }

  setManifest(jsonOrString) {
    try {
      const raw = typeof jsonOrString === 'string' ? JSON.parse(jsonOrString) : jsonOrString;
      const parsed = parseIIIFManifest(raw);
      if (!parsed.canvases.length) {
        throw new Error('Manifest contains no displayable canvases or 3D scenes.');
      }

      this.state.manifest = parsed;
      this.state.canvasIndex = Math.min(this.options.initialCanvas, parsed.canvases.length - 1);
      this.setError(null);

      this.wrapper.querySelector('[data-el="empty-state"]')?.classList.add('hidden');

      const vBadge = this.wrapper.querySelector('[data-el="version-badge"]');
      if (vBadge) {
        vBadge.textContent = `v${parsed.version}`;
        vBadge.classList.remove('hidden');
      }

      const titleEl = this.wrapper.querySelector('[data-el="manifest-title"]');
      if (titleEl) titleEl.textContent = parsed.label;

      this.renderFilmstrip();
      this.goToCanvas(this.state.canvasIndex);
    } catch (err) {
      this.setError(err.message);
    }
  }

  goToCanvas(index) {
    const manifest = this.state.manifest;
    if (!manifest || index < 0 || index >= manifest.canvases.length) return;

    this.state.canvasIndex = index;
    const item = manifest.canvases[index];

    const osdEl = this.wrapper.querySelector('[data-el="osd-container"]');
    const sceneEl = this.wrapper.querySelector('[data-el="scene-container"]');
    const zoomControls = this.wrapper.querySelector('[data-el="zoom-controls"]');

    if (item.kind === 'scene' && item.scene?.modelUrl) {
      osdEl?.classList.add('hidden');
      zoomControls?.classList.add('hidden');
      sceneEl?.classList.remove('hidden');
      this.mountSceneViewer(sceneEl, item);
    } else {
      this.destroySceneViewer();
      sceneEl?.classList.add('hidden');
      osdEl?.classList.remove('hidden');
      zoomControls?.classList.remove('hidden');

      if (item.image.infoJsonUrl) {
        this.osd.open(this.resolveUrl(item.image.infoJsonUrl, 'image'));
      } else if (item.image.staticUrl) {
        this.osd.open({ type: 'image', url: this.resolveUrl(item.image.staticUrl, 'image') });
      }
    }

    const pager = this.wrapper.querySelector('[data-el="pager-controls"]');
    const counter = this.wrapper.querySelector('[data-el="canvas-counter"]');
    if (pager && counter) {
      pager.classList.toggle('hidden', manifest.canvases.length <= 1);
      counter.textContent = `${index + 1} / ${manifest.canvases.length}`;
    }

    this.highlightActiveThumbnail();
    this.renderSidebarContent();
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
    if (this.state.canvasIndex !== item.index) return; // Guard if user switched canvases while loading

    this.activeModelViewer = new BuiltInSceneViewer(container, item.scene, {
      theme: this.state.theme,
      title: item.label,
      resolvedModelUrl,
      dracoDecoderPath: this.options.dracoDecoderPath,
    });
  }

  destroySceneViewer() {
    this.activeModelViewer?.destroy?.();
    this.activeModelViewer = null;
    const sceneEl = this.wrapper.querySelector('[data-el="scene-container"]');
    if (sceneEl) sceneEl.innerHTML = '';
  }

  destroy() {
    document.removeEventListener('fullscreenchange', this._onFullscreenChange);
    document.removeEventListener('keydown', this._onKeyDown);
    if (this.state.isFullscreen) {
      this.exitFullscreen();
    }
    this.destroySceneViewer();
    this.osd?.destroy();
    this.container.innerHTML = '';
  }

  // --- Internal UI Helpers ---

  updateTabStyles() {
    this.wrapper.querySelectorAll('[data-tab]').forEach((btn) => {
      const active = btn.dataset.tab === this.state.activeTab;
      btn.className = active
        ? 'flex-1 py-2.5 text-center border-b-2 border-purple-600 text-purple-700 dark:text-purple-400 font-semibold transition'
        : 'flex-1 py-2.5 text-center border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition';
    });
  }

  renderSidebarContent() {
    const container = this.wrapper.querySelector('[data-el="sidebar-content"]');
    const manifest = this.state.manifest;
    if (!container || !manifest) return;

    const currentCanvas = manifest.canvases[this.state.canvasIndex];

    if (this.state.activeTab === 'metadata') {
      container.innerHTML = renderMetadataTab(manifest, currentCanvas);
    } else if (this.state.activeTab === 'structures') {
      container.innerHTML = renderStructuresTab(manifest.structures, this.state.canvasIndex);
    } else if (this.state.activeTab === 'annotations') {
      container.innerHTML = renderAnnotationsTab(currentCanvas);
    }
  }

  renderFilmstrip() {
    const strip = this.wrapper.querySelector('[data-el="filmstrip"]');
    const canvases = this.state.manifest?.canvases || [];
    if (!strip) return;

    if (canvases.length <= 1) {
      strip.classList.add('hidden');
      return;
    }

    strip.classList.remove('hidden');
    strip.innerHTML = canvases
      .map((c) => {
        const thumbUrl = c.image.thumbnail ? this.resolveUrl(c.image.thumbnail, 'thumbnail') : null;
        return `
        <button
          type="button"
          data-canvas-index="${c.index}"
          title="${escapeHtml(c.label)}"
          class="group relative h-18 w-16 shrink-0 rounded-md overflow-hidden border-2 border-transparent bg-slate-200 dark:bg-slate-800 transition focus:outline-hidden"
        >
          ${
            thumbUrl
              ? `<img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(c.label)}" class="w-full h-full object-cover" loading="lazy" />`
              : `<span class="text-[10px] text-slate-500 p-1 block truncate">${escapeHtml(c.label)}</span>`
          }
          ${
            c.kind === 'scene'
              ? `<span class="absolute top-1 right-1 px-1 rounded bg-amber-500 text-slate-950 text-[8px] font-bold">3D</span>`
              : ''
          }
          <span class="absolute bottom-0 inset-x-0 bg-slate-950/75 text-white text-[9px] font-mono px-1 truncate">
            ${c.index + 1}
          </span>
        </button>`;
      })
      .join('');
  }

  highlightActiveThumbnail() {
    const strip = this.wrapper.querySelector('[data-el="filmstrip"]');
    if (!strip) return;
    strip.querySelectorAll('[data-canvas-index]').forEach((btn) => {
      const idx = parseInt(btn.dataset.canvasIndex, 10);
      btn.classList.toggle('border-purple-500', idx === this.state.canvasIndex);
      btn.classList.toggle('border-transparent', idx !== this.state.canvasIndex);
    });
  }

  setLoading(loading) {
    this.wrapper.querySelector('[data-el="loading-box"]')?.classList.toggle('hidden', !loading);
  }

  setError(message) {
    const box = this.wrapper.querySelector('[data-el="error-box"]');
    if (!box) return;
    box.textContent = message || '';
    box.classList.toggle('hidden', !message);
  }
}