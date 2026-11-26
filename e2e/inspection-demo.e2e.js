import { expect, test } from '@playwright/test';

test('enables toolbar inspection tools only for the miniature demo', async ({ page }) => {
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const miniatureUrl = 'https://miniatures-iiif.fitzmuseum.cam.ac.uk/B-MIN-28/manifest.json';
  const makeManifest = (id, label) => ({
    id, type: 'Manifest', label: { en: [label] },
    items: [{
      id: `${id}/canvas`, type: 'Canvas', width: 1, height: 1,
      physicalDimensions: { profile: 'http://iiif.io/api/annex/extensions/physdim', physicalUnits: 'mm', physicalScale: 0.1 },
      items: [{ items: [{ motivation: 'painting', body: { type: 'Image', id: image } }] }],
    }],
  });
  await page.route('https://iiif.vam.ac.uk/collections/O24955/manifest.json', (route) =>
    route.fulfill({ json: makeManifest(route.request().url(), 'Default') }));
  await page.route(miniatureUrl, (route) =>
    route.fulfill({ json: makeManifest(miniatureUrl, 'Miniature') }));
  await page.goto('/');
  const viewer = page.locator('#iiif-viewer');
  await expect(viewer.locator('[data-el="manifest-title"]')).toHaveText('Default');
  await expect(viewer.locator('[data-inspect="ruler"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Miniature (v3)' }).click();
  await expect(viewer.locator('[data-el="manifest-title"]')).toHaveText('Miniature');
  const toolbar = viewer.locator('[data-el="inspection-buttons"]');
  const ruler = toolbar.locator('[data-inspect="ruler"]');
  const curtain = toolbar.locator('[data-inspect="curtain"]');
  await expect(ruler).toBeVisible();
  await expect(curtain).toBeVisible();
  await expect(viewer.locator('[data-el="inspection-tools"] [data-inspect="ruler"]')).toHaveCount(0);
  await ruler.click();
  await expect(viewer.locator('[data-inspect-panel="ruler"]')).toBeVisible();
  expect(await ruler.getAttribute('aria-controls')).toBe(await viewer.locator('[data-inspect-panel="ruler"]').getAttribute('id'));
  await curtain.click();
  await expect(viewer.locator('[data-inspect-panel="curtain"]')).toBeVisible();
  await expect(viewer.locator('[data-inspect-panel="ruler"]')).toBeHidden();

  await page.getByRole('button', { name: 'V&A Sculpture (v2)' }).click();
  await expect(viewer.locator('[data-el="manifest-title"]')).toHaveText('Default');
  await expect(toolbar).toBeHidden();
  await expect(viewer.locator('[data-inspect-panel="curtain"]')).toHaveCount(0);
});

test('keeps toolbar and panels usable in both themes on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto('/e2e/fixture.html');
  await page.evaluate(() => window.viewer.setInspectionTools({ physicalRuler: true, layersCurtain: true }));
  const ruler = page.locator('[data-el="inspection-buttons"] [data-inspect="ruler"]');
  await expect(ruler).toBeVisible();
  await ruler.click();
  const panel = page.locator('[data-inspect-panel="ruler"]');
  await expect(panel).toBeVisible();
  const checkBounds = async () => {
    const root = await page.locator('[data-el="viewer-root"]').boundingBox();
    const box = await panel.boundingBox();
    const button = await ruler.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(root.x);
    expect(box.x + box.width).toBeLessThanOrEqual(root.x + root.width);
    expect(button.x + button.width).toBeLessThanOrEqual(root.x + root.width);
  };
  await checkBounds();
  const darkBackground = await panel.evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.locator('[data-action="toggle-theme"]').click();
  const lightBackground = await panel.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(lightBackground).not.toBe(darkBackground);
  await checkBounds();
});
