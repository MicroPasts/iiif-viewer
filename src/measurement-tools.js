import OpenSeadragon from 'openseadragon';
import { imageToViewerPoint, viewerToImagePoint } from './image-coordinates.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function measurementValue(type, points) {
  if (type === 'area') {
    let twiceArea = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      twiceArea += a.x * b.y - b.x * a.y;
    }
    return Math.abs(twiceArea) / 2;
  }
  return points.slice(1).reduce((sum, point, i) =>
    sum + Math.hypot(point.x - points[i].x, point.y - points[i].y), 0);
}

export class MeasurementTools {
  constructor(host, osd, inspection) {
    this.host = host;
    this.osd = osd;
    this.inspection = inspection;
    this.measurements = new Map();
    this.points = [];
    this.mode = null;
    this.svg = host.querySelector('[data-inspect="measurement-drawing"]');
    this.status = host.querySelector('[data-inspect="measurement-status"]');
    this.onPointerUp = (event) => this.addPoint(event);
    this.onKeyDown = (event) => {
      if (event.key === 'Escape' && this.mode) {
        event.preventDefault();
        this.cancel();
        this.status.textContent = 'Measurement cancelled.';
      }
    };
    this.svg.addEventListener('pointerup', this.onPointerUp);
    inspection.wrapper.addEventListener('keydown', this.onKeyDown);
  }

  setCanvas(canvas) {
    this.cancel();
    this.canvas = canvas;
    this.status.textContent = 'Choose a measurement type to begin.';
    this.render();
  }

  start() {
    if (!this.inspection.base) {
      this.status.textContent = 'Wait for the image to load.';
      return;
    }
    this.mode = this.host.querySelector('[data-inspect="measurement-type"]').value;
    this.points = [];
    this.svg.classList.add('is-drawing');
    this.status.textContent = this.mode === 'line'
      ? 'Select two points on the image. Press Escape to cancel.'
      : 'Select points on the image, then choose Finish. Press Escape to cancel.';
    this.render();
  }

  addPoint(event) {
    if (!this.mode || event.button !== 0 || !this.inspection.base) return;
    const bounds = this.svg.getBoundingClientRect();
    const pixel = new OpenSeadragon.Point(event.clientX - bounds.left, event.clientY - bounds.top);
    const point = viewerToImagePoint(this.osd, this.inspection.base, pixel);
    const size = this.inspection.base.getContentSize();
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) ||
        point.x < 0 || point.y < 0 || point.x > size.x || point.y > size.y) {
      this.status.textContent = 'Select points within the image.';
      return;
    }
    this.points.push({ x: point.x, y: point.y });
    if (this.mode === 'line' && this.points.length === 2) {
      if (measurementValue('line', this.points) === 0) {
        this.points.pop();
        this.status.textContent = 'Select a different second point.';
        this.renderDrawing();
      } else {
        this.finish();
      }
    } else {
      this.render();
    }
  }

  finish() {
    if (!this.mode) {
      this.status.textContent = 'Start a measurement first.';
      return;
    }
    const minimum = this.mode === 'area' ? 3 : 2;
    if (this.points.length < minimum || measurementValue(this.mode, this.points) <= 0) {
      this.status.textContent = `Select at least ${minimum} points forming a non-zero ${this.mode === 'area' ? 'area' : 'length'}.`;
      return;
    }
    const measurements = this.measurements.get(this.canvas) || [];
    measurements.push({ type: this.mode, points: this.points });
    this.measurements.set(this.canvas, measurements);
    this.cancel();
    this.status.textContent = 'Measurement added.';
    this.render();
  }

  cancel() {
    this.mode = null;
    this.points = [];
    this.svg.classList.remove('is-drawing');
    this.render();
  }

  remove(index) {
    const measurements = this.measurements.get(this.canvas);
    if (!measurements || !measurements[index]) return;
    measurements.splice(index, 1);
    this.status.textContent = 'Measurement removed.';
    this.render();
    const next = this.host.querySelector(`[data-measurement-remove="${Math.min(index, measurements.length - 1)}"]`);
    (next || this.host.querySelector('[data-inspect="measurement-clear"]'))?.focus();
  }

  clear() {
    this.measurements.delete(this.canvas);
    this.cancel();
    this.status.textContent = 'Measurements cleared.';
    this.render();
  }

  resetManifest() {
    this.measurements.clear();
    this.cancel();
  }

  render() {
    const measurements = this.measurements.get(this.canvas) || [];
    const list = this.host.querySelector('[data-inspect="measurement-list"]');
    list.replaceChildren();
    measurements.forEach((measurement, index) => {
      const value = measurementValue(measurement.type, measurement.points);
      const scale = this.inspection.millimetersPerPixel;
      const area = measurement.type === 'area';
      const result = scale ? value * (area ? scale * scale : scale) : value;
      const units = scale ? (area ? 'mm²' : 'mm') : (area ? 'px²' : 'px');
      const row = document.createElement('div');
      row.className = 'iiif-measurement-row';
      const label = document.createElement('span');
      const formatted = Number.isFinite(result) ? `${Number(result.toPrecision(5))} ${units}` : 'outside the displayable range';
      label.textContent = `${measurement.type === 'line' ? 'Line' : measurement.type === 'polyline' ? 'Polyline' : 'Area'} ${index + 1}: ${formatted}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.measurementRemove = String(index);
      button.textContent = 'Remove';
      button.setAttribute('aria-label', `Remove ${label.textContent}`);
      row.append(label, button);
      list.append(row);
    });

    this.renderDrawing();
  }

  renderDrawing() {
    const measurements = this.measurements.get(this.canvas) || [];
    this.svg.replaceChildren();
    if (!this.inspection.base || this.host.hidden) return;
    const shapes = [...measurements, ...(this.mode ? [{ type: this.mode, points: this.points }] : [])];
    for (const shape of shapes) {
      const screenPoints = shape.points.map((point) =>
        imageToViewerPoint(this.osd, this.inspection.base, new OpenSeadragon.Point(point.x, point.y)));
      if (screenPoints.length > 1) {
        const path = document.createElementNS(SVG_NS, shape.type === 'area' && screenPoints.length >= 3 ? 'polygon' : 'polyline');
        path.setAttribute('points', screenPoints.map((point) => `${point.x},${point.y}`).join(' '));
        path.setAttribute('class', 'iiif-measurement-path');
        this.svg.append(path);
      }
      for (const point of screenPoints) {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', point.x);
        circle.setAttribute('cy', point.y);
        circle.setAttribute('r', '4');
        circle.setAttribute('class', 'iiif-measurement-point');
        this.svg.append(circle);
      }
    }
  }

  destroy() {
    this.svg.removeEventListener('pointerup', this.onPointerUp);
    this.inspection.wrapper.removeEventListener('keydown', this.onKeyDown);
    this.measurements.clear();
  }
}
