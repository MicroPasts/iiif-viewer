import { expect, test } from '@playwright/test';

test('copies and restores a zoomed, rotated view and language', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const manifestUrl = 'https://iiif.vam.ac.uk/collections/O24955/manifest.json';
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1200;
    return canvas.toDataURL();
  });
  const manifest = {
    type: 'Manifest', id: manifestUrl, label: { en: ['Book'], fr: ['Livre'] },
    items: ['one', 'two'].map((id) => ({
      id, type: 'Canvas', width: 1200, height: 1200, label: { en: [id], fr: [`fr-${id}`] },
      items: [{ items: [{ motivation: 'painting', target: id, body: { type: 'Image', id: image } }] }],
    })),
  };
  await page.route(manifestUrl, (route) => route.fulfill({ json: manifest }));
  await page.goto('/e2e/permalink-fixture.html?unrelated=keep#anchor');
  await expect.poll(() => page.evaluate(() => window.viewer?.osdController.awaitingImage)).toBe(false);
  await page.evaluate(() => window.viewer.goToCanvas(1));
  await expect.poll(() => page.evaluate(() => window.viewer.osdController.awaitingImage)).toBe(false);
  await page.evaluate(() => {
    const viewer = window.viewer;
    viewer.setLanguage('fr');
    viewer.osdController.rotateBy(90);
    viewer.osdController.toggleFlip('horizontal');
    const viewport = viewer.osdController.osd.viewport;
    viewport.zoomTo(viewport.getHomeZoom() * 2, null, true);
    const center = viewport.getCenter(true);
    center.x += 0.1;
    viewport.panTo(center, true);
  });
  await page.locator('#viewer [data-action="copy-permalink"]').click();
  await expect(page.locator('#viewer [data-el="permalink-status"]')).toHaveText('Link copied.');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const url = new URL(link);
  const region = url.searchParams.get('iiif-xywh').split(',').map(Number);
  expect(url.searchParams.get('iiif-canvas')).toBe('1');
  expect(url.searchParams.get('iiif-lang')).toBe('fr');
  expect(url.searchParams.get('unrelated')).toBe('keep');
  expect(url.hash).toBe('#anchor');
  await page.goto(link);
  await expect.poll(() => page.evaluate(() => window.viewer?.osdController.awaitingImage)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.viewer.state.canvasIndex)).toBe(1);
  expect(await page.evaluate(() => window.viewer.state.language)).toBe('fr');
  expect(await page.evaluate(() => window.viewer.osdController.transform)).toEqual({
    rotation: 90, flipHorizontal: true, flipVertical: false,
  });
  const restored = await page.evaluate(() => window.viewer.osdController.getViewRegion());
  restored.forEach((value, i) => expect(value, JSON.stringify({ region, restored, link })).toBeCloseTo(region[i], 4));
});

test('reports malformed links and cannot copy an in-memory manifest', async ({ page }) => {
  await page.goto('/e2e/permalink-fixture.html?iiif-manifest=https%3A%2F%2Fexample.test%2Fm&iiif-xywh=invalid');
  await expect(page.locator('#viewer [data-el="error-box"]')).toContainText('Invalid permalink');
  await page.evaluate(() => window.viewer.setManifest({ type: 'Manifest', items: [{ type: 'Canvas', id: 'one',
    items: [{ items: [{ motivation: 'painting', body: { type: 'Image', id: 'https://example.test/image.jpg' } }] }] }] }));
  await page.locator('#viewer [data-action="copy-permalink"]').click();
  await expect(page.locator('#viewer [data-el="permalink-status"]')).toContainText('not loaded from a shareable URL');
});

test('restores a prefixed v2 link without affecting an unrelated viewer', async ({ page }) => {
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const manifestUrl = 'https://example.test/v2';
  await page.route(manifestUrl, (route) => route.fulfill({ json: {
    '@context': 'http://iiif.io/api/presentation/2/context.json', '@id': manifestUrl, '@type': 'sc:Manifest',
    label: 'Book', sequences: [{ '@type': 'sc:Sequence', canvases: ['one', 'two'].map((id) => ({
      '@id': id, '@type': 'sc:Canvas', label: id, width: 1, height: 1,
      images: [{ '@type': 'oa:Annotation', motivation: 'sc:painting', on: id,
        resource: { '@id': image, '@type': 'dctypes:Image', format: 'image/png' } }],
    })) }],
  } }));
  const query = new URLSearchParams({ 'book-manifest': manifestUrl, 'book-canvas': '1', 'book-lang': 'fr' });
  await page.goto(`/e2e/fixture.html?${query}`);
  await page.evaluate(async () => {
    const { IIIFViewer } = await import('/src/index.js');
    const container = document.createElement('div');
    document.body.append(container);
    window.bookViewer = new IIIFViewer(container, { permalink: { prefix: 'book' }, showSidebar: false });
  });
  await expect.poll(() => page.evaluate(() => window.bookViewer.state.manifest?.version)).toBe('2.1');
  expect(await page.evaluate(() => [window.bookViewer.state.canvasIndex, window.bookViewer.state.language])).toEqual([1, 'fr']);
  expect(await page.evaluate(() => window.viewer.state.manifest.label)).toBe('Book');
  expect(await page.evaluate(() => window.viewer.state.canvasIndex)).toBe(0);
});

test('the demo page restores a shared manifest and current canvas', async ({ page }) => {
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const url = 'https://example.test/shared-manifest';
  await page.route(url, (route) => route.fulfill({ json: {
    type: 'Manifest', id: url, label: { en: ['Book'], fr: ['Livre'] },
    items: ['one', 'two'].map((id) => ({
      id, type: 'Canvas', width: 1, height: 1, label: { en: [id], fr: [`fr-${id}`] },
      items: [{ items: [{ motivation: 'painting', target: id, body: { type: 'Image', id: image } }] }],
    })),
  } }));
  const query = new URLSearchParams({ 'iiif-manifest': url, 'iiif-canvas': '1',
    'iiif-xywh': '-1,-1,2,2', 'iiif-lang': 'fr' });
  await page.goto(`/?${query}`);
  const viewer = page.locator('#iiif-viewer');
  await expect(viewer.locator('[data-el="manifest-title"]')).toHaveText('Livre');
  await expect(viewer.locator('[data-el="canvas-counter"]')).toHaveText('2 / 2');
  await expect(viewer.locator('[data-action="copy-permalink"]')).toBeVisible();
});
