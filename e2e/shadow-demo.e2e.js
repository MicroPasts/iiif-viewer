import { expect, test } from '@playwright/test';

async function checkDemo(page, path) {
  await page.route('**/examples/caryatid-manifest.json', (route) => route.fulfill({
    json: { type: 'Manifest', label: { en: ['Demo'] }, items: [] },
  }));
  await page.goto(path);
  const heading = page.getByRole('heading', { name: 'Shadow DOM style isolation' });
  const toggle = page.locator('#toggle-viewer');
  const hostStyles = async () => Promise.all([heading, toggle].map((locator) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.fontFamily, style.fontSize, style.fontWeight, style.margin, style.padding, style.border, style.backgroundColor];
    })
  ));
  const before = await hostStyles();
  await toggle.click();
  await page.mouse.move(0, 0);
  const viewer = page.locator('#viewer');
  await expect(viewer.locator('[data-el="viewer-root"]')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(await hostStyles()).toEqual(before);
  await expect(viewer.getByRole('button', { name: 'Load', exact: true })).toHaveCSS('background-color', 'rgb(29, 78, 216)');
  await expect(viewer.getByRole('button', { name: 'Load', exact: true })).not.toHaveCSS('border-radius', '32px');
  expect(await viewer.evaluate((host) => host.shadowRoot?.mode)).toBe('open');
  await toggle.click();
  await expect(viewer.locator('[data-el="viewer-root"]')).toHaveCount(0);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await page.mouse.move(0, 0);
  await expect(viewer.locator('[data-el="viewer-root"]')).toBeVisible();
  expect(await hostStyles()).toEqual(before);
}

test('demonstrates host isolation in the development demo', async ({ page }) => {
  await checkDemo(page, '/shadow-demo.html');
});

test('demonstrates host isolation in the built docs', async ({ page }) => {
  test.skip(!process.env.RUN_BUILD_E2E, 'Run npm run build:docs, then set RUN_BUILD_E2E=1.');
  await checkDemo(page, '/docs/shadow-demo.html');
});
