import { expect, test } from '@playwright/test';

test('downloads the full curtain composite with the requested size and filters', async ({ page }) => {
  await page.goto('/e2e/fixture.html');
  const images = await page.evaluate(() => {
    const make = (color) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 100;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 100, 100);
      return canvas.toDataURL().split(',')[1];
    };
    return { red: make('red'), blue: make('blue') };
  });
  let restrictOverlay = false;
  await page.route('https://images.example/**', (route) => {
    const url = route.request().url();
    const color = url.includes('/blue/') ? 'blue' : 'red';
    if (url.endsWith('info.json')) return route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: {
        '@context': 'http://iiif.io/api/image/3/context.json',
        protocol: 'http://iiif.io/api/image',
        id: `https://images.example/${color}`, type: 'ImageService3', profile: color === 'blue' && restrictOverlay ? 'level0' : 'level2',
        width: 100, height: 100, sizes: [{ width: 50, height: 50 }],
        tiles: [{ width: 100, scaleFactors: [1] }],
      },
    });
    return route.fulfill({ contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: Buffer.from(images[color], 'base64') });
  });
  await page.evaluate(() => {
    const Viewer = window.viewer.constructor;
    window.viewer.destroy();
    const body = (color) => ({
      type: 'Image', id: `https://images.example/${color}/full/max/0/default.jpg`,
      service: [{ type: 'ImageService3', id: `https://images.example/${color}`, profile: 'level2' }],
    });
    window.viewer = new Viewer('#viewer', {
      imageDownload: { widths: [75], maxPixels: 10000 }, layersCurtain: true, showSidebar: false,
      manifest: { type: 'Manifest', rights: 'https://example.test/rights', items: [{
        type: 'Canvas', id: 'one', width: 100, height: 100,
        items: [{ items: [{ motivation: 'painting', target: 'one', body: { type: 'Choice', items: [body('red'), body('blue')] } }] }],
      }] },
    });
  });
  await expect.poll(() => page.evaluate(() => window.viewer.inspectionTools?.layersReady)).toBe(true);
  await page.locator('[data-inspect="curtain"]').click();
  await page.locator('[data-layer-visibility="0"]').click();
  await page.locator('[data-layer-clip="0"]').fill('40');
  await page.locator('[data-action="toggle-filters"]').click();
  await page.locator('[data-filter-toggle="grayscale"]').click();
  await page.locator('[data-el="download-button"] button').click();
  const size = page.locator('[data-download="size"]');
  await expect(size.locator('option')).toHaveCount(3);
  await expect(page.locator('[data-download="rights"]')).toHaveAttribute('href', 'https://example.test/rights');
  await size.selectOption('0');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-download="export"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('iiif-image.png');
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const pixels = await page.evaluate(async (data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    return {
      width: bitmap.width, height: bitmap.height,
      left: [...ctx.getImageData(10, 25, 1, 1).data],
      right: [...ctx.getImageData(40, 25, 1, 1).data],
    };
  }, Buffer.concat(chunks).toString('base64'));
  expect([pixels.width, pixels.height]).toEqual([50, 50]);
  expect(pixels.left[0]).toBeLessThan(pixels.right[0]);
  expect(pixels.left[0]).toBe(pixels.left[1]);
  expect(pixels.right[0]).toBe(pixels.right[1]);
  await page.locator('[data-action="rotate"]').click();
  await page.locator('[data-el="download-button"] button').click();
  await page.locator('[data-el="download-button"] button').click();
  await expect(page.locator('[data-download="export"]')).toBeEnabled();
  const secondPromise = page.waitForEvent('download');
  await page.locator('[data-download="export"]').click();
  const rotated = await secondPromise;
  const rotatedChunks = [];
  for await (const chunk of await rotated.createReadStream()) rotatedChunks.push(chunk);
  const rotatedPixels = await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))]));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    return [ctx.getImageData(25, 10, 1, 1).data[0], ctx.getImageData(25, 40, 1, 1).data[0]];
  }, Buffer.concat(rotatedChunks).toString('base64'));
  expect(rotatedPixels[0]).toBeLessThan(rotatedPixels[1]);
  restrictOverlay = true;
  await size.selectOption('1');
  await page.locator('[data-download="export"]').click();
  await expect(page.locator('[data-download="status"]')).toContainText('does not advertise support for 75 × 75');
});

test('enforces manifest sizes and download restrictions, including full resolution', async ({ page }) => {
  await page.goto('/e2e/fixture.html');
  const requests = [];
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 100;
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.route('https://sizes.example/**', (route) => {
    requests.push(route.request().url());
    if (route.request().url().endsWith('info.json')) return route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: { '@context': 'http://iiif.io/api/image/3/context.json', type: 'ImageService3',
        profile: 'level2', width: 100, height: 100, sizes: [{ width: 25, height: 25 }] },
    });
    return route.fulfill({ contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' },
      body: Buffer.from(png, 'base64') });
  });
  await page.evaluate(() => {
    const Viewer = window.viewer.constructor;
    window.viewer.destroy();
    window.testManifest = { type: 'Manifest', items: [{ type: 'Canvas', id: 'one', width: 100, height: 100,
      items: [{ items: [{ motivation: 'painting', body: { type: 'Image', id: 'https://sizes.example/image/full/max/0/default.jpg',
        service: [{ type: 'ImageService3', id: 'https://sizes.example/image', maxWidth: 75,
          sizes: [{ width: 50, height: 50 }, { width: 75, height: 75 }] }] } }] }] }] };
    window.viewer = new Viewer('#viewer', { manifest: window.testManifest,
      imageDownload: { widths: [], maxWidth: 80, excludeSizes: [{ width: 50, height: 50 }] } });
  });
  await page.locator('[data-el="download-button"] button').click();
  const options = page.locator('[data-download="size"] option');
  await expect(options).toHaveCount(4);
  await expect(options.nth(1)).toContainText('50 × 50 (advertised) — disallowed by configuration');
  await expect(options.nth(1)).toBeDisabled();
  await expect(options.nth(2)).toBeEnabled();
  await expect(options.nth(3)).toContainText('full resolution');
  await expect(options.nth(3)).toBeDisabled();
  await expect(page.locator('[data-download="original"]')).toBeDisabled();
  await page.evaluate(() => {
    const Viewer = window.viewer.constructor;
    window.viewer.destroy();
    window.testManifest.items[0].items[0].items[0].body.service[0].maxWidth = 100;
    window.viewer = new Viewer('#viewer', { manifest: window.testManifest,
      imageDownload: { widths: [], maxPixels: 10000 } });
  });
  await page.locator('[data-el="download-button"] button').click();
  const full = page.locator('[data-download="size"] option').last();
  await expect(full).toContainText('full resolution');
  await page.locator('[data-download="size"]').selectOption(await full.getAttribute('value'));
  const compositePromise = page.waitForEvent('download');
  await page.locator('[data-download="export"]').click();
  const composite = await compositePromise;
  const chunks = [];
  for await (const chunk of await composite.createReadStream()) chunks.push(chunk);
  expect(await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))]));
    return [bitmap.width, bitmap.height];
  }, Buffer.concat(chunks).toString('base64'))).toEqual([100, 100]);
  expect(requests).toContain('https://sizes.example/image/full/max/0/default.jpg');
  await page.evaluate(() => {
    const Viewer = window.viewer.constructor;
    window.viewer.destroy();
    window.viewer = new Viewer('#viewer', { manifest: window.testManifest,
      imageDownload: { widths: [], maxPixels: 9999 } });
  });
  await page.locator('[data-el="download-button"] button').click();
  await expect(page.locator('[data-download="size"] option').last()).toContainText('exceeds export pixel limit');
  const original = page.locator('[data-download="original"]');
  await expect(original).toHaveText('Download full-resolution service image (JPEG)');
  await expect(original).toBeEnabled();
  const promise = page.waitForEvent('download');
  await original.click();
  expect((await promise).suggestedFilename()).toBe('iiif-full-resolution.png');
  await page.evaluate(() => {
    const Viewer = window.viewer.constructor;
    window.viewer.destroy();
    window.viewer = new Viewer('#viewer', { manifest: window.testManifest, imageDownload: { allowOriginal: false } });
  });
  await page.locator('[data-el="download-button"] button').click();
  await expect(page.locator('[data-download="original"]')).toBeHidden();
  await expect(page.locator('[data-download="size"] option')).not.toContainText(['100 × 100']);
});

test('offers the original static image and hides download on scenes', async ({ page }) => {
  await page.goto('/e2e/fixture.html');
  await expect(page.locator('[data-el="download-button"]')).toBeHidden();
  await page.evaluate(() => {
    const Viewer = window.viewer.constructor;
    const manifest = window.viewer.state.rawManifest;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 10;
    manifest.items[0].items[0].items[0].body.id = canvas.toDataURL('image/png');
    window.viewer.destroy();
    window.viewer = new Viewer('#viewer', { manifest, imageDownload: true });
  });
  await page.locator('[data-el="download-button"] button').click();
  await expect(page.locator('[data-download="original"]')).toBeVisible();
  const promise = page.waitForEvent('download');
  await page.locator('[data-download="original"]').click();
  const download = await promise;
  expect(download.suggestedFilename()).toBe('iiif-original.png');
  await page.evaluate(() => {
    const Viewer = window.viewer.constructor;
    const manifest = window.viewer.state.rawManifest;
    window.viewer.destroy();
    window.viewer = new Viewer('#viewer', { manifest, imageDownload: { excludeSizes: [{ width: 10, height: 10 }] } });
  });
  await page.locator('[data-el="download-button"] button').click();
  await expect(page.locator('[data-download="size"] option').last()).toContainText('disallowed by configuration');
  await expect(page.locator('[data-download="original"]')).toBeDisabled();
  await page.locator('[data-el="filmstrip"] [data-canvas-index="2"]').click();
  await expect(page.locator('[data-el="download-button"]')).toBeHidden();
});

test('reports image service failures without producing a download', async ({ page }) => {
  await page.goto('/e2e/fixture.html');
  await page.route('https://broken.example/image/info.json', (route) =>
    route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.evaluate(() => {
    const Viewer = window.viewer.constructor;
    window.viewer.destroy();
    window.viewer = new Viewer('#viewer', {
      imageDownload: true,
      manifest: { type: 'Manifest', items: [{ type: 'Canvas', id: 'one',
        items: [{ items: [{ motivation: 'painting', body: { type: 'Image', id: 'https://broken.example/image/full/max/0/default.jpg',
          service: [{ type: 'ImageService3', id: 'https://broken.example/image' }] } }] }] }] },
    });
  });
  await page.locator('[data-el="download-button"] button').click();
  await expect(page.locator('[data-download="status"]')).toContainText('HTTP 503');
  await expect(page.locator('[data-download="export"]')).toBeDisabled();
});

test('downloads a configured size from the live Caryatid image service', async ({ page }) => {
  test.skip(process.env.IIIF_LIVE_TEST !== '1', 'Set IIIF_LIVE_TEST=1 to test the external service.');
  test.setTimeout(90000);
  await page.goto('/');
  await page.getByText('Download an image', { exact: true }).click();
  const viewer = page.locator('#example-download');
  await expect(viewer.locator('[data-el="manifest-title"]')).toContainText('Caryatid');
  await viewer.locator('[data-el="download-button"] button').click();
  await expect(viewer.locator('[data-download="size"] option').first()).toContainText('33 × 43 (advertised)', { timeout: 30000 });
  await expect(viewer.locator('[data-download="size"] option').filter({ hasText: '1067 × 1396' })).toBeDisabled();
  await expect(viewer.locator('[data-download="size"] option').filter({ hasText: '4270 × 5584' })).toBeDisabled();
  await viewer.locator('[data-download="size"]').selectOption({ label: '300 × 392' });
  const downloadPromise = page.waitForEvent('download');
  await viewer.locator('[data-download="export"]').click();
  const download = await downloadPromise;
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const dimensions = await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))]));
    return [bitmap.width, bitmap.height];
  }, Buffer.concat(chunks).toString('base64'));
  expect(dimensions).toEqual([300, 392]);
});
