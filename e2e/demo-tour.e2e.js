import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://iiif.vam.ac.uk/collections/O24955/manifest.json', (route) =>
    route.fulfill({ json: { type: 'Manifest', items: [{ type: 'Canvas', id: 'one',
      items: [{ items: [{ motivation: 'painting', body: { type: 'Image', id: 'image.jpg' } }] }] }] } }));
  await page.route('**/examples/caryatid-manifest.json', (route) =>
    route.fulfill({ json: { type: 'Manifest', label: { en: ['Demo'] }, items: [] } }));
  await page.route('https://iiif.library.ucla.edu/**/manifest', (route) =>
    route.fulfill({ json: { type: 'Manifest', label: { en: ['Book'] }, items: [] } }));
  await page.goto('/');
});

for (const viewport of [{ width: 1280, height: 720 }, { width: 375, height: 667 }]) {
  test(`walks through the demo and supports dismissal at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const launch = page.getByRole('button', { name: 'Take a tour' });
    await expect(page.locator('.driver-popover')).toHaveCount(0);
    await launch.click();
    const popover = page.locator('.demo-tour-popover');
    const title = popover.locator('.driver-popover-title');
    await expect(title).toHaveText('Choose a manifest');
    await expect(popover).toBeVisible();
    await expect(popover).toHaveCSS('background-color', 'rgb(30, 41, 59)');
    await expect(popover.locator('.driver-popover-progress-text')).toHaveText('1 of 10');
    const steps = [
      ['Load your own manifest', '#iiif-viewer [data-el="url-form"]'],
      ['Explore the viewer', '#iiif-viewer [data-action="toggle-fullscreen"]'],
      ['Information and navigation', '#iiif-viewer [data-action="toggle-sidebar"][aria-expanded]'],
      ['Try configuration examples', '#configuration-examples > div'],
      ['Customise viewer colours', '[data-tour="colours"]'],
      ['Compare canvases', '[data-tour="comparison"]'],
      ['Change the theme', '#demo-theme'],
      ['See style isolation', '[data-tour="shadow-demo"]'],
      ['Explore the code', 'a[aria-label="View source on GitHub"]'],
    ];
    for (const [step, selector] of steps) {
      await popover.getByRole('button', { name: /Next/ }).click();
      await expect(title).toHaveText(step);
      await expect(page.locator(selector)).toHaveClass(/driver-active-element/);
      if (step === 'Customise viewer colours' || step === 'Compare canvases') {
        await expect(page.locator(selector).locator('..')).toHaveAttribute('open', '');
        await expect(page.locator(selector).locator('..').locator('[data-el="viewer-root"]')).toBeVisible();
      }
      if (step === 'Compare canvases') {
        await expect(page.locator('[data-tour="colours"]').locator('..')).not.toHaveAttribute('open');
      }
      const bounds = await popover.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    }
    await expect(page.locator('#configuration-examples details[open]')).toHaveCount(0);
    await popover.getByRole('button', { name: 'Finish' }).click();
    await expect(popover).toHaveCount(0);
    await expect(launch).toBeFocused();
    await launch.click();
    await expect(title).toHaveText('Choose a manifest');
    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
    await expect(launch).toBeFocused();
  });
}

test('adapts the tour to the light theme and supports keyboard navigation', async ({ page }) => {
  await page.locator('#demo-theme').click();
  const launch = page.getByRole('button', { name: 'Take a tour' });
  await launch.focus();
  await page.keyboard.press('Enter');
  const popover = page.locator('.demo-tour-popover');
  await expect(popover.locator('.driver-popover-title')).toHaveText('Choose a manifest');
  await expect(popover).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await popover.getByRole('button', { name: /Next/ }).focus();
  await page.keyboard.press('Enter');
  await expect(popover.locator('.driver-popover-title')).toHaveText('Load your own manifest');
  await popover.getByRole('button', { name: /Previous/ }).focus();
  await page.keyboard.press('Enter');
  await expect(popover.locator('.driver-popover-title')).toHaveText('Choose a manifest');
  await popover.getByRole('button', { name: 'Close tour' }).click();
  await expect(launch).toBeFocused();
});

test('preserves previously opened examples and restores tour-opened examples on back and dismissal', async ({ page }) => {
  const colours = page.locator('[data-tour="colours"]').locator('..');
  const comparison = page.locator('[data-tour="comparison"]').locator('..');
  await page.locator('[data-tour="colours"]').click();
  await expect(colours).toHaveAttribute('open', '');
  const launch = page.getByRole('button', { name: 'Take a tour' });
  await launch.click();
  const popover = page.locator('.demo-tour-popover');
  const title = popover.locator('.driver-popover-title');
  for (let i = 0; i < 6; i++) await popover.getByRole('button', { name: /Next/ }).click();
  await expect(title).toHaveText('Compare canvases');
  await expect(colours).toHaveAttribute('open', '');
  await expect(comparison).toHaveAttribute('open', '');
  await popover.getByRole('button', { name: /Previous/ }).click();
  await expect(title).toHaveText('Customise viewer colours');
  await expect(comparison).not.toHaveAttribute('open');
  await expect(colours).toHaveAttribute('open', '');
  await popover.getByRole('button', { name: /Next/ }).click();
  await expect(comparison).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(comparison).not.toHaveAttribute('open');
  await expect(colours).toHaveAttribute('open', '');
  await expect(launch).toBeFocused();
});

test('works when the current example is a 3D scene', async ({ page }) => {
  await page.route('https://iiif.io/api/cookbook/recipe/0608-mvm-3d/v4/manifest.json', (route) =>
    route.fulfill({ json: { type: 'Manifest', items: [{ type: 'Scene', id: 'scene',
      items: [{ items: [{ motivation: 'painting', body: { type: 'Model', id: 'missing.glb' } }] }] }] } }));
  await page.getByRole('button', { name: '3D Model (v4)' }).click();
  await expect(page.locator('#iiif-viewer [data-el="scene-container"]')).toBeVisible();
  await page.getByRole('button', { name: 'Take a tour' }).click();
  const popover = page.locator('.demo-tour-popover');
  await popover.getByRole('button', { name: /Next/ }).click();
  await popover.getByRole('button', { name: /Next/ }).click();
  await expect(popover.locator('.driver-popover-title')).toHaveText('Explore the viewer');
  await popover.getByRole('button', { name: 'Close tour' }).click();
});
