import { expect, test } from '@playwright/test';

test('inspects the active resource without changing the image viewport', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/e2e/fixture.html');
  await page.evaluate(async () => {
    const Viewer = window.viewer.constructor;
    window.viewer.destroy();
    const image = document.createElement('canvas');
    image.width = image.height = 100;
    const body = { type: 'Image', id: image.toDataURL() };
    window.testManifest = {
      id: 'manifest', type: 'Manifest', label: { en: ['Test manifest'] }, metadata: [{ label: { en: ['Title'] }, value: { en: ['Example'] } }],
      items: ['one', 'two'].map((id) => ({
        id, type: 'Canvas', width: 100, height: 100, label: { en: [id] },
        items: [{ items: [{ motivation: 'painting', target: id, body }] }],
      })),
    };
    window.viewer = new Viewer('#viewer', { manifest: window.testManifest, inspector: true, showSidebar: false });
  });
  await expect.poll(() => page.evaluate(() => window.viewer.osdController.osd.world.getItemCount())).toBe(1);
  const osd = page.locator('[data-el="osd-container"]');
  const before = await osd.boundingBox();
  await page.locator('[data-action="toggle-json-inspector"]').click();
  const drawer = page.locator('[data-el="json-inspector"]');
  await expect(drawer).toBeVisible();
  expect(await osd.boundingBox()).toEqual(before);
  await expect(drawer.locator('[data-json-content]')).toContainText('metadata');
  await drawer.locator('summary').filter({ hasText: '"metadata": Array' }).click();
  await expect(drawer.locator('[data-json-content]')).toContainText('"0": Object');
  await drawer.locator('[data-json-scope]').selectOption('canvas');
  await drawer.locator('[data-json-view="raw"]').click();
  await expect(drawer.locator('[data-json-content]')).toContainText('"one"');
  await drawer.locator('[data-json-action="copy"]').click();
  expect(JSON.parse(await page.evaluate(() => navigator.clipboard.readText())).id).toBe('one');
  const download = page.waitForEvent('download');
  await drawer.locator('[data-json-action="download"]').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('canvas-1.json');
  const chunks = [];
  for await (const chunk of await file.createReadStream()) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString()).id).toBe('one');
  await page.evaluate(() => window.viewer.goToCanvas(1));
  await expect(drawer.locator('[data-json-content]')).toContainText('"two"');
  await expect(drawer.locator('[data-json-context]')).toContainText('2 of 2');
  await drawer.locator('[data-json-action="close"]').click();
  await expect(drawer).toBeHidden();
  await expect(page.locator('[data-action="toggle-json-inspector"]')).toBeFocused();
  await page.locator('[data-action="toggle-json-inspector"]').click();
  await drawer.locator('[data-json-scope]').focus();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
});

test('demonstrates the inspector in the configuration examples', async ({ page }) => {
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  await page.route('**/examples/caryatid-manifest.json', (route) => route.fulfill({ json: {
    type: 'Manifest', label: { en: ['Demo'] }, items: [{
      id: 'canvas', type: 'Canvas', width: 1, height: 1,
      items: [{ items: [{ motivation: 'painting', target: 'canvas', body: { type: 'Image', id: image } }] }],
    }],
  } }));
  await page.route('https://iiif.vam.ac.uk/collections/O24955/manifest.json', (route) => route.abort());
  await page.goto('/');
  await page.getByText('Inspect IIIF JSON', { exact: true }).click();
  const viewer = page.locator('#example-inspector');
  await expect(viewer.locator('[data-el="manifest-title"]')).toHaveText('Demo');
  await viewer.locator('[data-action="toggle-json-inspector"]').click();
  await expect(viewer.locator('[data-json-content]')).toContainText('Manifest');
});
