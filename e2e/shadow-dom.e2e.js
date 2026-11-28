import { expect, test } from '@playwright/test';

test('isolates host styles and applies custom theme variables', async ({ page }) => {
  await page.goto('/e2e/shadow-fixture.html');
  const before = await page.evaluate(() => {
    const styles = (element) => {
      const css = getComputedStyle(element);
      return [css.fontSize, css.fontWeight, css.marginBlockStart, css.padding, css.borderStyle];
    };
    return [styles(document.querySelector('h1')), styles(document.querySelector('body > button'))];
  });
  const after = await page.evaluate(async () => {
    const { IIIFViewer } = await import('/src/index.js');
    window.viewer = new IIIFViewer('#viewer');
    const host = document.createElement('div');
    host.id = 'second-viewer';
    host.style.setProperty('--iiif-surface-muted', '#ddd6fe');
    host.style.setProperty('--tw-rotate-z', 'rotate(27deg)');
    document.body.append(host);
    window.secondViewer = new IIIFViewer(host, {
      theme: 'light',
      themeVars: { '--iiif-accent': '#b45309', '--iiif-accent-hover': '#92400e', '--iiif-accent-contrast': '#ffffff' },
    });
    const styles = (element) => {
      const css = getComputedStyle(element);
      return [css.fontSize, css.fontWeight, css.marginBlockStart, css.padding, css.borderStyle];
    };
    return [styles(document.querySelector('h1')), styles(document.querySelector('body > button'))];
  });
  expect(after).toEqual(before);
  const viewer = page.locator('#second-viewer');
  const load = viewer.getByRole('button', { name: 'Load', exact: true });
  await expect(load).toHaveCSS('background-color', 'rgb(180, 83, 9)');
  await load.hover();
  await expect(load).toHaveCSS('background-color', 'rgb(146, 64, 14)');
  await expect(viewer.getByRole('tab', { name: 'Metadata' })).toHaveCSS('color', 'rgb(180, 83, 9)');
  await expect(viewer.locator('[data-el="toolbar"]')).toHaveCSS('background-color', 'rgb(221, 214, 254)');
  const utilityStyles = await viewer.evaluate((host) => {
    const root = host.shadowRoot.querySelector('[data-el="viewer-root"]');
    const probe = document.createElement('div');
    probe.className = 'shadow-lg -translate-x-1/2';
    root.append(probe);
    const styles = getComputedStyle(probe);
    const ring = document.createElement('button');
    ring.className = 'focus:ring-1 focus:ring-purple-500';
    host.shadowRoot.querySelector('.iiif-theme').append(ring);
    ring.focus();
    const result = {
      shadow: styles.boxShadow,
      translate: styles.translate,
      inheritedRotation: styles.getPropertyValue('--tw-rotate-z').trim(),
      ring: getComputedStyle(ring).boxShadow,
    };
    probe.remove();
    ring.remove();
    return result;
  });
  expect(utilityStyles.shadow).not.toBe('none');
  expect(utilityStyles.translate).toContain('-50%');
  expect(utilityStyles.inheritedRotation).not.toBe('rotate(27deg)');
  expect(utilityStyles.ring).toContain('1px');
  const properties = await viewer.evaluate((host) => {
    const sheet = host.shadowRoot.querySelector('style').sheet;
    const registered = [];
    let defaults;
    const visit = (rules) => {
      for (const rule of rules) {
        if (rule.constructor.name === 'CSSPropertyRule' && rule.name.startsWith('--tw-')) registered.push(rule.name);
        if (rule.selectorText?.includes('.iiif-theme *') && rule.style?.getPropertyValue('--tw-border-style')) defaults = rule.style;
        if (rule.cssRules) visit(rule.cssRules);
      }
    };
    visit(sheet.cssRules);
    return { registered, missing: registered.filter((name) => !defaults?.getPropertyValue(name)) };
  });
  expect(properties.registered.length).toBeGreaterThan(0);
  expect(properties.missing).toEqual([]);
  await page.evaluate(() => window.secondViewer.setThemeVars({ '--iiif-accent': '#2563eb' }));
  await expect(viewer.getByRole('tab', { name: 'Metadata' })).toHaveCSS('color', 'rgb(37, 99, 235)');
  await page.evaluate(() => window.secondViewer.setTheme('dark'));
  await expect(viewer.getByRole('tab', { name: 'Metadata' })).toHaveCSS('color', 'rgb(37, 99, 235)');
  await expect(viewer.locator('[data-el="toolbar"]')).toHaveCSS('background-color', 'rgb(221, 214, 254)');
  await page.evaluate(() => window.secondViewer.destroy());
  await expect(viewer.locator('[data-el="viewer-root"]')).toHaveCount(0);
  await expect(page.locator('#viewer [data-el="viewer-root"]')).toBeVisible();
});

test('destroys a map and image viewer without leaving shadow nodes or global map styles', async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/styles/liberty', (route) =>
    route.fulfill({ json: { version: 8, sources: {}, layers: [] } }));
  await page.goto('/e2e/fixture.html');
  await page.getByRole('tab', { name: 'Map (1)' }).click();
  await expect(page.locator('.maplibregl-ctrl-zoom-in')).toBeVisible();
  await expect(page.locator('.maplibregl-ctrl-zoom-in')).toHaveCSS('width', '29px');
  const cleanup = await page.evaluate(() => {
    const root = window.viewer.shadowRoot;
    const map = window.viewer.activeNavMap.map;
    const osd = window.viewer.osdController.osd;
    const globalMapStyles = [...document.querySelectorAll('style')].filter((style) => style.textContent.includes('.maplibregl-ctrl'));
    window.viewer.destroy();
    return { nodes: root.childNodes.length, mapRemoved: map._removed, osdElement: osd.element, globalMapStyles: globalMapStyles.length };
  });
  expect(cleanup.nodes).toBe(0);
  expect(cleanup.mapRemoved).toBe(true);
  expect(cleanup.osdElement).toBeNull();
  expect(cleanup.globalMapStyles).toBe(0);
});

test('supports native and fallback fullscreen inside the shadow root', async ({ page }) => {
  await page.goto('/e2e/fixture.html');
  const fullscreen = page.getByRole('button', { name: 'Fullscreen' });
  await fullscreen.click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('viewer');
  await expect(fullscreen).toHaveAttribute('aria-pressed', 'true');
  await fullscreen.click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBe(null);
  await expect(fullscreen).toHaveAttribute('aria-pressed', 'false');
  await page.evaluate(() => { document.querySelector('#viewer').requestFullscreen = undefined; });
  await fullscreen.click();
  await expect(fullscreen).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#viewer .iiif-theme')).toHaveCSS('position', 'fixed');
  await page.keyboard.press('Escape');
  await expect(fullscreen).toHaveAttribute('aria-pressed', 'false');
});

test('disposes the 3D scene when the shadow viewer is destroyed', async ({ page }) => {
  await page.goto('/e2e/fixture.html');
  await page.locator('[data-el="filmstrip"] [data-canvas-index="2"]').click();
  await expect(page.locator('[data-el="three-stats"]')).toContainText('1 mesh');
  const result = await page.evaluate(() => {
    const viewer = window.viewer;
    const scene = viewer.activeModelViewer;
    const root = viewer.shadowRoot;
    viewer.destroy();
    return { destroyed: scene.destroyed, remainingNodes: root.childNodes.length, modelViewer: viewer.activeModelViewer };
  });
  expect(result.destroyed).toBe(true);
  expect(result.remainingNodes).toBe(0);
  expect(result.modelViewer).toBeNull();
});
