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

  const noExternal = page.locator('#example-no-external-viewers');
  await expect(noExternal.locator('[data-el="viewer-root"]')).toHaveCount(0);
  await page.getByText('Hide external viewer links', { exact: true }).click();
  await expect(noExternal.locator('[data-el="manifest-title"]')).toHaveText('Caryatid (1816,0610.128)');
  await expect(noExternal.locator('[data-el="sidebar-content"]')).toContainText('Object Type');
  await expect(noExternal.locator('[data-el="external-viewers"]')).toHaveCount(0);
  await expect(noDrop.locator('[data-el="external-viewers"] a')).toHaveCount(2);
});

test('navigates canvases and changes the display language', async ({ page }) => {
  await page.locator('[data-el="filmstrip"] [data-canvas-index="1"]').click();
  await expect(page.locator('[data-el="canvas-counter"]')).toHaveText('2 / 3');
  await expect(page.locator('[data-el="sidebar-content"]')).toContainText('Page 2');
  await page.locator('[data-el="lang-select"]').selectOption('fr');
  await expect(page.locator('[data-el="manifest-title"]')).toHaveText('Livre');
  await expect(page.locator('[data-el="sidebar-content"]')).toContainText('Feuille 2');
});

test('configures external viewer links independently for each instance', async ({ page }) => {
  await page.evaluate(async () => {
    const { IIIFViewer } = await import('/src/index.js');
    for (const [id, externalViewers] of [
      ['custom-viewer', { mode: 'replace', viewers: [{ label: 'Custom tool', url: 'https://tools.example/view?manifest={manifest}&lang=en' }] }],
      ['hidden-viewer', false],
    ]) {
      const container = document.createElement('div');
      container.id = id;
      document.body.append(container);
      new IIIFViewer(container, { manifest: window.viewer.state.rawManifest, showSidebar: true, externalViewers });
    }
  });
  const custom = page.locator('#custom-viewer [data-el="external-viewers"]');
  await expect(custom.getByRole('link')).toHaveCount(1);
  await expect(custom.getByRole('link', { name: /Custom tool/ })).toHaveAttribute(
    'href', `https://tools.example/view?manifest=${encodeURIComponent('https://example.test/manifest')}&lang=en`
  );
  await expect(page.locator('#hidden-viewer [data-el="external-viewers"]')).toHaveCount(0);
  await expect(page.locator('#viewer [data-el="external-viewers"] a')).toHaveCount(2);
});

test('searches and opens a matching annotation', async ({ page }) => {
  await page.getByRole('tab', { name: 'Search', exact: true }).click();
  await page.locator('[data-el="manifest-search-input"]').fill('Ancient pottery');
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await expect(page.locator('[data-search-hit-index="0"]')).toContainText('Ancient pottery');
  await page.getByRole('tab', { name: 'Notes (1)' }).click();
  await expect(page.locator('[data-el="sidebar-content"]')).toContainText('Ancient pottery');
  await expect(page.locator('.iiif-anno-overlay')).toBeVisible();
});

test('keeps the newest remote search active when an earlier request is aborted', async ({ page }) => {
  await page.evaluate(() => {
    const fetch = window.fetch;
    window.searchRequests = {};
    window.searchRejections = [];
    window.addEventListener('unhandledrejection', (event) => {
      window.searchRejections.push(String(event.reason));
    });
    window.fetch = (url, options) => {
      if (!String(url).startsWith('https://example.test/search?')) return fetch(url, options);
      const query = new URL(url).searchParams.get('q');
      return new Promise((resolve, reject) => {
        window.searchRequests[query] = resolve;
        options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
    };
    window.viewer.searchController.setManifest({ service: [{ id: 'https://example.test/search', type: 'SearchService2' }] });
    window.viewer.renderSidebar();
  });
  await page.getByRole('tab', { name: 'Search', exact: true }).click();
  const input = page.locator('[data-el="manifest-search-input"]');
  await input.fill('first');
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.searchRequests.first))).toBe(true);
  await input.fill('second');
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.searchRequests.second))).toBe(true);
  await expect(page.locator('[data-el="search-status"]')).toHaveText('Searching manifest.');

  await page.evaluate(() => window.searchRequests.second({
    ok: true,
    json: async () => ({ items: [{ body: { value: 'New result' }, target: 'https://example.test/canvas/0' }] }),
  }));
  await expect(page.locator('[data-el="search-status"]')).toHaveText('1 match found.');
  await expect(page.locator('[data-el="search-results"]')).toContainText('New result');
  expect(await page.evaluate(() => window.searchRejections)).toEqual([]);
});

test('focuses a search result after its canvas image loads', async ({ page }) => {
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    return canvas.toDataURL('image/png');
  });
  let releaseImage;
  const imageReady = new Promise((resolve) => { releaseImage = resolve; });
  const imageUrl = 'https://example.test/search-image.png';
  await page.route(imageUrl, async (route) => {
    await imageReady;
    await route.fulfill({
      contentType: 'image/png',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: Buffer.from(image.split(',')[1], 'base64'),
    });
  });

  try {
    await page.evaluate(({ image, imageUrl }) => window.viewer.setManifest({
      type: 'Manifest', id: 'https://example.test/search-manifest', label: { en: ['Search book'] },
      items: [
        {
          type: 'Canvas', id: 'https://example.test/page-1', width: 100, height: 100,
          items: [{ items: [{ motivation: 'painting', body: { id: image, type: 'Image' } }] }],
        },
        {
          type: 'Canvas', id: 'https://example.test/page-2', width: 100, height: 100,
          items: [{ items: [{ motivation: 'painting', body: { id: imageUrl, type: 'Image' } }] }],
          annotations: [{ items: [{
            body: { value: 'Find this region' },
            target: 'https://example.test/page-2#xywh=10,10,20,20',
          }] }],
        },
      ],
    }), { image, imageUrl });
    await page.getByRole('tab', { name: 'Search', exact: true }).click();
    await page.locator('[data-el="manifest-search-input"]').fill('Find this region');
    await page.getByRole('button', { name: 'Find', exact: true }).click();
    await page.locator('[data-search-hit-index="0"]').click();
    await expect(page.locator('[data-el="canvas-counter"]')).toHaveText('2 / 2');
    await expect.poll(() => page.evaluate(() => window.viewer.osdController.awaitingImage)).toBe(true);

    releaseImage();
    await expect.poll(() => page.evaluate(() => {
      const viewport = window.viewer.osdController.osd.viewport;
      return viewport.getZoom(true) / viewport.getHomeZoom();
    })).toBeGreaterThan(1.5);
  } finally {
    releaseImage();
  }
});

test('hides annotation overlays when the user selects Hide Boxes', async ({ page }) => {
  await page.getByRole('tab', { name: 'Notes (1)' }).click();
  await expect(page.locator('.iiif-anno-overlay')).toBeVisible();
  await page.getByRole('button', { name: 'Hide Boxes' }).click();
  await expect(page.getByRole('button', { name: 'Show Boxes' })).toBeVisible();
  await expect(page.locator('.iiif-anno-overlay')).toBeHidden();
});

test('shows external annotation boxes when notes load before the image', async ({ page }) => {
  const imageService = 'https://example.test/slow-image';
  let releaseImage;
  const imageReady = new Promise((resolve) => { releaseImage = resolve; });
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  await page.route(`${imageService}/**`, (route) =>
    route.fulfill({ contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: pixel })
  );
  await page.route(`${imageService}/info.json`, async (route) => {
    await imageReady;
    await route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: {
        '@context': 'http://iiif.io/api/image/3/context.json',
        protocol: 'http://iiif.io/api/image',
        id: imageService, type: 'ImageService3', profile: 'level2', width: 100, height: 100,
        tiles: [{ width: 100, scaleFactors: [1] }],
      },
    });
  });
  await page.route('https://example.test/notes', (route) =>
    route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: { items: [{ body: { value: 'External note' }, target: 'https://example.test/canvas#xywh=10,10,20,20' }] },
    })
  );

  try {
    await page.evaluate((service) => window.viewer.setManifest({
      type: 'Manifest', id: 'https://example.test/manifest', label: { en: ['Delayed image'] },
      items: [{
        type: 'Canvas', id: 'https://example.test/canvas', width: 100, height: 100,
        items: [{ items: [{ motivation: 'painting', body: { type: 'Image', service: [{ id: service, type: 'ImageService3' }] } }] }],
        annotations: [{ id: 'https://example.test/notes', type: 'AnnotationPage' }],
      }],
    }), imageService);
    await page.getByRole('tab', { name: 'Notes (1)' }).click();
    await expect(page.locator('[data-el="sidebar-content"]')).toContainText('External note');
    await expect(page.locator('.iiif-anno-overlay')).toHaveCount(0);
    releaseImage();
    await expect(page.locator('.iiif-anno-overlay')).toBeVisible();
  } finally {
    releaseImage();
  }
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
