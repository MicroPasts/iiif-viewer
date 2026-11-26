// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ osd: null }));
vi.mock('../src/osd-controller.js', () => ({
  OsdController: class {
    constructor() {
      this.open = vi.fn(); this.destroy = vi.fn(); this.resize = vi.fn();
      this.zoomBy = vi.fn(); this.goHome = vi.fn(); this.rotateBy = vi.fn(); this.panBy = vi.fn();
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
  it('renders a manifest, navigates canvases, changes language and cleans up', async () => {
    const onCanvasChange = vi.fn();
    viewer = new IIIFViewer(container, { manifest, showSidebar: true, onCanvasChange });
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
