import { expect, test } from '@playwright/test';

test('resizing is opt-in', async ({ page }) => {
  await page.goto('/e2e/fixture.html');
  await expect(page.getByRole('separator', { name: 'Information panel width' })).toHaveCount(0);
});

test('resizes the sidebar with drag, keyboard and buttons without losing its width', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/e2e/fixture.html?resizableSidebar');
  const sidebar = page.locator('[data-el="sidebar"]');
  const viewport = page.locator('[data-el="osd-container"]');
  const separator = page.getByRole('separator', { name: 'Information panel width' });
  await expect(separator).toBeVisible();
  await expect(separator).toHaveAttribute('aria-valuenow', '320');
  await expect(page.getByRole('button', { name: 'Make information panel wider' })).toBeHidden();
  const tabs = sidebar.getByRole('tab');
  const tabsBox = await sidebar.getByRole('tablist').boundingBox();
  for (const tab of await tabs.all()) {
    const box = await tab.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(tabsBox.x);
    expect(box.x + box.width).toBeLessThanOrEqual(tabsBox.x + tabsBox.width + 0.1);
    expect(await tab.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await expect.poll(() => page.evaluate(() => window.viewer.osdController.osd.world.getItemCount())).toBe(1);
  const before = await viewport.boundingBox();
  const handle = await separator.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 100);
  await page.mouse.down();
  await page.mouse.move(handle.x - 100, handle.y + 100, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBeGreaterThan(410);
  const grown = await sidebar.boundingBox();
  await expect.poll(async () => (await viewport.boundingBox()).width).toBeLessThan(before.width - 90);
  await expect.poll(() => page.evaluate(() => window.viewer.osdController.osd.viewport.containerSize.x))
    .toBeCloseTo((await viewport.boundingBox()).width, 0);

  await separator.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBeCloseTo(grown.width - 24, 0);
  await sidebar.getByText('Panel width', { exact: true }).click();
  await page.getByRole('button', { name: 'Make information panel wider' }).click();
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBeCloseTo(grown.width, 0);
  await page.getByRole('button', { name: 'Info', exact: true }).click();
  await expect(sidebar).toBeHidden();
  await page.getByRole('button', { name: 'Info', exact: true }).click();
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBeCloseTo(grown.width, 0);
  await page.getByRole('button', { name: 'Reset information panel width' }).click();
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBe(320);

  await separator.focus();
  await page.keyboard.press('End');
  const workspace = await page.locator('[data-el="workspace"]').boundingBox();
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBeCloseTo(workspace.width - 240, 0);
  await page.keyboard.press('Home');
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBe(240);
  await sidebar.getByRole('tab', { name: 'Metadata' }).focus();
  await page.keyboard.press('End');
  await expect(sidebar.getByRole('tab', { name: 'Map' })).toBeFocused();
});

test('keeps the mobile overlay and restores the desktop width after a breakpoint change', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto('/e2e/fixture.html?resizableSidebar');
  const sidebar = page.locator('[data-el="sidebar"]');
  const separator = page.getByRole('separator', { name: 'Information panel width' });
  await separator.focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBe(344);
  await page.setViewportSize({ width: 600, height: 900 });
  await expect(separator).toBeHidden();
  await expect(sidebar).toHaveCSS('position', 'absolute');
  await expect(page.getByRole('button', { name: 'Reset information panel width', includeHidden: true })).toBeHidden();
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(separator).toBeVisible();
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBe(344);
});

test('clamps a resized panel when its host shrinks and restores the preferred width', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/e2e/fixture.html?resizableSidebar');
  const sidebar = page.locator('[data-el="sidebar"]');
  const separator = page.getByRole('separator', { name: 'Information panel width' });
  await separator.focus();
  await page.keyboard.press('End');
  const desired = (await sidebar.boundingBox()).width;
  await page.locator('#viewer').evaluate((element) => { element.style.width = '500px'; });
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBe(258);
  await expect(separator).toHaveAttribute('aria-valuemax', '258');
  await page.locator('#viewer').evaluate((element) => { element.style.width = ''; });
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBeCloseTo(desired, 0);
});

test('notifies custom 3D views and maps when the panel changes size', async ({ page }) => {
  await page.goto('/e2e/fixture.html?resizableSidebar');
  await page.evaluate(() => {
    window.resizeCalls = { model: 0, map: 0 };
    window.viewer.activeModelViewer = { handleResize: () => { window.resizeCalls.model += 1; } };
    window.viewer.activeNavMap = { resize: () => { window.resizeCalls.map += 1; } };
  });
  await page.getByText('Panel width', { exact: true }).click();
  await page.getByRole('button', { name: 'Make information panel wider' }).click();
  await expect.poll(() => page.evaluate(() => window.resizeCalls.model)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.resizeCalls.map)).toBeGreaterThan(0);
  await page.evaluate(() => {
    window.viewer.activeModelViewer = null;
    window.viewer.activeNavMap = null;
  });
});
