// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ instance: null }));
vi.mock('openseadragon', () => {
  function OpenSeadragon() {
    mocks.instance = {
      canvas: document.createElement('canvas'),
      open: vi.fn(), addOnceHandler: vi.fn(), addOverlay: vi.fn(), removeOverlay: vi.fn(), destroy: vi.fn(),
      world: { getItemAt: () => ({ imageToViewportRectangle: (x, y, width, height) => ({ x, y, width, height }) }) },
      viewport: { fitBounds: vi.fn(), zoomBy: vi.fn(), goHome: vi.fn(), getRotation: () => 270, setRotation: vi.fn(),
        getBounds: () => ({ width: 10, height: 5 }), panBy: vi.fn(), applyConstraints: vi.fn() },
    };
    return mocks.instance;
  }
  OpenSeadragon.Rect = class {
    constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); }
  };
  OpenSeadragon.Point = class {
    constructor(x, y) { Object.assign(this, { x, y }); }
  };
  return { default: OpenSeadragon };
});

import { OsdController } from '../src/osd-controller.js';

describe('OpenSeadragon controller', () => {
  let controller;
  beforeEach(() => { controller = new OsdController(document.createElement('div')); });

  it('creates selectable overlays and removes them on destroy', () => {
    const annotation = { text: '<b>Detail</b>', xywh: [10, 20, 30, 40] };
    controller.open('image/info.json', [annotation]);
    expect(mocks.instance.open).toHaveBeenCalledWith('image/info.json');
    mocks.instance.addOnceHandler.mock.calls[0][1]();
    const overlay = controller.overlays[0].element;
    expect(overlay.title).toBe('Detail');
    controller.focusAnnotation(annotation);
    expect(overlay.classList.contains('is-active')).toBe(true);
    expect(mocks.instance.viewport.fitBounds).toHaveBeenCalled();
    controller.setAnnotationsVisible(false);
    expect(overlay.classList.contains('hidden')).toBe(true);
    expect(overlay.style.visibility).toBe('hidden');
    controller.setAnnotationsVisible(true);
    expect(overlay.style.visibility).toBe('');
    controller.destroy();
    expect(mocks.instance.removeOverlay).toHaveBeenCalledWith(overlay);
    expect(mocks.instance.destroy).toHaveBeenCalled();
  });

  it('updates and resets image filters and rotates the viewport', () => {
    controller.setFilter({ brightness: 70, invert: true });
    expect(mocks.instance.canvas.style.filter).toContain('brightness(70%)');
    expect(mocks.instance.canvas.style.filter).toContain('invert(1)');
    controller.rotateBy(90);
    expect(mocks.instance.viewport.setRotation).toHaveBeenCalledWith(0);
    controller.panBy(1, -1);
    expect(mocks.instance.viewport.panBy).toHaveBeenCalledWith(expect.objectContaining({ x: 2, y: -1 }));
    controller.resetFilters();
    expect(mocks.instance.canvas.style.filter).not.toContain('invert');
  });
});
