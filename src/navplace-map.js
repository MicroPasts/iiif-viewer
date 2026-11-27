import { Map, NavigationControl, Popup, LngLatBounds, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from '#map-worker-url';
import { escapeHtml } from './sanitize.js';

const DEFAULT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// Vite emits a separate worker for the demo and inlines it in library builds.
setWorkerUrl(workerUrl);

function collectCoords(geometry, out) {
  if (!geometry) return;
  const { type, coordinates, geometries } = geometry;
  if (type === 'GeometryCollection' && Array.isArray(geometries)) {
    geometries.forEach((g) => collectCoords(g, out));
    return;
  }
  if (!Array.isArray(coordinates)) return;

  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    out.push([coordinates[0], coordinates[1]]);
    return;
  }
  coordinates.forEach((c) => collectCoords({ type: 'Point', coordinates: c }, out));
}

export class NavPlaceMap {
  constructor(container, {
    featureCollection,
    mapStyle = DEFAULT_STYLE,
    onSelectCanvas = null,
    onSelectFeature = null,
  } = {}) {
    this.container = container;
    this.featureCollection = featureCollection;
    this.mapStyle = mapStyle || DEFAULT_STYLE;
    this.onSelectCanvas = onSelectCanvas;
    this.onSelectFeature = onSelectFeature;

    this.map = null;
    this.popup = null;
    this.resizeObserver = null;
    this.destroyed = false;

    this.mount();
  }

  mount() {
    this.container.innerHTML = `<div data-el="maplibre-host" class="w-full h-full"></div>`;
    const host = this.container.querySelector('[data-el="maplibre-host"]');

    this.map = new Map({
      container: host,
      style: this.mapStyle,
      center: [0, 20],
      zoom: 1.5,
      attributionControl: true,
    });

    this.map.addControl(new NavigationControl({ showCompass: true }), 'top-right');

    this.map.on('load', () => {
      if (this.destroyed) return;
      this.addGeoJsonLayers();
      this.fitToFeatures();
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
  }

  addGeoJsonLayers() {
    if (!this.map || !this.featureCollection?.features?.length) return;

    if (this.map.getSource('navplace')) {
      this.map.getSource('navplace').setData(this.featureCollection);
      return;
    }

    this.map.addSource('navplace', {
      type: 'geojson',
      data: this.featureCollection,
    });

    this.map.addLayer({
      id: 'navplace-polygons',
      type: 'fill',
      source: 'navplace',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': '#9333ea',
        'fill-opacity': 0.22,
      },
    });

    this.map.addLayer({
      id: 'navplace-lines',
      type: 'line',
      source: 'navplace',
      filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString', 'Polygon']]],
      paint: {
        'line-color': '#a855f7',
        'line-width': 2.5,
      },
    });

    this.map.addLayer({
      id: 'navplace-points',
      type: 'circle',
      source: 'navplace',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 7,
        'circle-color': '#9333ea',
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
      },
    });

    ['navplace-points', 'navplace-lines', 'navplace-polygons'].forEach((layerId) => {
      this.map.on('click', layerId, (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const props = feat.properties || {};
        const title = props._title || 'Location';
        const cIdx =
          props._canvasIndex !== null &&
          props._canvasIndex !== undefined &&
          props._canvasIndex !== ''
            ? Number(props._canvasIndex)
            : null;

        this.popup?.remove();
        this.popup = new Popup({ closeButton: true, maxWidth: '240px' })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="text-xs text-slate-900 space-y-1">
              <div class="font-semibold">${escapeHtml(title)}</div>
              ${
                cIdx !== null && !Number.isNaN(cIdx)
                  ? `<button type="button" data-map-goto-canvas="${cIdx}" class="text-[11px] font-medium text-purple-700 underline">Jump to Canvas ${cIdx + 1} &rarr;</button>`
                  : ''
              }
            </div>`
          )
          .addTo(this.map);

        const popupEl = this.popup.getElement();
        popupEl?.addEventListener('click', (ev) => {
          const btn = ev.target.closest('[data-map-goto-canvas]');
          if (btn && typeof this.onSelectCanvas === 'function') {
            this.onSelectCanvas(Number(btn.dataset.mapGotoCanvas));
          }
        });

        this.onSelectFeature?.(feat, { canvasIndex: cIdx });
      });

      this.map.on('mouseenter', layerId, () => {
        if (this.map) this.map.getCanvas().style.cursor = 'pointer';
      });
      this.map.on('mouseleave', layerId, () => {
        if (this.map) this.map.getCanvas().style.cursor = '';
      });
    });
  }

  focusFeature(feature) {
    if (!this.map || !feature?.geometry) return;
    const coords = [];
    collectCoords(feature.geometry, coords);
    if (!coords.length) return;

    if (coords.length === 1) {
      this.map.flyTo({ center: coords[0], zoom: 12, duration: 500 });
    } else {
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new LngLatBounds(coords[0], coords[0])
      );
      this.map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 500 });
    }

    const title = feature.properties?._title || 'Location';
    this.popup?.remove();
    this.popup = new Popup({ closeButton: true, maxWidth: '240px' })
      .setLngLat(coords[0])
      .setHTML(`<div class="text-xs text-slate-900 font-semibold">${escapeHtml(title)}</div>`)
      .addTo(this.map);
  }

  panBy(x, y) {
    this.map?.panBy([x * 100, y * 100], { duration: 0 });
  }

  setData(featureCollection) {
    this.featureCollection = featureCollection;
    if (!this.map) return;
    if (this.map.isStyleLoaded()) {
      this.addGeoJsonLayers();
      this.fitToFeatures();
    } else {
      this.map.once('load', () => {
        if (!this.destroyed) {
          this.addGeoJsonLayers();
          this.fitToFeatures();
        }
      });
    }
  }

  fitToFeatures() {
    if (!this.map || !this.featureCollection?.features?.length) return;
    const coords = [];
    this.featureCollection.features.forEach((f) => collectCoords(f.geometry, coords));
    if (!coords.length) return;

    if (coords.length === 1) {
      this.map.flyTo({ center: coords[0], zoom: 11, duration: 500 });
      return;
    }

    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new LngLatBounds(coords[0], coords[0])
    );
    this.map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 500 });
  }

  resize() {
    this.map?.resize();
  }

  destroy() {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.popup?.remove();
    this.map?.remove();
    this.map = null;
    this.container.innerHTML = '';
  }
}