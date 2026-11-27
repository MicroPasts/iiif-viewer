import { expect, test } from '@playwright/test';

test.skip(!process.env.RUN_BUILD_E2E, 'Run npm run build and npm run build:docs, then set RUN_BUILD_E2E=1.');
test.use({ baseURL: process.env.BUILD_E2E_URL || 'http://127.0.0.1:46781' });

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const manifest = {
  id: 'https://example.test/manifest', type: 'Manifest', label: { en: ['Map test'] },
  navPlace: { type: 'FeatureCollection', features: [{
    type: 'Feature', geometry: { type: 'Point', coordinates: [-0.12, 51.5] }, properties: { label: 'London' },
  }] },
  items: [{
    id: 'https://example.test/canvas', type: 'Canvas',
    items: [{ items: [{ motivation: 'painting', body: { id: image, type: 'Image' } }] }],
  }],
};

test.beforeEach(async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/styles/liberty', (route) =>
    route.fulfill({ json: { version: 8, sources: {}, layers: [] } }));
});

for (const build of ['docs', 'library']) {
  test(`${build} build loads the worker and renders navPlace`, async ({ page }) => {
    const workers = [];
    page.on('worker', (worker) => workers.push(worker.url()));
    await page.route('https://iiif.vam.ac.uk/collections/O24955/manifest.json',
      (route) => route.fulfill({ json: manifest }));
    await page.goto('/docs/');
    let viewer;
    if (build === 'docs') {
      viewer = page.locator('#iiif-viewer');
    } else {
      await page.evaluate(async (data) => {
        const { IIIFViewer } = await import('/dist/iiif-viewer.js');
        const container = document.createElement('div');
        container.id = 'build-test-viewer';
        document.body.append(container);
        window.buildTestViewer = new IIIFViewer(container, { manifest: data, showSidebar: true });
      }, manifest);
      viewer = page.locator('#build-test-viewer');
    }

    await viewer.getByRole('tab', { name: 'Map (1)' }).click();
    await expect.poll(async () => viewer.locator('.maplibregl-canvas').count()).toBe(1);
    await expect.poll(() => viewer.locator('.maplibregl-canvas').evaluate((canvas) => canvas.width)).toBeGreaterThan(0);
    await expect.poll(() => workers.length).toBeGreaterThan(0);
    if (build === 'docs') {
      expect(workers[0]).toMatch(/\/docs\/assets\/maplibre-gl-worker-[^/]+\.js$/);
    } else {
      expect(workers[0]).toMatch(/^(data:|blob:)/);
    }
    const mapCanvas = viewer.locator('.maplibregl-canvas');
    await expect.poll(async () => {
      await mapCanvas.click();
      return viewer.locator('.maplibregl-popup').count();
    }, { timeout: 15000 }).toBeGreaterThan(0);
    await expect(viewer.locator('.maplibregl-popup')).toContainText('London');
  });
}
