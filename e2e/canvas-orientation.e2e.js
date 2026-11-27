import { expect, test } from '@playwright/test';

async function setup(page, persistCanvasTransform) {
  await page.goto('/e2e/fixture.html');
  await page.evaluate((persist) => {
    const Viewer = window.viewer.constructor;
    window.viewer.destroy();
    const image = document.createElement('canvas');
    image.width = image.height = 100;
    const ctx = image.getContext('2d');
    for (const [x, y, color] of [[0, 0, 'red'], [50, 0, 'lime'], [0, 50, 'blue'], [50, 50, 'yellow']]) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 50, 50);
    }
    const body = { type: 'Image', id: image.toDataURL() };
    window.orientationManifest = {
      type: 'Manifest', label: { en: ['Orientation test'] },
      items: ['one', 'two'].map((id) => ({
        id, type: 'Canvas', width: 100, height: 100,
        items: [{ items: [{ motivation: 'painting', target: id, body }] }],
      })),
    };
    window.viewer = new Viewer('#viewer', { manifest: window.orientationManifest, persistCanvasTransform: persist,
      showSidebar: false, imageDownload: true, measurement: true });
  }, persistCanvasTransform);
  await expect.poll(() => page.evaluate(() => window.viewer.inspectionTools?.base != null)).toBe(true);
}

for (const persist of [false, true]) {
  test(`orientation ${persist ? 'persists' : 'resets'} across canvas navigation and resets on manifest load`, async ({ page }) => {
    await setup(page, persist);
    await page.locator('[data-action="rotate"]').click();
    await page.locator('[data-action="toggle-filters"]').click();
    await page.locator('[data-action="flip-horizontal"]').click();
    await page.locator('[data-action="flip-vertical"]').click();
    await page.evaluate(() => window.viewer.goToCanvas(1));
    await expect.poll(() => page.evaluate(() => window.viewer.inspectionTools?.base != null)).toBe(true);
    expect(await page.evaluate(() => window.viewer.osdController.transform)).toEqual({
      rotation: persist ? 90 : 0, flipHorizontal: persist, flipVertical: persist,
    });
    await expect(page.locator('[data-action="flip-horizontal"]')).toHaveAttribute('aria-pressed', String(persist));
    expect(await page.evaluate(() => window.viewer.osdController.osd.viewport.getRotation())).toBe(persist ? 270 : 0);
    await page.evaluate(() => window.viewer.setManifest(window.orientationManifest));
    expect(await page.evaluate(() => window.viewer.osdController.transform)).toEqual({
      rotation: 0, flipHorizontal: false, flipVertical: false,
    });
    await expect(page.locator('[data-action="flip-vertical"]')).toHaveAttribute('aria-pressed', 'false');
  });
}

test('flip, rotation, measurement overlay and downloaded pixels agree', async ({ page }) => {
  await setup(page, true);
  await page.locator('[data-action="rotate"]').click();
  await page.locator('[data-action="toggle-filters"]').click();
  await page.locator('[data-action="flip-horizontal"]').click();
  await page.locator('[data-action="toggle-filters"]').click();
  await expect.poll(() => page.evaluate(() => {
    const osd = window.viewer.osdController.osd;
    const canvas = osd.drawer.canvas;
    const ctx = canvas.getContext('2d');
    const point = osd.world.getItemAt(0).getContentSize().times(0);
    point.x = 25; point.y = 25;
    const screen = osd.world.getItemAt(0).imageToViewerElementCoordinates(point);
    if (osd.viewport.getFlip()) screen.x = osd.viewport.getContainerSize().x - screen.x;
    return [...ctx.getImageData(Math.round(screen.x * canvas.width / canvas.clientWidth),
      Math.round(screen.y * canvas.height / canvas.clientHeight), 1, 1).data].slice(0, 3);
  })).toEqual([255, 0, 0]);
  const imagePoint = async (x, y) => page.evaluate(({ x, y }) => {
    const osd = window.viewer.osdController.osd;
    const point = osd.world.getItemAt(0).getContentSize().times(0);
    point.x = x;
    point.y = y;
    const screen = osd.world.getItemAt(0).imageToViewerElementCoordinates(point);
    if (osd.viewport.getFlip()) screen.x = osd.viewport.getContainerSize().x - screen.x;
    const rect = osd.element.getBoundingClientRect();
    return { x: rect.x + screen.x, y: rect.y + screen.y };
  }, { x, y });
  await page.locator('[data-inspect="measurement"]').click();
  await page.locator('[data-inspect="measurement-start"]').click();
  const first = await imagePoint(20, 20);
  const second = await imagePoint(80, 20);
  await page.mouse.click(first.x, first.y);
  await page.mouse.click(second.x, second.y);
  await expect(page.locator('[data-inspect="measurement-list"]')).toContainText('Line 1: 60 px');
  const actual = await page.locator('[data-inspect="measurement-drawing"] circle').first().evaluate((element) => {
    const rect = element.ownerSVGElement.getBoundingClientRect();
    return { x: rect.x + Number(element.getAttribute('cx')), y: rect.y + Number(element.getAttribute('cy')) };
  });

  expect(actual.x).toBeCloseTo(first.x, 0);
  expect(actual.y).toBeCloseTo(first.y, 0);
  await page.locator('[data-action="toggle-filters"]').click();
  await page.locator('[data-action="flip-vertical"]').click();
  const updated = await imagePoint(20, 20);
  await expect.poll(() => page.locator('[data-inspect="measurement-drawing"] circle').first().evaluate((element) => {
    const rect = element.ownerSVGElement.getBoundingClientRect();
    return Math.round(rect.x + Number(element.getAttribute('cx')));
  })).toBe(Math.round(updated.x));
  await page.locator('[data-action="flip-vertical"]').click();
  await page.locator('[data-action="toggle-filters"]').click();
  await page.locator('[data-el="download-button"] button').click();
  await expect(page.locator('[data-download="export"]')).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.locator('[data-download="export"]').click();
  const chunks = [];
  for await (const chunk of await (await download).createReadStream()) chunks.push(chunk);
  const colors = await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))]));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    return [[25, 25], [75, 25], [25, 75], [75, 75]].map(([x, y]) =>
      [...context.getImageData(x, y, 1, 1).data].slice(0, 3));
  }, Buffer.concat(chunks).toString('base64'));
  expect(colors).toEqual([[255, 255, 0], [0, 255, 0], [0, 0, 255], [255, 0, 0]]);
});

test('orientation demo loads a navigable book with persistence enabled', async ({ page }) => {
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  await page.route('https://iiif.vam.ac.uk/collections/O24955/manifest.json', (route) => route.abort());
  await page.route('https://iiif.library.ucla.edu/**/manifest', (route) => route.fulfill({ json: {
    type: 'Manifest', label: { en: ['Book'] }, items: ['one', 'two'].map((id) => ({
      id, type: 'Canvas', width: 1, height: 1,
      items: [{ items: [{ motivation: 'painting', target: id, body: { type: 'Image', id: image } }] }],
    })),
  } }));
  await page.goto('/');
  await page.getByText('Keep canvas orientation', { exact: true }).click();
  const viewer = page.locator('#example-orientation');
  await expect(viewer.locator('[data-el="manifest-title"]')).toHaveText('Book');
  await viewer.locator('[data-action="toggle-filters"]').click();
  await viewer.locator('[data-action="flip-horizontal"]').click();
  await viewer.locator('[data-action="next-canvas"]').click();
  await expect(viewer.locator('[data-action="flip-horizontal"]')).toHaveAttribute('aria-pressed', 'true');
});

test('preserves image orientation through a 3D scene and tracks OpenSeadragon keyboard transforms', async ({ page }) => {
  await setup(page, true);
  await page.evaluate(() => {
    window.orientationManifest.items.splice(1, 0, {
      id: 'scene', type: 'Scene', items: [{ type: 'AnnotationPage', items: [{
        type: 'Annotation', motivation: 'painting', body: { id: 'https://example.test/model.glb', type: 'Model', format: 'model/gltf-binary' },
      }] }],
    });
    window.viewer.options.onSelectScene = () => ({ destroy() {} });
    return window.viewer.setManifest(window.orientationManifest);
  });
  const canvas = page.locator('[data-el="osd-container"] [role="group"]');
  await canvas.focus();
  await page.keyboard.press('r');
  await page.keyboard.press('f');
  expect(await page.evaluate(() => window.viewer.osdController.transform)).toEqual({
    rotation: 90, flipHorizontal: false, flipVertical: true,
  });
  await expect(page.locator('[data-action="flip-vertical"]')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.viewer.goToCanvas(1));
  await expect(page.locator('[data-el="scene-container"]')).toBeVisible();
  await page.evaluate(() => window.viewer.goToCanvas(2));
  expect(await page.evaluate(() => window.viewer.osdController.transform)).toEqual({
    rotation: 90, flipHorizontal: false, flipVertical: true,
  });
  expect(await page.evaluate(() => window.viewer.osdController.osd.viewport.getRotation())).toBe(90);
});
