import { expect, test } from '@playwright/test';

test('opens the comparison example and compares two pages', async ({ page }) => {
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  await page.route('https://iiif.library.ucla.edu/**/manifest', (route) => route.fulfill({
    json: {
      id: 'https://example.test/manifest', type: 'Manifest', label: { en: ['Comparison book'] },
      items: ['First page', 'Second page'].map((label, index) => ({
        id: `https://example.test/canvas/${index}`, type: 'Canvas', width: 1, height: 1,
        label: { en: [label] },
        items: [{ items: [{ motivation: 'painting', body: { type: 'Image', id: image } }] }],
      })),
    },
  }));
  await page.route('https://iiif.vam.ac.uk/collections/O24955/manifest.json', (route) => route.abort());
  await page.goto('/');
  const viewer = page.locator('#example-side-by-side');
  await expect(viewer.locator('[data-el="viewer-root"]')).toHaveCount(0);
  await page.getByText('Compare canvases side by side', { exact: true }).click();
  await expect(viewer.locator('[data-el="manifest-title"]')).toHaveText('Comparison book');
  await viewer.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(viewer.getByRole('region', { name: 'Secondary comparison pane' })).toBeVisible();
  await viewer.getByRole('button', { name: 'Comparison settings' }).click();
  await expect(viewer.getByLabel('Secondary canvas')).toHaveValue('1');
  await expect(viewer.getByLabel('Secondary canvas')).toContainText('Second page');
  await expect(viewer.getByRole('button', { name: 'Sync View' })).toHaveAttribute('aria-pressed', 'true');
  await viewer.getByLabel('Secondary canvas').selectOption('0');
  await viewer.getByRole('button', { name: 'Close Split' }).click();
  await expect(viewer.getByRole('button', { name: 'Compare', exact: true })).toHaveAttribute('aria-expanded', 'false');
});
