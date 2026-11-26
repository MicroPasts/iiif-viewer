// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ map: null, worker: vi.fn() }));
vi.mock('maplibre-gl', () => {
  class Map {
    constructor(options) {
      this.options = options;
      this.events = {};
      this.sources = {};
      this.layers = [];
      this.flyTo = vi.fn();
      this.panBy = vi.fn();
      this.fitBounds = vi.fn();
      this.resize = vi.fn();
      this.remove = vi.fn();
      mocks.map = this;
    }
    addControl() {}
    on(event, layer, handler) {
      this.events[typeof layer === 'string' ? `${event}:${layer}` : event] = handler || layer;
    }
    getSource(id) { return this.sources[id]; }
    addSource(id, source) { this.sources[id] = { ...source, setData: vi.fn() }; }
    addLayer(layer) { this.layers.push(layer); }
    isStyleLoaded() { return true; }
    getCanvas() { return document.createElement('canvas'); }
  }
  class Popup {
    constructor() { this.element = document.createElement('div'); }
    setLngLat(value) { this.location = value; return this; }
    setHTML(html) { this.element.innerHTML = html; return this; }
    addTo() { return this; }
    getElement() { return this.element; }
    remove() {}
  }
  class LngLatBounds {
    constructor() { this.points = []; }
    extend(point) { this.points.push(point); return this; }
  }
  return { Map, Popup, LngLatBounds, NavigationControl: class {}, setWorkerUrl: mocks.worker };
});

import { NavPlaceMap } from '../src/navplace-map.js';

const feature = {
  type: 'Feature', geometry: { type: 'Point', coordinates: [12.4, 41.9] },
  properties: { _title: 'Rome', _canvasIndex: 2 },
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe('navPlace map', () => {
  it('creates point layers, fits the location and navigates from the popup', () => {
    const selectCanvas = vi.fn();
    const selectFeature = vi.fn();
    const map = new NavPlaceMap(document.createElement('div'), {
      featureCollection: { type: 'FeatureCollection', features: [feature] },
      onSelectCanvas: selectCanvas, onSelectFeature: selectFeature,
    });
    expect(mocks.worker).toHaveBeenCalledWith(expect.any(String));
    expect(mocks.map.options.style).toBe('https://tiles.openfreemap.org/styles/liberty');
    mocks.map.events.load();
    expect(mocks.map.layers.map((layer) => layer.id)).toContain('navplace-points');
    map.panBy(1, -1);
    expect(mocks.map.panBy).toHaveBeenCalledWith([100, -100], { duration: 0 });
    expect(mocks.map.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [12.4, 41.9] }));
    mocks.map.events['click:navplace-points']({ features: [feature], lngLat: [12.4, 41.9] });
    expect(selectFeature).toHaveBeenCalledWith(feature, { canvasIndex: 2 });
    map.popup.getElement().querySelector('button').click();
    expect(selectCanvas).toHaveBeenCalledWith(2);
    map.destroy();
    expect(mocks.map.remove).toHaveBeenCalled();
  });

  it('uses custom styles and updates an existing GeoJSON source', () => {
    const map = new NavPlaceMap(document.createElement('div'), {
      mapStyle: '/custom.json', featureCollection: { type: 'FeatureCollection', features: [feature] },
    });
    mocks.map.events.load();
    const next = { type: 'FeatureCollection', features: [feature, feature] };
    map.setData(next);
    expect(mocks.map.options.style).toBe('/custom.json');
    expect(mocks.map.getSource('navplace').setData).toHaveBeenCalledWith(next);
    map.destroy();
  });
});
