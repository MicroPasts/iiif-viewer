import { escapeHtml, getPlainText, sanitizeHtml } from './sanitize.js';

const defaultExternalViewers = [
  { label: 'Universal Viewer', url: 'https://www.universalviewer.dev/#?iiifManifestId={manifest}' },
  { label: 'Tify', url: 'https://tify.rocks/?manifest={manifest}' },
];

export function configureExternalViewers(option) {
  if (option === undefined) return defaultExternalViewers;
  if (option === false) return [];
  if (!option || typeof option !== 'object' || Array.isArray(option)) {
    throw new TypeError('externalViewers must be false or an object with mode and viewers.');
  }
  const { mode = 'append', viewers = [] } = option;
  if (!['append', 'replace'].includes(mode) || !Array.isArray(viewers)) {
    throw new TypeError('externalViewers requires an append or replace mode and a viewers array.');
  }
  for (const viewer of viewers) {
    if (!viewer || typeof viewer.label !== 'string' || !viewer.label.trim() ||
        typeof viewer.url !== 'string' || !viewer.url.includes('{manifest}')) {
      throw new TypeError('Each external viewer requires a label and a URL containing {manifest}.');
    }
    let url;
    try {
      url = new URL(viewer.url.replaceAll('{manifest}', encodeURIComponent('https://example.org/manifest')));
    } catch {
      throw new TypeError('External viewer URLs must be valid HTTP or HTTPS URLs.');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new TypeError('External viewer URLs must be valid HTTP or HTTPS URLs.');
    }
  }
  const customViewers = viewers.map(({ label, url }) => ({ label, url }));
  return mode === 'append' ? [...defaultExternalViewers, ...customViewers] : customViewers;
}

function getPlainTextLength(htmlOrText) {
  return getPlainText(htmlOrText).trim().length;
}

export class SidebarPanel {
  constructor(wrapper, {
    isOpen = true,
    summaryCollapseLength = 300,
    externalViewers = defaultExternalViewers,
    onTabChange = () => {},
    onSelectCanvas = () => {},
    onFocusAnnotation = () => {},
    onToggleAnnotations = () => {},
    onChangeLanguage = () => {},
    onCopyText = () => {},
    onSearch = async () => [],
    onSelectSearchHit = () => {},
    onMountMap = () => {},
    onFocusMapFeature = () => {},
    onPanMap = () => {},
  } = {}) {
    this.wrapper = wrapper;
    this.isOpen = Boolean(isOpen);
    this.summaryCollapseLength =
      typeof summaryCollapseLength === 'number' && summaryCollapseLength > 0
        ? summaryCollapseLength
        : null;
    this.externalViewers = externalViewers;
    this.activeTab = 'metadata';
    this.annotationsVisible = true;
    this.summaryExpanded = false;
    this.selectedLang = 'en';

    this.searchQuery = '';
    this.searchResults = [];
    this.searching = false;
    this.searchError = '';
    this.searchGeneration = 0;
    this.hasRemoteSearch = false;
    this.currentNavFeatures = [];

    this.onTabChange = onTabChange;
    this.onSelectCanvas = onSelectCanvas;
    this.onFocusAnnotation = onFocusAnnotation;
    this.onToggleAnnotations = onToggleAnnotations;
    this.onChangeLanguage = onChangeLanguage;
    this.onCopyText = onCopyText;
    this.onSearch = onSearch;
    this.onSelectSearchHit = onSelectSearchHit;
    this.onMountMap = onMountMap;
    this.onFocusMapFeature = onFocusMapFeature;
    this.onPanMap = onPanMap;

    this.bindEvents();
    this.syncOpenUI();
    this.updateTabStyles();
  }

  resetSearch() {
    this.searchGeneration += 1;
    this.searchQuery = '';
    this.searchResults = [];
    this.searching = false;
    this.searchError = '';
  }

  bindEvents() {
    const sidebar = this.wrapper.querySelector('[data-el="sidebar"]');
    if (!sidebar) return;

    sidebar.addEventListener('keydown', (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      const tabs = [...sidebar.querySelectorAll('[role="tab"]')];
      const index = tabs.indexOf(tab);
      const next = e.key === 'Home' ? 0
        : e.key === 'End' ? tabs.length - 1
          : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      e.preventDefault();
      this.setTab(tabs[next].dataset.tab);
      tabs[next].focus();
    });

    sidebar.addEventListener('click', (e) => {
      const tabEl = e.target.closest('[data-tab]');
      if (tabEl) {
        this.setTab(tabEl.dataset.tab);
        return;
      }

      const summaryToggle = e.target.closest('[data-action="toggle-summary"]');
      if (summaryToggle) {
        this.summaryExpanded = !this.summaryExpanded;
        const body = sidebar.querySelector('[data-el="summary-body"]');
        if (body) {
          body.classList.toggle('line-clamp-4', !this.summaryExpanded);
        }
        summaryToggle.textContent = this.summaryExpanded ? 'Show less' : 'Show more';
        summaryToggle.setAttribute('aria-expanded', String(this.summaryExpanded));
        return;
      }

      const mapFeatBtn = e.target.closest('[data-nav-feature-index]');
      if (mapFeatBtn) {
        const idx = parseInt(mapFeatBtn.dataset.navFeatureIndex, 10);
        const feat = this.currentNavFeatures[idx];
        if (feat) this.onFocusMapFeature(feat);
        return;
      }

      const mapPanBtn = e.target.closest('[data-map-pan]');
      if (mapPanBtn) {
        const directions = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
        const direction = directions[mapPanBtn.dataset.mapPan];
        if (direction) this.onPanMap(...direction);
        return;
      }

      const hitBtn = e.target.closest('[data-search-hit-index]');
      if (hitBtn) {
        const idx = parseInt(hitBtn.dataset.searchHitIndex, 10);
        const hit = this.searchResults[idx];
        if (hit) this.onSelectSearchHit(hit);
        return;
      }

      const canvasBtn = e.target.closest('[data-canvas-index]');
      if (canvasBtn) {
        this.onSelectCanvas(parseInt(canvasBtn.dataset.canvasIndex, 10));
        return;
      }

      const annoBtn = e.target.closest('[data-anno-focus]');
      if (annoBtn) {
        this.onFocusAnnotation(parseInt(annoBtn.dataset.annoFocus, 10));
        return;
      }

      const toggleOverlayBtn = e.target.closest('[data-action="toggle-anno-overlays"]');
      if (toggleOverlayBtn) {
        this.annotationsVisible = !this.annotationsVisible;
        this.onToggleAnnotations(this.annotationsVisible);
        toggleOverlayBtn.textContent = this.annotationsVisible ? 'Hide Boxes' : 'Show Boxes';
        return;
      }

      const copyBtn = e.target.closest('[data-copy-value]');
      if (copyBtn) {
        const text = copyBtn.dataset.copyValue;
        this.onCopyText(text, copyBtn);
      }
    });

    sidebar.addEventListener('submit', async (e) => {
      if (e.target.matches('[data-el="manifest-search-form"]')) {
        e.preventDefault();
        const input = sidebar.querySelector('[data-el="manifest-search-input"]');
        const generation = ++this.searchGeneration;
        this.searchQuery = (input?.value || '').trim();
        this.searchResults = [];
        this.searchError = '';
        if (!this.searchQuery) {
          this.searching = false;
          this.renderSearchTab();
          return;
        }
        this.searching = true;
        this.renderSearchTab();
        try {
          const results = await this.onSearch(this.searchQuery);
          if (generation === this.searchGeneration) this.searchResults = results;
        } catch (error) {
          if (error?.name !== 'AbortError') console.error('IIIF search failed:', error);
          if (generation === this.searchGeneration) {
            this.searchError = error?.name === 'AbortError'
              ? 'Search cancelled.'
              : 'Search failed. Please try again.';
          }
        } finally {
          if (generation === this.searchGeneration) {
            this.searching = false;
            this.renderSearchTab();
          }
        }
      }
    });

    sidebar.addEventListener('change', (e) => {
      if (e.target.matches('[data-el="lang-select"]')) {
        this.selectedLang = e.target.value;
        this.onChangeLanguage(this.selectedLang);
      }
    });
  }

  setOpen(open) {
    const sidebar = this.wrapper.querySelector('[data-el="sidebar"]');
    const restoreFocus = !open && sidebar?.contains(document.activeElement);
    this.isOpen = Boolean(open);
    this.syncOpenUI();
    if (restoreFocus) this.wrapper.querySelector('button[data-action="toggle-sidebar"]')?.focus();
  }

  toggle() {
    this.setOpen(!this.isOpen);
  }

  syncOpenUI() {
    const sidebar = this.wrapper.querySelector('[data-el="sidebar"]');
    sidebar?.classList.toggle('hidden', !this.isOpen);

    const toggleBtn = this.wrapper.querySelector('button[data-action="toggle-sidebar"]');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', String(this.isOpen));
    }
  }

  setTab(tab) {
    this.activeTab = tab;
    this.updateTabStyles();
    this.onTabChange(tab);
  }

  updateTabStyles() {
    this.wrapper.querySelectorAll('[data-tab]').forEach((btn) => {
      const active = btn.dataset.tab === this.activeTab;
      btn.setAttribute('aria-selected', String(active));
      btn.tabIndex = active ? 0 : -1;
      if (active) {
        this.wrapper.querySelector('[data-el="sidebar-content"]')?.setAttribute('aria-labelledby', btn.id);
      }
      btn.className = active
        ? 'flex-1 py-2.5 text-center border-b-2 border-purple-600 text-purple-700 dark:text-purple-400 font-semibold transition'
        : 'flex-1 py-2.5 text-center border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition';
    });
  }

  render(
    manifest,
    currentCanvas,
    { manifestUrl = '', modelStats = null, hasRemoteSearch = false, navFeatures = [] } = {}
  ) {
    const container = this.wrapper.querySelector('[data-el="sidebar-content"]');
    if (!container || !manifest) return;
    const focused = container.contains(document.activeElement) ? document.activeElement : null;
    const focusAttribute = focused && ['data-el', 'data-action', 'data-canvas-index', 'data-search-hit-index', 'data-nav-feature-index', 'data-anno-focus', 'data-copy-value']
      .find((attr) => focused.hasAttribute(attr));
    const focusValue = focusAttribute && focused.getAttribute(focusAttribute);

    this.hasRemoteSearch = Boolean(hasRemoteSearch);
    this.currentNavFeatures = Array.isArray(navFeatures) ? navFeatures : [];

    const notesTab = this.wrapper.querySelector('[data-tab="annotations"]');
    const annoCount = currentCanvas?.annotations?.length || 0;
    if (notesTab) {
      notesTab.textContent = annoCount > 0 ? `Notes (${annoCount})` : 'Notes';
    }

    const mapTab = this.wrapper.querySelector('[data-tab="map"]');
    if (mapTab) {
      mapTab.textContent =
        this.currentNavFeatures.length > 0 ? `Map (${this.currentNavFeatures.length})` : 'Map';
    }

    if (this.activeTab === 'metadata') {
      container.innerHTML = this.renderMetadataTab(manifest, currentCanvas, manifestUrl, modelStats);
    } else if (this.activeTab === 'structures') {
      container.innerHTML = this.renderStructuresTab(manifest.structures, currentCanvas?.index ?? 0);
    } else if (this.activeTab === 'annotations') {
      container.innerHTML = this.renderAnnotationsTab(currentCanvas);
    } else if (this.activeTab === 'search') {
      container.innerHTML = this.buildSearchTabHtml();
    } else if (this.activeTab === 'map') {
      container.innerHTML = this.renderMapTab();
      const mapHost = container.querySelector('[data-el="navplace-map-container"]');
      if (mapHost && this.currentNavFeatures.length > 0) {
        this.onMountMap(mapHost, {
          type: 'FeatureCollection',
          features: this.currentNavFeatures,
        });
      }
    }
    if (focused) {
      const replacement = focused === container ? container
        : focusAttribute && [...container.querySelectorAll(`[${focusAttribute}]`)]
          .find((el) => el.getAttribute(focusAttribute) === focusValue);
      (replacement || this.wrapper.querySelector(`[data-tab="${this.activeTab}"]`))?.focus();
    }
  }

  renderMapTab() {
    if (!this.currentNavFeatures.length) {
      return `<p class="text-slate-500 dark:text-slate-400 italic">No IIIF navPlace geographic features found on this manifest or canvas.</p>`;
    }

    return `
      <div class="space-y-3">
        <div
          data-el="navplace-map-container"
          class="w-full h-72 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950"
        ></div>
        <div role="group" aria-label="Move map view" class="flex items-center gap-1">
          <span class="mr-1">Pan map</span>
          <button type="button" data-map-pan="left" aria-label="Move map view left" class="px-2 rounded border border-slate-300 dark:border-slate-700">&larr;</button>
          <button type="button" data-map-pan="up" aria-label="Move map view up" class="px-2 rounded border border-slate-300 dark:border-slate-700">&uarr;</button>
          <button type="button" data-map-pan="down" aria-label="Move map view down" class="px-2 rounded border border-slate-300 dark:border-slate-700">&darr;</button>
          <button type="button" data-map-pan="right" aria-label="Move map view right" class="px-2 rounded border border-slate-300 dark:border-slate-700">&rarr;</button>
        </div>
        <div class="space-y-1.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
            Locations (${this.currentNavFeatures.length})
          </span>
          ${this.currentNavFeatures
            .map((feat, idx) => {
              const title = feat.properties?._title || `Location ${idx + 1}`;
              const geomType = feat.geometry?.type || 'Feature';
              const cIdx = feat.properties?._canvasIndex;
              return `
                <button
                  type="button"
                  data-nav-feature-index="${idx}"
                  class="w-full text-left px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-purple-500/60 transition flex items-center justify-between gap-2"
                >
                  <span class="truncate font-medium text-slate-800 dark:text-slate-200">${escapeHtml(title)}</span>
                  <span class="text-[10px] font-mono text-slate-600 dark:text-slate-400 shrink-0">
                    ${escapeHtml(geomType)}${typeof cIdx === 'number' ? ` • p.${cIdx + 1}` : ''}
                  </span>
                </button>`;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  renderSearchTab() {
    const container = this.wrapper.querySelector('[data-el="sidebar-content"]');
    if (!container || this.activeTab !== 'search') return;
    const updated = document.createElement('div');
    updated.innerHTML = this.buildSearchTabHtml();
    const results = container.querySelector('[data-el="search-results"]');
    const status = container.querySelector('[data-el="search-status"]');
    if (results) results.innerHTML = updated.querySelector('[data-el="search-results"]').innerHTML;
    if (status) status.textContent = updated.querySelector('[data-el="search-status"]').textContent;
  }

  buildSearchTabHtml() {
    const modeBadge = this.hasRemoteSearch
      ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">IIIF Search API</span>`
      : `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Local Manifest</span>`;

    let resultsHtml = '';
    const status = this.searching ? 'Searching manifest.'
      : this.searchError || (!this.searchQuery ? ''
        : `${this.searchResults.length} match${this.searchResults.length === 1 ? '' : 'es'} found.`);
    if (this.searching) {
      resultsHtml = `<p class="text-slate-500 dark:text-slate-400 italic">Searching manifest...</p>`;
    } else if (this.searchError) {
      resultsHtml = `<p class="text-red-700 dark:text-red-300">${escapeHtml(this.searchError)}</p>`;
    } else if (!this.searchQuery) {
      resultsHtml = `<p class="text-slate-500 dark:text-slate-400 text-[11px]">Search titles, metadata, notes, and transcriptions across this manifest.</p>`;
    } else if (!this.searchResults.length) {
      resultsHtml = `<p class="text-slate-500 dark:text-slate-400 italic">No matches found for "${escapeHtml(this.searchQuery)}".</p>`;
    } else {
      resultsHtml = `
        <div class="space-y-1.5">
          <div class="text-[10px] font-mono text-slate-600 dark:text-slate-400">${this.searchResults.length} match${this.searchResults.length === 1 ? '' : 'es'}</div>
          ${this.searchResults
            .map(
              (hit, idx) => `
              <button
                type="button"
                data-search-hit-index="${idx}"
                class="w-full text-left p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-purple-500/60 transition space-y-1"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[10px] font-semibold text-purple-700 dark:text-purple-400 truncate">${escapeHtml(hit.canvasLabel)}</span>
                  <span class="text-[10px] font-mono text-slate-600 dark:text-slate-400 shrink-0">p.${hit.canvasIndex + 1}${hit.xywh ? ' • Box' : ''}</span>
                </div>
                <p class="text-slate-700 dark:text-slate-300 leading-snug line-clamp-3">${escapeHtml(hit.text)}</p>
              </button>`
            )
            .join('')}
        </div>
      `;
    }

    return `
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Search Within</span>
          ${modeBadge}
        </div>
        <form data-el="manifest-search-form" class="flex items-center gap-1.5">
          <input
            type="search"
            data-el="manifest-search-input"
            aria-label="Search within manifest"
            value="${escapeHtml(this.searchQuery)}"
            placeholder="Search term..."
            class="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
          />
          <button type="submit" class="px-2.5 py-1.5 text-xs font-medium rounded bg-purple-600 hover:bg-purple-700 text-white transition shrink-0">
            Find
          </button>
        </form>
        <div data-el="search-status" role="status" class="sr-only">${status}</div>
        <div data-el="search-results">${resultsHtml}</div>
      </div>
    `;
  }

  renderSummaryBlock(summary) {
    if (!summary) return '';
    const sanitized = sanitizeHtml(summary);
    const isCollapsible =
      this.summaryCollapseLength !== null &&
      getPlainTextLength(sanitized) > this.summaryCollapseLength;
    const clampClass = isCollapsible && !this.summaryExpanded ? 'line-clamp-4' : '';

    return `
      <div class="mt-1">
        <div
          data-el="summary-body"
          class="text-slate-600 dark:text-slate-400 leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0 ${clampClass}"
        >${sanitized}</div>
        ${
          isCollapsible
            ? `<button
                type="button"
                data-action="toggle-summary"
                aria-expanded="${String(this.summaryExpanded)}"
                class="mt-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:underline"
              >${this.summaryExpanded ? 'Show less' : 'Show more'}</button>`
            : ''
        }
      </div>
    `;
  }

  renderMetadataTab(manifest, currentCanvas, manifestUrl, modelStats) {
    const langSelector =
      manifest.availableLanguages?.length > 1
        ? `<label class="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Language</span>
            <select data-el="lang-select" class="px-2 py-0.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
              ${manifest.availableLanguages
                .map(
                  (lang) =>
                    `<option value="${escapeHtml(lang)}" ${lang === this.selectedLang ? 'selected' : ''}>${escapeHtml(lang.toUpperCase())}</option>`
                )
                .join('')}
            </select>
          </label>`
        : '';

    const metaRows = manifest.metadata
      .map(
        (m) => `
        <div class="border-b border-slate-100 dark:border-slate-800/80 pb-2">
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">${escapeHtml(m.label)}</dt>
          <dd class="text-slate-800 dark:text-slate-200 mt-0.5 break-words whitespace-pre-line [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4">${sanitizeHtml(m.value)}</dd>
        </div>`
      )
      .join('');

    const links = [...(manifest.homepage || []), ...(manifest.seeAlso || [])];
    const linksHtml = links.length
      ? `<div class="space-y-1.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">Related Endpoints</span>
          <div class="flex flex-col gap-1">
            ${links
              .map(
                (l) => `
                <a href="${escapeHtml(l.id)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-cyan-700 dark:text-cyan-400 hover:border-cyan-500/50 transition">
                  <span class="truncate font-medium">${escapeHtml(l.label)}</span>
                  <span aria-hidden="true" class="text-[10px] font-mono text-slate-600 dark:text-slate-400 shrink-0">&nearr;</span>
                </a>`
              )
              .join('')}
          </div>
        </div>`
      : '';

    const sourceUri = manifest.id || manifestUrl;
    const externalViewersHtml = sourceUri && this.externalViewers.length
      ? `<div data-el="external-viewers" class="space-y-1.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">Open in Other IIIF Tools</span>
          <div class="flex flex-wrap gap-1.5">
            ${this.externalViewers.map(({ label, url }) => `
              <a href="${escapeHtml(url.replaceAll('{manifest}', encodeURIComponent(sourceUri)))}" target="_blank" rel="noopener noreferrer" class="px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] font-medium text-cyan-700 dark:text-cyan-400 hover:border-cyan-500/50 transition">
                ${escapeHtml(label)} &nearr;
              </a>`).join('')}
          </div>
        </div>`
      : '';

    const diagnosticsHtml = `
      <details class="rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 text-[11px]">
        <summary class="cursor-pointer font-semibold text-slate-600 dark:text-slate-300 select-none">
          IIIF Technical Details
        </summary>
        <div class="mt-2 space-y-2 text-slate-600 dark:text-slate-400">
          <div class="flex items-center justify-between">
            <span>Presentation API</span>
            <span class="font-mono">v${escapeHtml(manifest.version)}</span>
          </div>
          ${
            currentCanvas?.image?.serviceProfile
              ? `<div class="flex items-center justify-between gap-2">
                  <span>Image Service</span>
                  <span class="font-mono truncate max-w-[165px]" title="${escapeHtml(String(currentCanvas.image.serviceProfile))}">${escapeHtml(String(currentCanvas.image.serviceProfile).split('/').pop())}</span>
                </div>`
              : ''
          }
          ${
            modelStats
              ? `<div class="flex items-center justify-between">
                  <span>3D Geometry</span>
                  <span class="font-mono">${modelStats.meshes} meshes / ${modelStats.triangles.toLocaleString()} tris</span>
                </div>`
              : ''
          }
          ${
            sourceUri
              ? `<div class="pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <a href="${escapeHtml(sourceUri)}" target="_blank" rel="noopener noreferrer" class="text-cyan-700 dark:text-cyan-400 hover:underline truncate">Open Raw JSON &nearr;</a>
                  <button type="button" data-copy-value="${escapeHtml(sourceUri)}" class="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-purple-600 hover:text-white text-[10px] font-medium transition shrink-0">
                    Copy URI
                  </button>
                </div>`
              : ''
          }
        </div>
      </details>
    `;

    return `
      <div class="space-y-3">
        ${langSelector}
        <div>
          <h4 class="text-sm font-bold text-slate-900 dark:text-white">${escapeHtml(manifest.label)}</h4>
          ${this.renderSummaryBlock(manifest.summary)}
        </div>

        ${
          currentCanvas
            ? `<div class="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                    ${currentCanvas.kind === 'scene' ? 'Current 3D Scene' : 'Current Canvas'}
                  </span>
                  ${
                    currentCanvas.kind === 'scene'
                      ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300">GLB / 3D</span>`
                      : ''
                  }
                </div>
                <span class="font-medium text-slate-900 dark:text-slate-100 block mt-0.5">${escapeHtml(currentCanvas.label)}</span>
                ${
                  currentCanvas.image.width && currentCanvas.image.height
                    ? `<span class="block text-[10px] font-mono text-slate-700 dark:text-slate-300 mt-0.5">${currentCanvas.image.width} &times; ${currentCanvas.image.height} px</span>`
                    : ''
                }
              </div>`
            : ''
        }

        ${metaRows ? `<dl class="space-y-2.5">${metaRows}</dl>` : ''}
        ${linksHtml}
        ${externalViewersHtml}

        ${
          manifest.attribution
            ? `<div class="p-2.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                <strong class="block text-slate-700 dark:text-slate-300 mb-0.5">Attribution</strong>
                <div>${sanitizeHtml(manifest.attribution)}</div>
              </div>`
            : ''
        }

        ${
          manifest.rights
            ? `<div>
                <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">Rights / License</span>
                <a href="${escapeHtml(manifest.rights)}" target="_blank" rel="noopener noreferrer" class="text-cyan-700 dark:text-cyan-400 hover:underline break-all">${escapeHtml(manifest.rights)}</a>
              </div>`
            : ''
        }

        ${diagnosticsHtml}
      </div>
    `;
  }

  renderStructuresTab(structures, activeCanvasIndex) {
    if (!structures.length) {
      return `<p class="text-slate-500 dark:text-slate-400 italic">This manifest does not define structural ranges or a table of contents.</p>`;
    }

    const renderNodes = (nodes, depth = 0) =>
      nodes
        .map((s) => {
          const isCurrent = s.canvasIndex === activeCanvasIndex;
          const padLeft = 10 + depth * 14;
          const childHtml = s.children?.length ? renderNodes(s.children, depth + 1) : '';
          return `
            <button
              type="button"
              data-canvas-index="${s.canvasIndex}"
              ${isCurrent ? 'aria-current="true"' : ''}
              style="padding-left: ${padLeft}px;"
              class="w-full text-left pr-2.5 py-2 rounded-md transition flex items-center justify-between gap-2 ${
                isCurrent
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }"
            >
              <span class="truncate">${depth > 0 ? '&rdsh; ' : ''}${escapeHtml(s.label)}</span>
              <span class="text-[10px] font-mono shrink-0">p.${s.canvasIndex + 1}</span>
            </button>
            ${childHtml}`;
        })
        .join('');

    return `<div class="space-y-1">${renderNodes(structures)}</div>`;
  }

  renderAnnotationsTab(currentCanvas) {
    const annos = currentCanvas?.annotations || [];
    if (!annos.length) {
      return `<p class="text-slate-500 dark:text-slate-400 italic">No transcriptions or annotations attached to this canvas.</p>`;
    }

    const hasBoxes = annos.some((a) => Array.isArray(a.xywh) && a.xywh.length === 4);
    const toolbar = hasBoxes
      ? `<div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Region Overlays</span>
          <button type="button" data-action="toggle-anno-overlays" class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-purple-600 hover:text-white transition">
            ${this.annotationsVisible ? 'Hide Boxes' : 'Show Boxes'}
          </button>
        </div>`
      : '';

    return `
      <div class="space-y-2.5">
        ${toolbar}
        ${annos
          .map(
            (a, idx) => `
            <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20">
                  ${escapeHtml(a.motivation)}
                </span>
                ${
                  a.xywh
                    ? `<button type="button" data-anno-focus="${idx}" title="Zoom to region on canvas" class="text-[10px] font-mono text-purple-600 dark:text-purple-400 hover:underline">
                        Zoom region &rarr;
                      </button>`
                    : ''
                }
              </div>
              <div class="text-slate-800 dark:text-slate-200 leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0">${sanitizeHtml(a.text)}</div>
            </div>`
          )
          .join('')}
      </div>
    `;
  }
}