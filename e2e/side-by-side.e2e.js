import { expect, test } from '@playwright/test';

test('compares canvases, synchronizes views and cleans up', async ({ page }) => {
  await page.goto('/e2e/fixture.html?sideBySide');
  await expect.poll(() => page.evaluate(() => window.viewer.osdController.osd.world.getItemCount())).toBe(1);
  const compare = page.getByRole('button', { name: 'Compare', exact: true });
  await compare.click();
  const pane = page.getByRole('region', { name: 'Secondary comparison pane' });
  await expect(pane).toBeVisible();
  await expect(compare).toHaveAttribute('aria-expanded', 'true');
  const selector = page.getByLabel('Secondary canvas');
  await expect(selector).toHaveValue('1');
  const sync = page.getByRole('button', { name: 'Sync View' });
  await expect(sync).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.viewer.comparison.osd.osd.world.getItemCount())).toBe(1);
  await page.evaluate(() => {
    const viewport = window.viewer.osdController.osd.viewport;
    viewport.zoomTo(viewport.getHomeZoom() * 1.5);
  });
  await expect.poll(() => page.evaluate(() => {
    const viewport = window.viewer.comparison.osd.osd.viewport;
    return viewport.getZoom(true) / viewport.getHomeZoom();
  })).toBeCloseTo(1.5, 1);
  await sync.click();
  await expect(sync).toHaveAttribute('aria-pressed', 'false');
  await sync.click();
  await page.evaluate(() => {
    const viewport = window.viewer.comparison.osd.osd.viewport;
    viewport.zoomTo(viewport.getHomeZoom() * 1.2);
  });
  await expect.poll(() => page.evaluate(() => {
    const viewport = window.viewer.osdController.osd.viewport;
    return viewport.getZoom(true) / viewport.getHomeZoom();
  })).toBeCloseTo(1.2, 1);
  await sync.click();
  await pane.getByRole('button', { name: 'Comparison settings', exact: true }).click();
  await selector.selectOption('0');
  await expect(page.locator('[data-el="compare-context"]')).toHaveText('Info: Secondary pane');
  await expect(page.locator('[data-el="sidebar-content"]')).toContainText('Page 1');
  await selector.selectOption('2');
  await expect(sync).toBeDisabled();
  await expect(pane.locator('[data-el="three-canvas-host"]')).toBeVisible();
  await selector.selectOption('1');
  await expect(sync).toBeEnabled();
  await page.getByRole('button', { name: 'Close Split' }).click();
  await expect(pane).toBeHidden();
  await expect(compare).toHaveAttribute('aria-expanded', 'false');
  await expect(compare).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.viewer.comparison == null)).toBe(true);
});

test('stacks panes on narrow screens and hides manifest entry when URL input is disabled', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto('/e2e/fixture.html?sideBySide');
  await page.evaluate(() => { window.viewer.options.showUrlInput = false; });
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.getByLabel('Secondary manifest URL')).toHaveCount(0);
  const primary = await page.locator('[data-el="primary-pane"]').boundingBox();
  const secondary = await page.getByRole('region', { name: 'Secondary comparison pane' }).boundingBox();
  expect(secondary.y).toBeGreaterThanOrEqual(primary.y + primary.height - 1);
});

test('keeps comparison controls usable in narrow panes and both themes', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/e2e/fixture.html?sideBySide');
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  const pane = page.getByRole('region', { name: 'Secondary comparison pane' });
  const header = pane.locator('.iiif-compare-header');
  const sync = pane.getByRole('button', { name: 'Sync View' });
  const settings = pane.getByRole('button', { name: 'Comparison settings', exact: true });
  const panel = pane.getByRole('region', { name: 'Comparison settings' });
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await settings.focus();
  await page.keyboard.press('Enter');
  await expect(settings).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();
  await expect(page.locator('[data-el="osd-container"] canvas').first()).toBeVisible();
  const image = await page.locator('[data-el="osd-container"]').boundingBox();
  await page.mouse.click(image.x + image.width / 2, image.y + image.height / 2);
  await expect(panel).toBeVisible();
  const select = pane.getByLabel('Secondary canvas');
  await select.evaluate((element) => { element.options[1].textContent = 'A very long canvas title '.repeat(20); });
  for (const control of [sync, pane.getByRole('button', { name: 'Swap Panes' }), pane.getByRole('button', { name: 'Close Split' })]) {
    const box = await control.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(32);
    expect(await control.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await expect.poll(() => header.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await pane.getByText('Secondary manifest', { exact: true }).click();
  await expect(pane.getByLabel('Secondary manifest URL')).toBeVisible();
  await expect.poll(() => header.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await expect(sync).toHaveCSS('color', 'rgb(255, 255, 255)');
  await sync.click();
  await expect(sync).toHaveAttribute('aria-pressed', 'false');
  await select.selectOption('2');
  await expect(sync).toBeDisabled();
  await expect.poll(() => header.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await select.focus();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(settings).toBeFocused();
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await settings.click();
  await pane.getByRole('button', { name: 'Close comparison settings' }).click();
  await expect(settings).toBeFocused();
});

test('keeps settings scrollable without resizing the secondary stage on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto('/e2e/fixture.html?sideBySide');
  await page.getByRole('button', { name: 'Close Info Panel' }).click();
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  const pane = page.getByRole('region', { name: 'Secondary comparison pane' });
  const stage = pane.locator('[data-compare="osd"]');
  const before = await stage.boundingBox();
  await pane.getByRole('button', { name: 'Comparison settings', exact: true }).click();
  const panel = pane.getByRole('region', { name: 'Comparison settings' });
  await expect(panel).toBeVisible();
  const after = await stage.boundingBox();
  expect(after.height).toBeCloseTo(before.height, 0);
  await panel.getByRole('button', { name: 'Use primary manifest' }).click();
  await pane.getByText('Secondary manifest', { exact: true }).click();
  await expect(panel.getByLabel('Secondary manifest URL')).toBeVisible();
  await panel.getByRole('button', { name: 'Close comparison settings' }).click();
  await expect(panel).toBeHidden();
});

test('supports a 3D primary scene with a 2D secondary canvas', async ({ page }) => {
  await page.goto('/e2e/fixture.html?sideBySide');
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.evaluate(() => window.viewer.goToCanvas(2));
  await expect(page.locator('[data-el="scene-container"] [data-el="three-canvas-host"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sync View' })).toBeDisabled();
  await page.getByRole('button', { name: 'Comparison settings' }).click();
  await page.getByLabel('Secondary canvas').focus();
  await expect(page.locator('[data-el="zoom-controls"]')).toBeVisible();
  await page.evaluate(() => window.viewer.goToCanvas(0));
  await expect(page.getByRole('button', { name: 'Sync View' })).toBeEnabled();
});

test('loads a secondary manifest and swaps across manifests', async ({ page }) => {
  await page.route('https://example.test/other.json', (route) => route.fulfill({ json: {
    type: 'Manifest', id: 'https://example.test/other.json', label: { en: ['Other'] },
    items: [{ type: 'Canvas', id: 'https://example.test/other-canvas', label: { en: ['Other page'] },
      items: [{ items: [{ motivation: 'painting', body: { type: 'Image', id: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' } }] }] }],
  } }));
  await page.goto('/e2e/fixture.html?sideBySide');
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.getByRole('button', { name: 'Comparison settings' }).click();
  await page.getByText('Secondary manifest', { exact: true }).click();
  await page.getByLabel('Secondary manifest URL').fill('https://example.test/other.json');
  await page.getByRole('button', { name: 'Load', exact: true }).last().click();
  await expect(page.getByLabel('Secondary canvas')).toHaveText('Other page');
  await expect(page.locator('[data-el="sidebar-content"]')).toContainText('Other');
  await page.getByRole('button', { name: 'Swap Panes' }).click();
  await expect(page.locator('[data-el="manifest-title"]')).toHaveText('Other');
  await expect(page.getByLabel('Secondary canvas')).toHaveValue('0');
  await expect(page.getByLabel('Secondary canvas')).toContainText('Page 1');
  await expect(page.getByRole('button', { name: 'Compare', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await page.evaluate(() => window.viewer.setManifest(window.viewer.state.rawManifest));
  await expect(page.getByRole('region', { name: 'Secondary comparison pane' })).toBeHidden();
});
