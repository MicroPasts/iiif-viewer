import { expect, test } from '@playwright/test';

test('changes and resets the colour of the example viewer independently', async ({ page }) => {
  await page.route('https://iiif.vam.ac.uk/collections/O24955/manifest.json', (route) => route.abort());
  await page.route('**/examples/caryatid-manifest.json', (route) => route.fulfill({
    json: { type: 'Manifest', label: { en: ['Demo'] }, items: [] },
  }));
  await page.goto('/');
  const viewer = page.locator('#example-colours');
  await expect(viewer.locator('[data-el="viewer-root"]')).toHaveCount(0);
  const summary = page.getByText('Customise viewer colours', { exact: true });
  await summary.click();
  const group = page.getByRole('group', { name: 'Viewer accent colour' });
  const amber = group.getByRole('button', { name: 'Amber' });
  const teal = group.getByRole('button', { name: 'Teal' });
  const defaults = group.getByRole('button', { name: 'Default' });
  const load = viewer.getByRole('button', { name: 'Load', exact: true });
  const mainLoad = page.locator('#iiif-viewer').getByRole('button', { name: 'Load', exact: true });
  const mainColour = await mainLoad.evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect(amber).toHaveAttribute('aria-pressed', 'true');
  await expect(load).toHaveCSS('background-color', 'rgb(180, 83, 9)');
  await teal.click();
  await expect(teal).toHaveAttribute('aria-pressed', 'true');
  await expect(amber).toHaveAttribute('aria-pressed', 'false');
  await expect(load).toHaveCSS('background-color', 'rgb(15, 118, 110)');
  await expect(mainLoad).toHaveCSS('background-color', mainColour);
  await page.locator('#demo-theme').click();
  await expect(load).toHaveCSS('background-color', 'rgb(15, 118, 110)');
  await summary.click();
  await summary.click();
  await expect(teal).toHaveAttribute('aria-pressed', 'true');
  await defaults.click();
  await expect(defaults).toHaveAttribute('aria-pressed', 'true');
  await expect(load).toHaveCSS('background-color', mainColour);
  await expect(viewer).not.toHaveAttribute('style', /--iiif-accent/);
});
