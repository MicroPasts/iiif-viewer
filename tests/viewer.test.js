// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ osd: null }));
vi.mock('openseadragon', () => ({ default: {} }));
vi.mock('../src/osd-controller.js', () => ({
  OsdController: class {
    constructor(element, options) {
      this.onAnnotationClick = options.onAnnotationClick;
      this.open = vi.fn(); this.destroy = vi.fn(); this.resize = vi.fn();
      this.clearAnnotations = vi.fn(); this.renderAnnotationOverlays = vi.fn();
      this.focusAnnotation = vi.fn();
      this.zoomBy = vi.fn(); this.goHome = vi.fn(); this.rotateBy = vi.fn(); this.panBy = vi.fn();
      this.transform = { rotation: 0, flipHorizontal: false, flipVertical: false };
      this.resetTransform = vi.fn(() => { this.transform = { rotation: 0, flipHorizontal: false, flipVertical: false }; });
      this.toggleFlip = vi.fn((axis) => {
        const key = axis === 'horizontal' ? 'flipHorizontal' : 'flipVertical';
        this.transform[key] = !this.transform[key];
      });
      this.applyTransform = vi.fn();
      this.getViewRegion = vi.fn(() => [10, 20, 30, 40]);
      this.filters = { brightness: 100, contrast: 100, invert: false, grayscale: false };
      this.setFilter = vi.fn(); this.resetFilters = vi.fn();
      mocks.osd = this;
    }
  },
}));

import { IIIFViewer } from '../src/index.js';

const manifest = {
  type: 'Manifest', id: 'https://example.test/manifest',
  label: { en: ['Book'], fr: ['Livre'] },
  items: [0, 1].map((index) => ({
    type: 'Canvas', id: `https://example.test/canvas/${index}`,
    label: { en: [`Page ${index + 1}`], fr: [`Feuille ${index + 1}`] },
    items: [{ items: [{ motivation: 'painting', body: { id: `https://example.test/image/${index}.jpg`, type: 'Image' } }] }],
  })),
};

let container;
let viewer;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  vi.stubGlobal('requestAnimationFrame', (callback) => { callback(); return 1; });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  viewer?.destroy();
  viewer = null;
  container.remove();
  vi.unstubAllGlobals();
});

describe('IIIF viewer', () => {
  it('keeps comparison opt-in and rejects opening it when disabled', () => {
    viewer = new IIIFViewer(container, { manifest });
    expect(container.querySelector('[data-action="toggle-compare"]')).toBeNull();
    expect(() => viewer.enterSideBySide()).toThrow('Enable sideBySide');
  });

  it('requires a loaded manifest before opening comparison', () => {
    viewer = new IIIFViewer(container, { sideBySide: true });
    expect(container.querySelector('[data-action="toggle-compare"]')).not.toBeNull();
    expect(() => viewer.enterSideBySide()).toThrow('Load a manifest');
  });

  it.each(['metadata', 'structures', 'annotations', 'search', 'map'])('allows %s as the only tab', (tab) => {
    viewer = new IIIFViewer(container, { manifest, sidebarTabs: [tab] });
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(1);
    expect(tabs[0].dataset.tab).toBe(tab);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].tabIndex).toBe(0);
    expect(container.querySelector('[role="tabpanel"]').getAttribute('aria-labelledby')).toBe(tabs[0].id);
  });

  it('selects only configured tabs and does not open disabled Notes on annotation click', async () => {
    viewer = new IIIFViewer(container, { manifest, showSidebar: false, sidebarTabs: ['map', 'search'] });
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.dataset.tab)).toEqual(['search', 'map']);
    expect(viewer.sidebar.activeTab).toBe('search');
    expect(container.querySelector('[role="tabpanel"]').getAttribute('aria-labelledby')).toBe(tabs[0].id);
    expect(container.querySelector('[data-el="manifest-search-form"]')).not.toBeNull();
    expect(viewer.sidebar.setTab('annotations')).toBe(false);
    mocks.osd.onAnnotationClick();
    expect(viewer.sidebar.isOpen).toBe(false);
    expect(viewer.sidebar.activeTab).toBe('search');
    await viewer.setManifest(manifest);
    expect(viewer.sidebar.activeTab).toBe('search');
  });

  it.each([[], ['metadata', 'metadata'], ['invalid'], 'metadata', null])('rejects invalid sidebarTabs %j', (sidebarTabs) => {
    expect(() => new IIIFViewer(container, { sidebarTabs })).toThrow(/sidebarTabs/);
  });

  it('opens Notes when an annotation is clicked and Notes is enabled', () => {
    viewer = new IIIFViewer(container, { manifest, showSidebar: false, sidebarTabs: ['annotations'] });
    mocks.osd.onAnnotationClick();
    expect(viewer.sidebar.isOpen).toBe(true);
    expect(viewer.sidebar.activeTab).toBe('annotations');
  });

  it('only shares the URL of the successfully loaded manifest', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => manifest })
      .mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });
    vi.stubGlobal('fetch', fetch);
    viewer = new IIIFViewer(container, { permalink: { prefix: 'book' } });
    await viewer.loadManifest('https://example.test/manifest');
    let url = new URL(viewer.getPermalink());
    expect(url.searchParams.get('book-manifest')).toBe('https://example.test/manifest');
    expect(url.searchParams.get('book-xywh')).toBe('10,20,30,40');
    await viewer.loadManifest('https://example.test/missing');
    url = new URL(viewer.getPermalink());
    expect(url.searchParams.get('book-manifest')).toBe('https://example.test/manifest');
    await viewer.setManifest(manifest);
    expect(() => viewer.getPermalink()).toThrow('not loaded from a shareable URL');
  });

  it.each([false, true])('handles transform navigation with persistence %s', async (persistCanvasTransform) => {
    viewer = new IIIFViewer(container, { manifest, persistCanvasTransform });
    const controller = mocks.osd;
    controller.resetTransform.mockClear();
    container.querySelector('[data-action="flip-horizontal"]').click();
    expect(container.querySelector('[data-action="flip-horizontal"]').getAttribute('aria-pressed')).toBe('true');
    await viewer.goToCanvas(0);
    expect(controller.resetTransform).not.toHaveBeenCalled();
    await viewer.goToCanvas(1);
    expect(controller.resetTransform).toHaveBeenCalledTimes(persistCanvasTransform ? 0 : 1);
    expect(container.querySelector('[data-action="flip-horizontal"]').getAttribute('aria-pressed')).toBe(String(persistCanvasTransform));
    await viewer.setManifest(manifest);
    expect(controller.resetTransform).toHaveBeenCalledTimes(persistCanvasTransform ? 1 : 2);
    expect(container.querySelector('[data-action="flip-horizontal"]').getAttribute('aria-pressed')).toBe('false');
  });

  it('only shows the canvas pager for multiple navigable items', async () => {
    viewer = new IIIFViewer(container);
    const pager = container.querySelector('[data-el="pager-controls"]');
    expect(pager.classList.contains('hidden')).toBe(true);
    expect(pager.classList.contains('inline-flex')).toBe(false);
    await viewer.setManifest(manifest);
    expect(pager.classList.contains('hidden')).toBe(false);
    expect(pager.classList.contains('inline-flex')).toBe(true);
    container.querySelector('[data-action="next-canvas"]').click();
    expect(container.querySelector('[data-el="canvas-counter"]').textContent).toBe('2 / 2');
    container.querySelector('[data-action="prev-canvas"]').focus();
    await viewer.setManifest({ ...manifest, items: manifest.items.slice(0, 1) });
    expect(pager.classList.contains('hidden')).toBe(true);
    expect(pager.classList.contains('inline-flex')).toBe(false);
    expect(document.activeElement).toBe(container.querySelector('[data-el="viewer-root"]'));
    await viewer.setManifest(manifest);
    expect(pager.classList.contains('hidden')).toBe(false);
    expect(pager.classList.contains('inline-flex')).toBe(true);
  });

  it('renders a manifest, navigates canvases, changes language and cleans up', async () => {
    const onCanvasChange = vi.fn();
    viewer = new IIIFViewer(container, { manifest, showSidebar: true, onCanvasChange });
    expect(container.querySelector('[data-action="copy-permalink"]')).toBeNull();
    expect(container.querySelector('[data-inspect="ruler"]')).toBeNull();
    expect(container.querySelector('[data-inspect="curtain"]')).toBeNull();
    expect(container.querySelector('[data-action="toggle-json-inspector"]')).toBeNull();
    expect(container.querySelector('[data-el="manifest-title"]').textContent).toBe('Book');
    expect(mocks.osd.open).toHaveBeenCalledWith(
      { type: 'image', url: 'https://example.test/image/0.jpg' }, []
    );
    container.querySelector('[data-canvas-index="1"]').click();
    expect(viewer.state.canvasIndex).toBe(1);
    expect(onCanvasChange).toHaveBeenLastCalledWith(expect.objectContaining({ label: 'Page 2' }), 1);
    viewer.setLanguage('fr');
    expect(container.querySelector('[data-el="manifest-title"]').textContent).toBe('Livre');
    expect(container.querySelector('[data-el="sidebar-content"]').textContent).toContain('Feuille 2');
    container.querySelector('[data-action="toggle-theme"]').click();
    expect(viewer.state.theme).toBe('light');
    expect(container.querySelector('[data-action="toggle-theme"]').getAttribute('aria-pressed')).toBe('false');
    const osd = mocks.osd;
    viewer.destroy();
    viewer = null;
    expect(osd.destroy).toHaveBeenCalled();
    expect(container.children).toHaveLength(0);
  });

  it('synchronizes the optional inspector with navigation and new manifests', async () => {
    viewer = new IIIFViewer(container, { manifest, inspector: true });
    container.querySelector('[data-action="toggle-json-inspector"]').click();
    const scope = container.querySelector('[data-json-scope]');
    scope.value = 'canvas';
    scope.dispatchEvent(new Event('change', { bubbles: true }));
    container.querySelector('[data-json-view="raw"]').click();
    expect(container.querySelector('[data-json-content]').textContent).toContain('canvas/0');
    viewer.goToCanvas(1);
    expect(container.querySelector('[data-json-content]').textContent).toContain('canvas/1');
    expect(container.querySelector('[data-json-context]').textContent).toContain('Page 2');
    await viewer.setManifest({ ...manifest, items: manifest.items.slice(0, 1) });
    expect(container.querySelector('[data-json-content]').textContent).toContain('canvas/0');
    container.querySelector('[data-json-action="close"]').click();
    expect(container.querySelector('[data-el="json-inspector"]').hidden).toBe(true);
    expect(document.activeElement).toBe(container.querySelector('[data-action="toggle-json-inspector"]'));
  });

  it('initially renders index range labels in the selected language', () => {
    viewer = new IIIFViewer(container, {
      manifest: {
        ...manifest,
        structures: [{ id: 'chapter', type: 'Range', label: { en: ['Chapter'], fr: ['Chapitre'] }, items: ['https://example.test/canvas/0'] }],
      },
      language: 'fr',
      showSidebar: true,
    });
    container.querySelector('[data-tab="structures"]').click();
    expect(container.querySelector('[data-el="sidebar-content"]').textContent).toContain('Chapitre');
  });

  it.each([
    { externalViewers: undefined, labels: ['Universal Viewer', 'Tify'] },
    { externalViewers: { mode: 'append', viewers: [{ label: 'Custom <viewer>', url: 'https://tools.example/view?iiif={manifest}&other=1' }] }, labels: ['Universal Viewer', 'Tify', 'Custom <viewer>'] },
    { externalViewers: { mode: 'replace', viewers: [{ label: 'Custom <viewer>', url: 'https://tools.example/view?iiif={manifest}&other=1' }] }, labels: ['Custom <viewer>'] },
    { externalViewers: false, labels: [] },
    { externalViewers: { mode: 'replace', viewers: [] }, labels: [] },
  ])('configures external viewer links: $externalViewers', ({ externalViewers, labels }) => {
    const manifestId = 'https://example.test/manifest?a=1&b=two';
    viewer = new IIIFViewer(container, { manifest: { ...manifest, id: manifestId }, externalViewers });
    const content = container.querySelector('[data-el="sidebar-content"]');
    const links = [...content.querySelectorAll('[data-el="external-viewers"] a')];
    expect(links.map((link) => link.textContent.trim().slice(0, -2))).toEqual(labels);
    expect(content.textContent.includes('Open in Other IIIF Tools')).toBe(labels.length > 0);
    if (externalViewers?.mode === 'replace') expect(content.textContent).not.toContain('Universal Viewer');
    const custom = links.find((link) => link.textContent.includes('Custom'));
    if (custom) {
      expect(custom.getAttribute('href')).toBe(`https://tools.example/view?iiif=${encodeURIComponent(manifestId)}&other=1`);
      expect(custom.querySelector('viewer')).toBeNull();
      expect(custom.getAttribute('rel')).toBe('noopener noreferrer');
    }
    if (externalViewers === undefined) {
      expect(links[0].getAttribute('href')).toBe(`https://www.universalviewer.dev/#?iiifManifestId=${encodeURIComponent(manifestId)}`);
      expect(links[1].getAttribute('href')).toBe(`https://tify.rocks/?manifest=${encodeURIComponent(manifestId)}`);
    }
  });

  it.each([
    { mode: 'unknown', viewers: [] },
    { mode: 'append', viewers: 'invalid' },
    { viewers: [{ label: 'Unsafe', url: 'javascript:alert({manifest})' }] },
    { viewers: [{ label: 'Missing placeholder', url: 'https://example.test/' }] },
  ])('rejects invalid external viewer configuration', (externalViewers) => {
    expect(() => new IIIFViewer(container, { externalViewers })).toThrow(/external ?viewer/i);
    expect(container.children).toHaveLength(0);
  });

  it('fetches through the resolver and displays HTTP errors', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => manifest })
      .mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });
    vi.stubGlobal('fetch', fetch);
    viewer = new IIIFViewer(container, { proxyUrl: '/proxy?url=' });
    await viewer.loadManifest('https://example.test/manifest');
    expect(fetch.mock.calls[0][0]).toBe('/proxy?url=https%3A%2F%2Fexample.test%2Fmanifest');
    expect(viewer.state.manifest.label).toBe('Book');
    await viewer.loadManifest('https://example.test/missing');
    expect(container.querySelector('[data-el="error-box"]').textContent).toContain('HTTP 404');
    expect(container.querySelector('[role="alert"]').textContent).toContain('HTTP 404');
  });

  it.each(['current canvas', 'different canvas', 'different manifest'])(
    'applies external annotations only to the current canvas: %s',
    async (destination) => {
      let resolveFetch;
      vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; })));
      viewer = new IIIFViewer(container, { manifest });
      const item = viewer.state.manifest.canvases[0];
      item.externalAnnotationUrls = ['https://example.test/annotations'];
      const request = viewer.loadExternalAnnotations(item, true);

      if (destination === 'different canvas') await viewer.goToCanvas(1);
      if (destination === 'different manifest') await viewer.setManifest(manifest);

      resolveFetch({
        ok: true,
        json: async () => ({
          items: [{ body: { value: 'External note' }, target: 'https://example.test/canvas/0#xywh=1,2,3,4' }],
        }),
      });
      await request;
      expect(item.annotations).toEqual([expect.objectContaining({ text: 'External note', xywh: [1, 2, 3, 4] })]);
      if (destination === 'current canvas') {
        expect(mocks.osd.renderAnnotationOverlays).toHaveBeenCalledWith(item.annotations);
      } else {
        expect(mocks.osd.renderAnnotationOverlays).not.toHaveBeenCalled();
      }
    }
  );

  it('binds search-hit focus to its canvas before waiting for external annotations', async () => {
    let resolveFetch;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; })));
    viewer = new IIIFViewer(container, { manifest });
    viewer.state.manifest.canvases[1].externalAnnotationUrls = ['https://example.test/annotations'];

    const navigation = viewer.sidebar.onSelectSearchHit({ canvasIndex: 1, xywh: [1, 2, 3, 4] });
    expect(mocks.osd.open).toHaveBeenLastCalledWith(
      { type: 'image', url: 'https://example.test/image/1.jpg' }, [], { xywh: [1, 2, 3, 4] }
    );
    await viewer.goToCanvas(0);
    resolveFetch({ ok: true, json: async () => ({ items: [] }) });
    await navigation;
    expect(mocks.osd.focusAnnotation).not.toHaveBeenCalled();
  });

  it.each([
    { allowManifestDrop: undefined, enabled: true },
    { allowManifestDrop: false, enabled: false },
  ])('controls manifest drops (enabled: $enabled)', ({ allowManifestDrop, enabled }) => {
    viewer = new IIIFViewer(container, { showUrlInput: false, allowManifestDrop });
    const loadManifest = vi.spyOn(viewer, 'loadManifest').mockResolvedValue();
    const root = container.querySelector('[data-el="viewer-root"]');
    const dragover = new Event('dragover', { bubbles: true, cancelable: true });
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', {
      value: { getData: (type) => type === 'text/plain' ? 'https://example.test/manifest' : '' },
    });

    root.dispatchEvent(dragover);
    root.dispatchEvent(drop);

    expect(dragover.defaultPrevented).toBe(true);
    expect(drop.defaultPrevented).toBe(true);
    if (enabled) {
      expect(loadManifest).toHaveBeenCalledWith('https://example.test/manifest');
      expect(container.textContent).toContain('Drag a IIIF link here');
    } else {
      expect(loadManifest).not.toHaveBeenCalled();
      expect(container.textContent).not.toContain('Drag a IIIF link here');
      expect(container.textContent).toContain('Call loadManifest()');
    }
  });

  it('limits shortcuts to viewer focus and exposes image pan buttons', () => {
    viewer = new IIIFViewer(container, { manifest, showSidebar: true });
    const root = container.querySelector('[data-el="viewer-root"]');
    const button = container.querySelector('[data-action="zoom-in"]');
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(viewer.state.canvasIndex).toBe(0);
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(viewer.state.canvasIndex).toBe(1);
    container.querySelector('[data-action="pan-left"]').click();
    expect(mocks.osd.panBy).toHaveBeenCalledWith(-1, 0);
  });

  it('hides image controls for 3D scenes and restores them for images', async () => {
    const sceneManifest = {
      ...manifest,
      items: [
        manifest.items[0],
        {
          type: 'Scene', id: 'https://example.test/scene',
          items: [{ items: [{ motivation: 'painting', body: { id: 'https://example.test/model.glb', type: 'Model' } }] }],
        },
      ],
    };
    viewer = new IIIFViewer(container, { manifest: sceneManifest, onSelectScene: () => ({}) });
    const controls = container.querySelector('[data-el="zoom-controls"]');
    const toggle = container.querySelector('[data-action="toggle-filters"]');
    const bar = container.querySelector('[data-el="filter-bar"]');
    toggle.click();
    bar.querySelector('[data-filter="brightness"]').focus();
    await viewer.goToCanvas(1);
    expect(mocks.osd.clearAnnotations).toHaveBeenCalled();
    expect(controls.classList.contains('hidden')).toBe(true);
    expect(controls.classList.contains('inline-flex')).toBe(false);
    expect(bar.classList.contains('hidden')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(container.querySelector('[data-el="viewer-root"]'));
    await viewer.goToCanvas(0);
    expect(controls.classList.contains('hidden')).toBe(false);
    expect(controls.classList.contains('inline-flex')).toBe(true);
    expect(bar.classList.contains('hidden')).toBe(true);
  });
});
