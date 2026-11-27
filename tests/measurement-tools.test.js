// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

vi.mock('openseadragon', () => ({
  default: { Point: class { constructor(x, y) { Object.assign(this, { x, y }); } } },
}));

import { measurementValue, MeasurementTools } from '../src/measurement-tools.js';

describe('measurement tools', () => {
  it('calculates line, polyline, and polygon geometry in image pixels', () => {
    const points = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }];
    expect(measurementValue('line', points.slice(0, 2))).toBe(3);
    expect(measurementValue('polyline', points)).toBe(7);
    expect(measurementValue('area', points)).toBe(6);
    expect(measurementValue('area', [...points].reverse())).toBe(6);
  });

  it('validates points, updates calibrated values, and retains results per canvas', () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div>
      <select data-inspect="measurement-type"><option value="line">Line</option><option value="area">Area</option></select>
      <p data-inspect="measurement-status"></p><div data-inspect="measurement-list"></div>
      <svg data-inspect="measurement-drawing"></svg>
    </div>`;
    const host = wrapper.firstElementChild;
    const base = {
      getContentSize: () => ({ x: 100, y: 100 }),
      viewportToImageCoordinates: (point) => point,
      imageToViewerElementCoordinates: (point) => point,
    };
    const inspection = { wrapper, base, millimetersPerPixel: null };
    const tools = new MeasurementTools(host, { viewport: { pointFromPixel: (point) => point } }, inspection);
    const first = {};
    const second = {};
    const add = (x, y) => tools.addPoint({ button: 0, clientX: x, clientY: y });
    tools.setCanvas(first);
    tools.start();
    add(-1, 0);
    expect(tools.status.textContent).toContain('within the image');
    add(0, 0);
    add(0, 0);
    expect(tools.status.textContent).toContain('different second point');
    add(3, 4);
    expect(host.textContent).toContain('Line 1: 5 px');
    inspection.millimetersPerPixel = 2;
    tools.render();
    expect(host.textContent).toContain('Line 1: 10 mm');
    host.querySelector('select').value = 'area';
    tools.start();
    add(0, 0);
    add(3, 0);
    tools.finish();
    expect(tools.status.textContent).toContain('at least 3 points');
    add(3, 4);
    tools.finish();
    expect(host.textContent).toContain('Area 2: 24 mm²');
    tools.setCanvas(second);
    expect(host.textContent).not.toContain('Line 1');
    tools.setCanvas(first);
    expect(host.textContent).toContain('Line 1: 10 mm');
    tools.remove(0);
    expect(host.textContent).not.toContain('Line 1');
    tools.resetManifest();
    expect(host.querySelector('[data-inspect="measurement-list"]').children).toHaveLength(0);
    tools.destroy();
  });
});
