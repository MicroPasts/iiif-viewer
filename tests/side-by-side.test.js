// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('openseadragon', () => ({ default: { Point: class {
  constructor(x, y) { this.x = x; this.y = y; }
} } }));
vi.mock('../src/osd-controller.js', () => ({
  OsdController: class {
    constructor() {
      this.osd = makeOsd();
      this.transform = {};
      this.filters = {};
      this.open = vi.fn();
      this.resetTransform = vi.fn();
      this.resize = vi.fn();
      this.clearAnnotations = vi.fn();
      this.destroy = vi.fn();
    }
  },
}));

import { SideBySide } from '../src/side-by-side.js';
import { parseIIIFManifest } from '../src/parser.js';
import { renderShell } from '../src/template.js';

function makeOsd() {
  const handlers = new Map();
  const item = {
    getContentSize: () => ({ x: 1000, y: 500 }),
    viewportToImageCoordinates: (point) => point,
    imageToViewportCoordinates: (point) => point,
  };
  const osd = {
    world: { getItemAt: () => item },
    viewport: {
      getCenter: () => ({ x: 250, y: 125 }),
      getZoom: () => 4,
      getHomeZoom: () => 2,
      zoomTo: vi.fn(),
      panTo: vi.fn(),
    },
    addHandler: (name, fn) => handlers.set(name, fn),
    removeHandler: vi.fn((name) => handlers.delete(name)),
    emit: (name) => handlers.get(name)?.(),
  };
  return osd;
}

const raw = {
  type: 'Manifest', id: 'https://example.test/manifest',
  label: { en: ['Book'] },
  items: [0, 1].map((index) => ({
    id: `https://example.test/${index}`, type: 'Canvas',
    items: [{ items: [{ motivation: 'painting', body: { id: `https://example.test/${index}.jpg`, type: 'Image' } }] }],
  })),
};

let wrapper;
let viewer;
let comparison;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  wrapper = document.createElement('div');
  wrapper.innerHTML = renderShell({ height: '680px', currentUrl: '', showUrlInput: true, sideBySide: true });
  document.body.append(wrapper);
  viewer = {
    wrapper,
    options: { showUrlInput: true, fetchOptions: { credentials: 'include' }, onCompareChange: vi.fn() },
    state: { manifest: parseIIIFManifest(raw), rawManifest: raw, canvasIndex: 0, language: 'en', theme: 'dark' },
    osdController: { osd: makeOsd() },
    sidebar: { resetSearch: vi.fn(), availableTabs: [] },
    resolveUrl: vi.fn((url, type) => `/proxy/${type}/${url}`),
    renderSidebar: vi.fn(), destroyNavMap: vi.fn(), handleViewportResize: vi.fn(),
    syncFilterUI: vi.fn(), syncTransformUI: vi.fn(), syncActiveControls: vi.fn(),
  };
  comparison = new SideBySide(viewer);
  viewer.comparison = comparison;
  comparison.usePrimary();
});
afterEach(() => {
  comparison?.destroy();
  wrapper.remove();
  vi.unstubAllGlobals();
});

describe('side-by-side comparison', () => {
  it('uses the next canvas and reports selection changes', () => {
    expect(comparison.index).toBe(1);
    expect(comparison.osd.open).toHaveBeenCalledWith(
      { type: 'image', url: '/proxy/image/https://example.test/1.jpg' }, [], null
    );
    expect(viewer.options.onCompareChange).toHaveBeenCalledWith(expect.objectContaining({
      open: true, secondaryCanvasIndex: 1,
    }));
    comparison.selectCanvas(0);
    expect(viewer.options.onCompareChange).toHaveBeenLastCalledWith(expect.objectContaining({ secondaryCanvasIndex: 0 }));
  });

  it('loads a manifest using proxy resolution and fetch options', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => raw });
    vi.stubGlobal('fetch', fetch);
    await comparison.loadManifest('https://example.test/other');
    expect(fetch).toHaveBeenCalledWith('/proxy/manifest/https://example.test/other', expect.objectContaining({
      credentials: 'include', signal: expect.any(AbortSignal),
    }));
    expect(comparison.sourceUrl).toBe('https://example.test/other');
    expect(comparison.index).toBe(0);
    expect(comparison.manifest.label).toBe('Book');
  });

  it('parses a Presentation 2 secondary manifest', async () => {
    const v2 = {
      '@id': 'https://example.test/v2', '@type': 'sc:Manifest', label: 'Old book',
      sequences: [{ canvases: [{ '@id': 'https://example.test/canvas', '@type': 'sc:Canvas',
        images: [{ resource: { '@id': 'https://example.test/image.jpg', '@type': 'dctypes:Image' } }] }] }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => v2 }));
    await comparison.loadManifest('https://example.test/v2');
    expect(comparison.manifest.version).toBe('2.1');
    expect(comparison.osd.open).toHaveBeenLastCalledWith(
      { type: 'image', url: '/proxy/image/https://example.test/image.jpg' }, [], null
    );
  });

  it('synchronizes normalized centers and relative zoom without reentrant feedback', () => {
    const target = comparison.osd.osd;
    target.world.getItemAt = () => ({
      getContentSize: () => ({ x: 400, y: 800 }),
      imageToViewportCoordinates: (point) => point,
    });
    target.viewport.getHomeZoom = () => 3;
    target.viewport.zoomTo.mockImplementation(() => comparison.synchronize('primary'));
    comparison.synchronize('primary');
    expect(target.viewport.zoomTo).toHaveBeenCalledTimes(1);
    expect(target.viewport.zoomTo).toHaveBeenCalledWith(6, null, true);
    expect(target.viewport.panTo).toHaveBeenCalledWith(expect.objectContaining({ x: 100, y: 200 }), true);
    comparison.syncEnabled = false;
    comparison.synchronize('primary');
    expect(target.viewport.zoomTo).toHaveBeenCalledTimes(1);
  });

  it('aborts in-flight manifest requests and removes handlers on destroy', async () => {
    let signal;
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      signal = options.signal;
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    }));
    const pending = comparison.loadManifest('https://example.test/pending');
    const secondary = comparison.osd;
    comparison.destroy();
    comparison = null;
    await pending;
    expect(signal.aborted).toBe(true);
    expect(secondary.destroy).toHaveBeenCalledOnce();
    expect(viewer.osdController.osd.removeHandler).toHaveBeenCalledTimes(2);
    expect(wrapper.querySelector('[data-el="secondary-pane"]').hidden).toBe(true);
  });

  it('reports fetch failures without replacing the current secondary manifest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }));
    await comparison.loadManifest('https://example.test/missing');
    expect(comparison.manifest).toBe(viewer.state.manifest);
    expect(wrapper.querySelector('[data-compare="error"]').textContent).toContain('HTTP 404');
  });

  it('uses the first canvas when the primary is last', () => {
    viewer.state.canvasIndex = 1;
    comparison.usePrimary();
    expect(comparison.index).toBe(0);
  });
});
