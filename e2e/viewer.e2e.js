import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/styles/liberty', (route) =>
    route.fulfill({
      json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eeeeee' } }] },
    })
  );
  await page.goto('/e2e/fixture.html');
  await expect(page.getByText('Book', { exact: true }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.viewer.osdController.osd.world.getItemCount())).toBe(1);
});

test('demonstrates independent viewer configuration options', async ({ page }) => {
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const manifest = (label) => ({
    type: 'Manifest',
    id: 'https://example.test/manifest',
    label: { en: [label] },
    items: [{
      type: 'Canvas',
      id: 'https://example.test/canvas',
      items: [{ items: [{ motivation: 'painting', body: { id: image, type: 'Image' } }] }],
    }],
  });
  await page.route('https://iiif.vam.ac.uk/collections/O24955/manifest.json', (route) =>
    route.fulfill({ json: manifest('Demo') })
  );
  const imageService = 'https://media.britishmuseum.org/iiif/Repository/Documents/2014_11/12_17/f2edcae6_45cf_4de8_b421_a3e1011e5ea5/00117221_001.ptif';
  let infoRequests = 0;
  await page.route(`${imageService}/**`, (route) => {
    if (route.request().url().endsWith('/info.json')) {
      infoRequests += 1;
      return route.fulfill({
        headers: { 'Access-Control-Allow-Origin': '*' },
        json: {
          '@context': 'http://iiif.io/api/image/3/context.json',
          id: imageService,
          type: 'ImageService3',
          profile: 'level2',
          width: 4270,
          height: 5584,
          tiles: [{ width: 128, height: 128, scaleFactors: [1, 2, 4, 8, 16, 32, 64] }],
        },
      });
    }
    return route.fulfill({
      contentType: 'image/png',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: Buffer.from(image.split(',')[1], 'base64'),
    });
  });
  await page.route('https://example.test/other-manifest', (route) =>
    route.fulfill({ json: manifest('Dropped book') })
  );
  await page.goto('/');
  await expect(page.locator('#example-no-url [data-el="viewer-root"]')).toHaveCount(0);

  await page.getByText('Hide the URL bar', { exact: true }).click();
  const noUrl = page.locator('#example-no-url');
  await expect(noUrl.locator('[data-el="manifest-title"]')).toHaveText('Caryatid (1816,0610.128)');
  await expect.poll(() => infoRequests).toBeGreaterThan(0);
  await expect(noUrl.locator('[data-el="url-input"]')).toHaveCount(0);
  await noUrl.locator('[data-el="viewer-root"]').evaluate((root) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', 'https://example.test/other-manifest');
    root.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
  });
  await expect(noUrl.locator('[data-el="manifest-title"]')).toHaveText('Dropped book');
  await page.getByText('Hide the URL bar', { exact: true }).click();
  await page.getByText('Hide the URL bar', { exact: true }).click();
  await expect(noUrl.locator('[data-el="manifest-title"]')).toHaveText('Dropped book');

  await page.getByText('Disable manifest drops', { exact: true }).click();
  const noDrop = page.locator('#example-no-drop');
  await expect(noDrop.locator('[data-el="manifest-title"]')).toHaveText('Caryatid (1816,0610.128)');
  await expect(noDrop.locator('[data-el="url-input"]')).toBeVisible();
  const droppedRequests = await noDrop.locator('[data-el="viewer-root"]').evaluate((root) => {
    const fetch = window.fetch;
    const requests = [];
    window.fetch = (...args) => {
      requests.push(args[0]);
      return fetch(...args);
    };
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', 'https://example.test/other-manifest');
    root.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    window.fetch = fetch;
    return requests;
  });
  expect(droppedRequests).toEqual([]);
  await expect(noDrop.locator('[data-el="manifest-title"]')).toHaveText('Caryatid (1816,0610.128)');

  await page.getByText('Start with fewer controls', { exact: true }).click();
  const minimal = page.locator('#example-minimal');
  await expect(minimal.locator('[data-el="manifest-title"]')).toHaveText('Caryatid (1816,0610.128)');
  await expect(minimal.locator('[data-el="url-input"]')).toHaveCount(0);
  await expect(minimal.locator('[data-el="sidebar"]')).toBeHidden();
  await minimal.getByRole('button', { name: 'Info', exact: true }).click();
  await expect(minimal.locator('[data-el="sidebar"]')).toBeVisible();
});

test('navigates canvases and changes the display language', async ({ page }) => {
  await page.locator('[data-el="filmstrip"] [data-canvas-index="1"]').click();
  await expect(page.locator('[data-el="canvas-counter"]')).toHaveText('2 / 3');
  await expect(page.locator('[data-el="sidebar-content"]')).toContainText('Page 2');
  await page.locator('[data-el="lang-select"]').selectOption('fr');
  await expect(page.locator('[data-el="manifest-title"]')).toHaveText('Livre');
  await expect(page.locator('[data-el="sidebar-content"]')).toContainText('Feuille 2');
});

test('searches and opens a matching annotation', async ({ page }) => {
  await page.getByRole('tab', { name: 'Search', exact: true }).click();
  await page.locator('[data-el="manifest-search-input"]').fill('pottery');
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await expect(page.locator('[data-search-hit-index="0"]')).toContainText('Ancient pottery');
  await page.getByRole('tab', { name: 'Notes (1)' }).click();
  await expect(page.locator('[data-el="sidebar-content"]')).toContainText('Ancient pottery');
  await expect(page.locator('.iiif-anno-overlay')).toBeVisible();
});

test('hides annotation overlays when the user selects Hide Boxes', async ({ page }) => {
  await page.getByRole('tab', { name: 'Notes (1)' }).click();
  await expect(page.locator('.iiif-anno-overlay')).toBeVisible();
  await page.getByRole('button', { name: 'Hide Boxes' }).click();
  await expect(page.getByRole('button', { name: 'Show Boxes' })).toBeVisible();
  await expect(page.locator('.iiif-anno-overlay')).toBeHidden();
});

test('renders a navPlace point and opens its popup', async ({ page }) => {
  await page.getByRole('tab', { name: 'Map (1)' }).click();
  await expect.poll(() => page.evaluate(() => {
    const map = window.viewer.activeNavMap?.map;
    return map?.getLayer('navplace-points') && map.getZoom() > 10
      ? map.queryRenderedFeatures({ layers: ['navplace-points'] }).length
      : 0;
  })).toBeGreaterThan(0);
  const canvas = page.locator('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.locator('.maplibregl-popup')).toContainText('London');
  const longitude = await page.evaluate(() => window.viewer.activeNavMap.map.getCenter().lng);
  await page.getByRole('button', { name: 'Move map view right' }).click();
  await expect.poll(() => page.evaluate(() => window.viewer.activeNavMap.map.getCenter().lng)).toBeGreaterThan(longitude);
});

test('loads a 3D model and toggles wireframe', async ({ page }) => {
  await page.locator('[data-el="filmstrip"] [data-canvas-index="2"]').click();
  await expect(page.locator('[data-el="three-stats"]')).toContainText('1 mesh');
  const wireframe = page.locator('[data-three-action="wireframe"]');
  await wireframe.click();
  await expect(wireframe).toHaveAttribute('aria-pressed', 'true');
});

test('hides image filters for 3D and restores them on returning to an image', async ({ page }) => {
  const filters = page.getByRole('button', { name: 'Filters' });
  await filters.click();
  const brightness = page.getByRole('slider', { name: 'Brightness' });
  await brightness.fill('130');
  await page.locator('[data-el="filmstrip"] [data-canvas-index="2"]').click();
  await expect(page.locator('[data-el="zoom-controls"]')).toBeHidden();
  await expect(page.locator('[data-el="filter-bar"]')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Wireframe' })).toBeVisible();
  await page.locator('[data-el="filmstrip"] [data-canvas-index="0"]').click();
  await expect(filters).toBeVisible();
  await expect(filters).toHaveAttribute('aria-expanded', 'false');
  await filters.click();
  await expect(brightness).toHaveValue('130');
});

test('navigates tabs and controls without hijacking keyboard focus', async ({ page }) => {
  const metadata = page.getByRole('tab', { name: 'Metadata' });
  await metadata.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Index' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Index' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-el="canvas-counter"]')).toHaveText('1 / 3');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Map (1)' })).toBeFocused();
  await page.getByRole('tab', { name: 'Search' }).click();
  const search = page.getByRole('searchbox', { name: 'Search within manifest' });
  await search.fill('pottery');
  await search.press('Enter');
  await expect(search).toBeFocused();
  await expect(page.locator('[data-el="search-status"]')).toContainText('match');
  await page.locator('[data-el="viewer-root"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-el="canvas-counter"]')).toHaveText('2 / 3');
  await page.getByRole('button', { name: 'Filters' }).click();
  const brightness = page.getByRole('slider', { name: 'Brightness' });
  await brightness.focus();
  await page.keyboard.press('ArrowRight');
  await expect(brightness).toHaveAttribute('aria-valuetext', '101%');
  await expect(page.locator('[data-el="canvas-counter"]')).toHaveText('2 / 3');
  await page.evaluate(() => window.viewer.osdController.osd.viewport.zoomTo(4, null, true));
  const x = await page.evaluate(() => window.viewer.osdController.osd.viewport.getCenter().x);
  await page.getByRole('button', { name: 'Move image view right' }).click();
  await expect.poll(() => page.evaluate(() => window.viewer.osdController.osd.viewport.getCenter().x)).toBeGreaterThan(x);
});

test('provides keyboard and button access to 3D model navigation', async ({ page }) => {
  await page.locator('[data-el="filmstrip"] [data-canvas-index="2"]').click();
  await expect(page.locator('[data-el="three-stats"]')).toContainText('1 mesh');
  const canvas = page.locator('[data-el="three-canvas-host"] canvas');
  await expect(canvas).toHaveAttribute('tabindex', '0');
  await canvas.focus();
  const distance = await page.evaluate(() => window.viewer.activeModelViewer.camera.position.distanceTo(window.viewer.activeModelViewer.controls.target));
  await page.keyboard.press('+');
  await expect.poll(() => page.evaluate(() => window.viewer.activeModelViewer.camera.position.distanceTo(window.viewer.activeModelViewer.controls.target))).toBeLessThan(distance);
  await page.getByText('Move view', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rotate 3D view left' })).toBeVisible();
  const fileButton = page.getByRole('button', { name: 'Open .GLB' });
  await fileButton.focus();
  await expect(fileButton).toBeFocused();
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await chooser;
});

test('maintains text contrast for inspected controls in both themes', async ({ page }) => {
  const contrast = (locator) => locator.evaluate((element) => {
    const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const color = (value) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const blend = (front, back) => front.slice(0, 3).map((value, i) => value * front[3] + back[i] * (1 - front[3]));
    const luminance = (rgb) => rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
    const backgrounds = [];
    for (let node = element; node; node = node.parentElement) {
      backgrounds.unshift(color(getComputedStyle(node).backgroundColor));
    }
    const background = backgrounds.reduce((back, front) => blend(front, back), [255, 255, 255]);
    const foreground = blend(color(getComputedStyle(element).color), background);
    const [a, b] = [luminance(foreground), luminance(background)];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });

  for (const theme of ['dark', 'light']) {
    if (theme === 'light') {
      await page.getByRole('button', { name: 'Dark mode' }).click();
      await page.waitForTimeout(200);
    }
    await page.getByRole('tab', { name: 'Metadata' }).click();
    expect(await contrast(page.getByText('Open in Other IIIF Tools'))).toBeGreaterThanOrEqual(4.5);
    expect(await contrast(page.locator('[data-el="filmstrip"] [data-canvas-index="2"] span').first())).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('tab', { name: 'Notes (1)' }).click();
    expect(await contrast(page.getByText('Region Overlays'))).toBeGreaterThanOrEqual(4.5);
    expect(await contrast(page.getByText('commenting', { exact: true }))).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('tab', { name: 'Map (1)' }).click();
    expect(await contrast(page.getByText('Locations (1)'))).toBeGreaterThanOrEqual(4.5);
    expect(await contrast(page.getByText('Point', { exact: true }))).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('button', { name: 'Info', exact: true }).hover();
    await page.waitForTimeout(200);
    expect(await contrast(page.getByRole('button', { name: 'Info', exact: true }))).toBeGreaterThanOrEqual(4.5);
  }
});
