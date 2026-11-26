// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderShell } from '../src/template.js';
import { SidebarPanel } from '../src/sidebar.js';
import { Filmstrip } from '../src/filmstrip.js';
import { FullscreenController } from '../src/fullscreen-controller.js';
import { parseIIIFManifest } from '../src/parser.js';

let wrapper;
beforeEach(() => {
  wrapper = document.createElement('div');
  wrapper.innerHTML = renderShell({ showUrlInput: true, currentUrl: '', height: '680px' });
  document.body.append(wrapper);
  vi.stubGlobal('requestAnimationFrame', (callback) => { callback(); return 1; });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  wrapper.remove();
  vi.unstubAllGlobals();
});

describe('filmstrip', () => {
  it('renders, selects and hides canvases', () => {
    const select = vi.fn();
    const filmstrip = new Filmstrip(wrapper, { onSelectCanvas: select });
    const canvases = [
      { index: 0, label: 'First', kind: 'canvas', image: { thumbnail: 'first.jpg' } },
      { index: 1, label: 'Model', kind: 'scene', image: { thumbnail: null } },
    ];
    filmstrip.render(canvases, (url) => `/proxy/${url}`);
    const strip = wrapper.querySelector('[data-el="filmstrip"]');
    expect(strip.classList.contains('hidden')).toBe(false);
    expect(strip.querySelector('img').getAttribute('src')).toBe('/proxy/first.jpg');
    expect(strip.textContent).toContain('3D');
    filmstrip.setActive(1);
    const selected = strip.querySelector('[data-canvas-index="1"]');
    expect(selected.classList.contains('border-purple-500')).toBe(true);
    expect(selected.getAttribute('aria-current')).toBe('true');
    selected.click();
    expect(select).toHaveBeenCalledWith(1);
    filmstrip.render([canvases[0]]);
    expect(strip.classList.contains('hidden')).toBe(true);
    expect(strip.children).toHaveLength(0);
  });
});

describe('sidebar', () => {
  const manifest = parseIIIFManifest({
    type: 'Manifest', label: { en: ['Book'] }, summary: { en: ['A long description'] },
    items: [{ id: 'canvas', type: 'Canvas', items: [],
      annotations: [{ items: [{ body: { value: '<b>Note</b>' }, target: 'canvas#xywh=1,2,3,4' }] }] }],
  });

  it('uses the loaded URL for external links when the manifest has no ID', () => {
    const sidebar = new SidebarPanel(wrapper);
    sidebar.render(manifest, manifest.canvases[0]);
    expect(wrapper.querySelector('[data-el="external-viewers"]')).toBeNull();
    sidebar.render(manifest, manifest.canvases[0], { manifestUrl: 'https://example.test/manifest?a=1&b=2' });
    expect(wrapper.querySelector('[data-el="external-viewers"] a').getAttribute('href'))
      .toBe(`https://www.universalviewer.dev/#?iiifManifestId=${encodeURIComponent('https://example.test/manifest?a=1&b=2')}`);
  });

  it('toggles visibility and expands a long summary', () => {
    const sidebar = new SidebarPanel(wrapper, { isOpen: true, summaryCollapseLength: 5 });
    sidebar.render(manifest, manifest.canvases[0]);
    const summaryBody = wrapper.querySelector('[data-el="summary-body"]');
    const summaryButton = wrapper.querySelector('[data-action="toggle-summary"]');
    expect(summaryBody.classList.contains('line-clamp-4')).toBe(true);
    expect(summaryButton.getAttribute('aria-expanded')).toBe('false');
    expect(summaryButton.textContent).toBe('Show more');
    summaryButton.click();
    expect(summaryBody.classList.contains('line-clamp-4')).toBe(false);
    expect(summaryButton.getAttribute('aria-expanded')).toBe('true');
    expect(summaryButton.textContent).toBe('Show less');
    summaryButton.click();
    expect(summaryBody.classList.contains('line-clamp-4')).toBe(true);
    expect(summaryButton.getAttribute('aria-expanded')).toBe('false');
    sidebar.toggle();
    expect(wrapper.querySelector('[data-el="sidebar"]').classList.contains('hidden')).toBe(true);
    expect(wrapper.querySelector('[data-action="toggle-sidebar"]').getAttribute('aria-expanded')).toBe('false');
  });

  it('uses the plain-text summary length and disables collapsing at or below the threshold', () => {
    const summary = '<p>A <strong>long</strong> description</p>';
    const atThreshold = new SidebarPanel(wrapper, { summaryCollapseLength: 18 });
    const aboveThreshold = new SidebarPanel(wrapper, { summaryCollapseLength: 17 });
    const disabledAtZero = new SidebarPanel(wrapper, { summaryCollapseLength: 0 });
    const disabledBelowZero = new SidebarPanel(wrapper, { summaryCollapseLength: -1 });

    expect(atThreshold.renderSummaryBlock(summary)).not.toContain('data-action="toggle-summary"');
    expect(aboveThreshold.renderSummaryBlock(summary)).toContain('data-action="toggle-summary"');
    expect(disabledAtZero.renderSummaryBlock(summary)).not.toContain('data-action="toggle-summary"');
    expect(disabledBelowZero.renderSummaryBlock(summary)).not.toContain('data-action="toggle-summary"');
  });

  it('opens notes and dispatches annotation overlay actions', () => {
    const toggle = vi.fn();
    const focus = vi.fn();
    const sidebar = new SidebarPanel(wrapper, { onToggleAnnotations: toggle, onFocusAnnotation: focus });
    sidebar.setTab('annotations');
    sidebar.render(manifest, manifest.canvases[0]);
    wrapper.querySelector('[data-action="toggle-anno-overlays"]').click();
    expect(toggle).toHaveBeenCalledWith(false);
    wrapper.querySelector('[data-anno-focus]').click();
    expect(focus).toHaveBeenCalledWith(0);
  });

  it('mounts map features and dispatches selection', () => {
    const mount = vi.fn();
    const focus = vi.fn();
    const pan = vi.fn();
    const feature = { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: { _title: 'Place' } };
    const sidebar = new SidebarPanel(wrapper, { onMountMap: mount, onFocusMapFeature: focus, onPanMap: pan });
    sidebar.setTab('map');
    sidebar.render(manifest, manifest.canvases[0], { navFeatures: [feature] });
    expect(mount).toHaveBeenCalledWith(expect.any(Element), { type: 'FeatureCollection', features: [feature] });
    wrapper.querySelector('[data-nav-feature-index="0"]').click();
    expect(focus).toHaveBeenCalledWith(feature);
    wrapper.querySelector('[data-map-pan="up"]').click();
    expect(pan).toHaveBeenCalledWith(0, -1);
  });

  it('supports keyboard tabs and restores focus when closing the sidebar', () => {
    const sidebar = new SidebarPanel(wrapper);
    const metadata = wrapper.querySelector('[data-tab="metadata"]');
    const index = wrapper.querySelector('[data-tab="structures"]');
    metadata.focus();
    metadata.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(index);
    expect(index.getAttribute('aria-selected')).toBe('true');
    expect(metadata.tabIndex).toBe(-1);
    expect(wrapper.querySelector('[role="tabpanel"]').getAttribute('aria-labelledby')).toBe(index.id);
    sidebar.setOpen(false);
    expect(document.activeElement).toBe(wrapper.querySelector('button[data-action="toggle-sidebar"]'));
  });

  it('preserves search input focus while reporting asynchronous results', async () => {
    const sidebar = new SidebarPanel(wrapper, { onSearch: async () => [{ canvasLabel: 'Page', canvasIndex: 0, text: 'Result' }] });
    sidebar.setTab('search');
    sidebar.render(manifest, manifest.canvases[0]);
    const input = wrapper.querySelector('[data-el="manifest-search-input"]');
    input.value = 'Result';
    input.focus();
    wrapper.querySelector('[data-el="manifest-search-form"]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(wrapper.querySelector('[data-el="search-status"]').textContent).toBe('1 match found.'));
    expect(document.activeElement).toBe(input);
  });

  it('keeps the newest search loading and results when earlier requests finish out of order', async () => {
    const pending = [];
    const sidebar = new SidebarPanel(wrapper, {
      onSearch: () => new Promise((resolve) => pending.push(resolve)),
    });
    sidebar.setTab('search');
    sidebar.render(manifest, manifest.canvases[0]);
    const input = wrapper.querySelector('[data-el="manifest-search-input"]');
    const form = wrapper.querySelector('[data-el="manifest-search-form"]');
    const submit = (query) => {
      input.value = query;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    };
    submit('first');
    submit('second');
    pending[0]([{ canvasLabel: 'Page', canvasIndex: 0, text: 'Old result' }]);
    await Promise.resolve();
    expect(sidebar.searching).toBe(true);
    expect(wrapper.querySelector('[data-el="search-status"]').textContent).toBe('Searching manifest.');
    pending[1]([{ canvasLabel: 'Page', canvasIndex: 0, text: 'New result' }]);
    await vi.waitFor(() => expect(sidebar.searching).toBe(false));
    expect(wrapper.querySelector('[data-el="search-results"]').textContent).toContain('New result');

    submit('third');
    submit('fourth');
    pending[3]([{ canvasLabel: 'Page', canvasIndex: 0, text: 'Newest result' }]);
    await vi.waitFor(() => expect(sidebar.searching).toBe(false));
    pending[2]([{ canvasLabel: 'Page', canvasIndex: 0, text: 'Stale result' }]);
    await Promise.resolve();
    expect(wrapper.querySelector('[data-el="search-results"]').textContent).toContain('Newest result');
    expect(wrapper.querySelector('[data-el="search-results"]').textContent).not.toContain('Stale result');
  });

  it.each(['reset', 'empty submission'])('invalidates an outstanding search on %s', async (action) => {
    let resolveSearch;
    const sidebar = new SidebarPanel(wrapper, {
      onSearch: () => new Promise((resolve) => { resolveSearch = resolve; }),
    });
    sidebar.setTab('search');
    sidebar.render(manifest, manifest.canvases[0]);
    const input = wrapper.querySelector('[data-el="manifest-search-input"]');
    const form = wrapper.querySelector('[data-el="manifest-search-form"]');
    input.value = 'first';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    if (action === 'reset') {
      sidebar.resetSearch();
      sidebar.render(manifest, manifest.canvases[0]);
    } else {
      input.value = '';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
    resolveSearch([{ canvasLabel: 'Page', canvasIndex: 0, text: 'Old result' }]);
    await Promise.resolve();
    expect(sidebar.searching).toBe(false);
    expect(sidebar.searchResults).toEqual([]);
    expect(wrapper.querySelector('[data-el="search-results"]').textContent).not.toContain('Old result');
  });

  it('handles cancelled searches without interrupting the current search', async () => {
    const pending = [];
    const sidebar = new SidebarPanel(wrapper, {
      onSearch: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    });
    sidebar.setTab('search');
    sidebar.render(manifest, manifest.canvases[0]);
    const input = wrapper.querySelector('[data-el="manifest-search-input"]');
    const form = wrapper.querySelector('[data-el="manifest-search-form"]');
    input.value = 'first';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    input.value = 'second';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    pending[0].reject(new DOMException('Aborted', 'AbortError'));
    await Promise.resolve();
    expect(sidebar.searching).toBe(true);
    pending[1].resolve([{ canvasLabel: 'Page', canvasIndex: 0, text: 'New result' }]);
    await vi.waitFor(() => expect(sidebar.searching).toBe(false));
    expect(wrapper.querySelector('[data-el="search-results"]').textContent).toContain('New result');
  });

  it('reports cancellation of the current search', async () => {
    const sidebar = new SidebarPanel(wrapper, {
      onSearch: () => Promise.reject(new DOMException('Aborted', 'AbortError')),
    });
    sidebar.setTab('search');
    sidebar.render(manifest, manifest.canvases[0]);
    wrapper.querySelector('[data-el="manifest-search-input"]').value = 'query';
    wrapper.querySelector('[data-el="manifest-search-form"]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(wrapper.querySelector('[data-el="search-status"]').textContent).toBe('Search cancelled.'));
    expect(sidebar.searching).toBe(false);
  });

  it('reports an unexpected search error instead of showing an empty result', async () => {
    const error = new Error('Search failed unexpectedly');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const onSearch = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce([{ canvasLabel: 'Page', canvasIndex: 0, text: 'Recovered' }]);
      const sidebar = new SidebarPanel(wrapper, { onSearch });
      sidebar.setTab('search');
      sidebar.render(manifest, manifest.canvases[0]);
      wrapper.querySelector('[data-el="manifest-search-input"]').value = 'query';
      wrapper.querySelector('[data-el="manifest-search-form"]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await vi.waitFor(() => expect(wrapper.querySelector('[data-el="search-status"]').textContent).toContain('Search failed'));
      expect(log).toHaveBeenCalledWith('IIIF search failed:', error);
      wrapper.querySelector('[data-el="manifest-search-form"]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await vi.waitFor(() => expect(wrapper.querySelector('[data-el="search-results"]').textContent).toContain('Recovered'));
    } finally {
      log.mockRestore();
    }
  });

  it('uses unique relationships and independent language labels for multiple viewers', () => {
    const other = document.createElement('div');
    other.innerHTML = renderShell({ showUrlInput: true, currentUrl: '', height: '680px' });
    expect(other.querySelector('[role="tabpanel"]').id).not.toBe(wrapper.querySelector('[role="tabpanel"]').id);
    const multilingual = { ...manifest, availableLanguages: ['en', 'fr'] };
    const first = new SidebarPanel(wrapper);
    const second = new SidebarPanel(other);
    first.render(multilingual, manifest.canvases[0]);
    second.render(multilingual, manifest.canvases[0]);
    expect(wrapper.querySelector('[data-el="lang-select"]').closest('label').textContent).toContain('Language');
    expect(other.querySelector('[data-el="lang-select"]').closest('label').textContent).toContain('Language');
  });
});

describe('fullscreen controller', () => {
  it('uses the fallback and restores height when Escape is pressed', async () => {
    const resize = vi.fn();
    const fullscreen = new FullscreenController(wrapper, { height: '680px', onResize: resize });
    await fullscreen.enter();
    expect(fullscreen.isFullscreen).toBe(true);
    expect(wrapper.querySelector('[data-action="toggle-fullscreen"]').getAttribute('aria-pressed')).toBe('true');
    expect(wrapper.querySelector('[data-el="viewer-root"]').style.height).toBe('100vh');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fullscreen.isFullscreen).toBe(false);
    expect(wrapper.querySelector('[data-action="toggle-fullscreen"]').getAttribute('aria-pressed')).toBe('false');
    expect(wrapper.querySelector('[data-el="viewer-root"]').style.height).toBe('680px');
    expect(resize).toHaveBeenCalledTimes(2);
    fullscreen.destroy();
  });
});
