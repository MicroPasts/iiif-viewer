// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('openseadragon', () => ({
  default: {
    Rect: class { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } },
    Point: class { constructor(x, y) { Object.assign(this, { x, y }); } },
  },
}));

import { InspectionTools } from '../src/inspection-tools.js';

describe('inspection tools', () => {
  let wrapper;
  let osd;
  let items;
  let handlers;
  let pending;
  let tools;
  const image = (url) => ({ staticUrl: url });
  const canvas = (id, extra = {}) => ({
    id, kind: 'canvas', label: id, image: image(`${id}.jpg`), imageCoversCanvas: true,
    canvasWidth: 100, canvasHeight: 100, layers: [], ...extra,
  });
  const tiledImage = (width = 100, height = 100) => ({
    getContentSize: () => ({ x: width, y: height }),
    getBounds: () => ({ width: 1, getTopLeft: () => ({ x: 0, y: 0 }) }),
    imageToViewerElementCoordinates: (point) => ({ x: point.x * 2, y: point.y * 2 }),
    setPosition: vi.fn(), setWidth: vi.fn(), setOpacity: vi.fn(), setClip: vi.fn(),
  });

  beforeEach(() => {
    wrapper = document.createElement('div');
    wrapper.innerHTML = '<div data-el="inspection-buttons" hidden></div><div id="test-inspection" data-el="inspection-tools" hidden></div>';
    items = [tiledImage()];
    handlers = new Map();
    pending = [];
    osd = {
      world: {
        getItemAt: (i) => items[i],
        getIndexOfItem: (item) => items.indexOf(item),
        removeItem: vi.fn((item) => items.splice(items.indexOf(item), 1)),
        setItemIndex: vi.fn(),
      },
      addHandler: (name, handler) => handlers.set(name, handler),
      removeHandler: (name) => handlers.delete(name),
      addTiledImage: (options) => pending.push(options),
    };
    tools = new InspectionTools(wrapper, osd, { ruler: true, curtain: true, resolveUrl: (url) => `/proxy/${url}` });
  });

  it('converts manifest canvas units to source-image units and remembers a manual scale', () => {
    const first = canvas('first', { canvasWidth: 200, canvasHeight: 200, millimetersPerPixel: 0.1 });
    const second = canvas('second');
    const manifest = { canvases: [first, second] };
    tools.setCanvas(manifest, 0);
    handlers.get('open')();
    expect(tools.millimetersPerPixel).toBe(0.2);
    tools.applyScale(0.5);
    tools.setCanvas(manifest, 1);
    handlers.get('open')();
    expect(tools.millimetersPerPixel).toBeNull();
    tools.setCanvas(manifest, 0);
    handlers.get('open')();
    expect(tools.millimetersPerPixel).toBe(0.5);
    tools.resetManifest();
    tools.setCanvas(manifest, 0);
    handlers.get('open')();
    expect(tools.millimetersPerPixel).toBe(0.2);
    tools.destroy();
    expect(handlers.size).toBe(0);
  });

  it('rejects mismatched geometry and continues loading subsequent layers', () => {
    const first = canvas('first', { layers: [
      { ...image('bad.jpg'), label: 'Wrong size' },
      { ...image('good.jpg'), label: 'Good' },
    ] });
    tools.setCanvas({ canvases: [first] }, 0);
    handlers.get('open')();
    expect(pending[0].tileSource).toEqual({ type: 'image', url: '/proxy/bad.jpg' });
    const bad = tiledImage(80, 100);
    items.push(bad);
    pending[0].success({ item: bad });
    expect(osd.world.removeItem).toHaveBeenCalledWith(bad);
    const good = tiledImage();
    items.push(good);
    pending[1].success({ item: good });
    expect(wrapper.textContent).toContain('Cannot compare Wrong size');
    expect(wrapper.textContent).toContain('Good');
    const slider = wrapper.querySelector('[data-layer-clip="0"]');
    slider.value = '25';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(good.setClip).toHaveBeenCalledWith(expect.objectContaining({ width: 25, height: 100 }));
    tools.destroy();
  });

  it('removes a layer that finishes loading after changing canvas or destroying the tools', () => {
    const manifest = { canvases: [canvas('first', { layers: [{ ...image('extra.jpg'), label: 'Extra' }] }), canvas('second')] };
    tools.setCanvas(manifest, 0);
    handlers.get('open')();
    tools.setCanvas(manifest, 1);
    const stale = tiledImage();
    items.push(stale);
    pending[0].success({ item: stale });
    expect(osd.world.removeItem).toHaveBeenCalledWith(stale);
    expect(tools.layers).toHaveLength(0);

    tools.setCanvas(manifest, 0);
    handlers.get('open')();
    tools.destroy();
    const afterDestroy = tiledImage();
    items.push(afterDestroy);
    pending[1].success({ item: afterDestroy });
    expect(osd.world.removeItem).toHaveBeenCalledWith(afterDestroy);
  });

  it('does not use a manifest scale for a non-proportional image', () => {
    const first = canvas('first', { canvasWidth: 200, canvasHeight: 100, millimetersPerPixel: 0.1 });
    tools.setCanvas({ canvases: [first] }, 0);
    handlers.get('open')();
    expect(tools.millimetersPerPixel).toBeNull();
    expect(wrapper.textContent).toContain('No physical scale');
    tools.destroy();
  });

  it('reports load failures and still loads later comparison layers', () => {
    const first = canvas('first', { layers: [
      { ...image('missing.jpg'), label: 'Missing' },
      { ...image('good.jpg'), label: 'Good' },
    ] });
    tools.setCanvas({ canvases: [first] }, 0);
    handlers.get('open')();
    pending[0].error();
    const good = tiledImage();
    items.push(good);
    pending[1].success({ item: good });
    expect(wrapper.textContent).toContain('Could not load comparison image: Missing');
    expect(wrapper.textContent).toContain('Good');
    handlers.get('open-failed')();
    expect(wrapper.textContent).toContain('Could not load the current image.');
    tools.destroy();
  });

  it('rejects invalid scales and keeps the previous calibration', () => {
    const first = canvas('first');
    tools.setCanvas({ canvases: [first] }, 0);
    handlers.get('open')();
    tools.applyScale(0.5);
    tools.applyScale(0);
    expect(tools.millimetersPerPixel).toBe(0.5);
    expect(wrapper.textContent).toContain('Enter a positive finite scale.');
    tools.destroy();
  });

  it('updates comparison and layer labels when the language changes', () => {
    const first = canvas('first', { layers: [{
      ...image('extra.jpg'), label: 'Visible', rawLabel: { en: ['Visible'], fr: ['Visible en français'] },
    }] });
    const second = canvas('second', { label: 'Page two' });
    tools.setCanvas({ canvases: [first, second] }, 0);
    handlers.get('open')();
    const extra = tiledImage();
    items.push(extra);
    pending[0].success({ item: extra });
    second.label = 'Page deux';
    tools.setLanguage('fr');
    expect(wrapper.querySelector('[data-inspect="layers"]').textContent).toContain('Visible en français');
    expect(wrapper.querySelector('[data-inspect="compare"] option[value="1"]').textContent).toBe('Page deux');
    tools.destroy();
  });
});
