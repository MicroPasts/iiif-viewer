// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ instance: null }));
vi.mock('openseadragon', () => {
  function OpenSeadragon() {
    const handlers = new Map();
    mocks.instance = {
      canvas: document.createElement('canvas'),
      open: vi.fn(),
      addHandler: vi.fn((event, handler) => {
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event).add(handler);
      }),
      addOnceHandler: vi.fn((event, handler) => {
        const once = () => {
          handlers.get(event)?.delete(once);
          handler();
        };
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event).add(once);
      }),
      removeHandler: vi.fn((event, handler) => handlers.get(event)?.delete(handler)),
      raiseEvent: (event) => [...(handlers.get(event) || [])].forEach((handler) => handler()),
      addOverlay: vi.fn(), removeOverlay: vi.fn(), destroy: vi.fn(),
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
    mocks.instance.raiseEvent('open');
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

  it('does not render a pending canvas annotation after opening an unannotated canvas', () => {
    controller.open('a/info.json', [{ text: 'Canvas A', xywh: [1, 2, 3, 4] }]);
    controller.open('b/info.json');
    mocks.instance.raiseEvent('open');
    expect(mocks.instance.addOverlay).not.toHaveBeenCalled();
    expect(controller.overlays).toHaveLength(0);
  });

  it('retains the latest annotations until an image opens, including when none were embedded', () => {
    const embedded = { text: 'Embedded', xywh: [1, 2, 3, 4] };
    const external = { text: 'External', xywh: [5, 6, 7, 8] };
    controller.open('a/info.json', [embedded]);
    controller.renderAnnotationOverlays([embedded, external]);
    expect(mocks.instance.addOverlay).not.toHaveBeenCalled();
    mocks.instance.raiseEvent('open');
    expect(controller.overlays.map(({ element }) => element.title)).toEqual(['Embedded', 'External']);

    controller.open('b/info.json');
    controller.renderAnnotationOverlays([external]);
    mocks.instance.raiseEvent('open');
    expect(controller.overlays.map(({ element }) => element.title)).toEqual(['External']);
  });

  it('discards deferred annotations when another canvas opens', () => {
    controller.open('a/info.json');
    controller.renderAnnotationOverlays([{ text: 'Canvas A', xywh: [1, 2, 3, 4] }]);
    controller.open('b/info.json');
    mocks.instance.raiseEvent('open');
    expect(mocks.instance.addOverlay).not.toHaveBeenCalled();
  });

  it('discards deferred annotations when leaving the image viewer', () => {
    controller.open('a/info.json');
    controller.renderAnnotationOverlays([{ text: 'Canvas A', xywh: [1, 2, 3, 4] }]);
    controller.clearAnnotations();
    mocks.instance.raiseEvent('open');
    expect(mocks.instance.addOverlay).not.toHaveBeenCalled();
  });

  it('updates annotations after the image has opened', () => {
    controller.open('a/info.json');
    mocks.instance.raiseEvent('open');
    controller.renderAnnotationOverlays([{ text: 'External', xywh: [1, 2, 3, 4] }]);
    expect(controller.overlays.map(({ element }) => element.title)).toEqual(['External']);
  });

  it('focuses the latest requested region only after the image opens', () => {
    controller.open('a/info.json', [], { xywh: [1, 2, 3, 4] });
    controller.focusAnnotation({ xywh: [10, 20, 30, 40] });
    expect(mocks.instance.viewport.fitBounds).not.toHaveBeenCalled();
    mocks.instance.raiseEvent('open');
    expect(mocks.instance.viewport.fitBounds).toHaveBeenCalledTimes(1);
    expect(mocks.instance.viewport.fitBounds).toHaveBeenCalledWith(
      expect.objectContaining({ x: 2.5, y: 10, width: 45, height: 60 }), false
    );
  });

  it('discards pending focus when the canvas changes or the viewer is destroyed', () => {
    controller.open('a/info.json', [], { xywh: [1, 2, 3, 4] });
    controller.open('b/info.json');
    mocks.instance.raiseEvent('open');
    expect(mocks.instance.viewport.fitBounds).not.toHaveBeenCalled();

    controller.open('c/info.json', [], { xywh: [1, 2, 3, 4] });
    controller.clearAnnotations();
    mocks.instance.raiseEvent('open');
    expect(mocks.instance.viewport.fitBounds).not.toHaveBeenCalled();

    controller.open('c/info.json', [], { xywh: [1, 2, 3, 4] });
    controller.destroy();
    mocks.instance.raiseEvent('open');
    expect(mocks.instance.viewport.fitBounds).not.toHaveBeenCalled();
  });

  it('does not apply pending focus if overlay rendering starts another image', () => {
    mocks.instance.addOverlay.mockImplementationOnce(() => controller.open('b/info.json'));
    controller.open('a/info.json', [{ text: 'Canvas A', xywh: [1, 2, 3, 4] }], { xywh: [1, 2, 3, 4] });
    mocks.instance.raiseEvent('open');
    mocks.instance.raiseEvent('open');
    expect(mocks.instance.viewport.fitBounds).not.toHaveBeenCalled();
  });

  it('renders only the latest canvas annotations and removes its handler after opening', () => {
    controller.open('a/info.json', [{ text: 'Canvas A', xywh: [1, 2, 3, 4] }]);
    controller.open('b/info.json', [{ text: 'Canvas B', xywh: [5, 6, 7, 8] }]);
    mocks.instance.raiseEvent('open');
    expect(controller.overlays.map(({ element }) => element.title)).toEqual(['Canvas B']);
    mocks.instance.raiseEvent('open');
    expect(mocks.instance.addOverlay).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale handler already queued when another open starts', () => {
    const switchCanvas = () => {
      mocks.instance.removeHandler('open', switchCanvas);
      controller.open('b/info.json', [{ text: 'Canvas B', xywh: [5, 6, 7, 8] }]);
    };
    mocks.instance.addHandler('open', switchCanvas);
    controller.open('a/info.json', [{ text: 'Canvas A', xywh: [1, 2, 3, 4] }]);
    mocks.instance.raiseEvent('open');
    expect(mocks.instance.addOverlay).not.toHaveBeenCalled();
    mocks.instance.raiseEvent('open');
    expect(controller.overlays.map(({ element }) => element.title)).toEqual(['Canvas B']);
  });

  it('handles synchronous opens and removes pending handlers on destroy', () => {
    mocks.instance.open.mockImplementationOnce(() => mocks.instance.raiseEvent('open'));
    controller.open('a/info.json', [{ text: 'Canvas A', xywh: [1, 2, 3, 4] }]);
    expect(controller.overlays.map(({ element }) => element.title)).toEqual(['Canvas A']);
    controller.open('b/info.json', [{ text: 'Canvas B', xywh: [5, 6, 7, 8] }]);
    controller.destroy();
    mocks.instance.raiseEvent('open');
    expect(mocks.instance.addOverlay).toHaveBeenCalledTimes(1);
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
