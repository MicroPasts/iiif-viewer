import { expect, test } from '@playwright/test';

test('opens the measurement configuration demo and measures an image', async ({ page }) => {
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  await page.route('**/examples/caryatid-manifest.json', (route) => route.fulfill({
    json: {
      id: 'https://example.test/manifest', type: 'Manifest', label: { en: ['Demo'] },
      items: [{
        id: 'https://example.test/canvas', type: 'Canvas', width: 1, height: 1,
        items: [{ items: [{ motivation: 'painting', target: 'https://example.test/canvas',
          body: { type: 'Image', id: image } }] }],
      }],
    },
  }));
  await page.route('https://iiif.vam.ac.uk/collections/O24955/manifest.json', (route) => route.abort());
  await page.goto('/');
  const viewer = page.locator('#example-measurement');
  await expect(viewer.locator('[data-el="viewer-root"]')).toHaveCount(0);
  await page.getByText('Measure an image', { exact: true }).click();
  await expect(viewer.locator('[data-el="manifest-title"]')).toHaveText('Demo');
  await expect(viewer.locator('[data-inspect="ruler"]')).toBeVisible();
  await viewer.locator('[data-inspect="measurement"]').click();
  await expect(viewer.locator('[data-inspect-panel="measurement"]')).toBeVisible();
  await viewer.locator('[data-inspect="measurement-start"]').click();
  await expect(viewer.locator('[data-inspect="measurement-status"]')).toContainText('Select two points');
  const imageBounds = await viewer.locator('[data-el="osd-container"]').boundingBox();
  await page.mouse.click(imageBounds.x + imageBounds.width * 0.6, imageBounds.y + imageBounds.height * 0.5);
  await page.mouse.click(imageBounds.x + imageBounds.width * 0.7, imageBounds.y + imageBounds.height * 0.5);
  await expect(viewer.locator('[data-inspect="measurement-list"]')).toContainText('px');
  await page.locator('#demo-theme').click();
  await expect(viewer.locator('[data-inspect-panel="measurement"]')).toBeVisible();
});
