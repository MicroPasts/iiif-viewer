import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/fixture.html');
  await page.evaluate(() => {
    const Viewer = window.viewer.constructor;
    window.viewer.destroy();
    const image = (color, width = 100) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = width;
      canvas.getContext('2d').fillStyle = color;
      canvas.getContext('2d').fillRect(0, 0, width, width);
      return canvas.toDataURL();
    };
    const red = image('red');
    const blue = image('blue');
    const green = image('green');
    window.viewer = new Viewer('#viewer', {
      showSidebar: false,
      physicalRuler: true,
      layersCurtain: true,
      manifest: {
        type: 'Manifest', label: { en: ['Inspection'] },
        items: [
          {
            id: 'one', type: 'Canvas', width: 100, height: 100,
            physicalDimensions: { profile: 'http://iiif.io/api/annex/extensions/physdim', physicalScale: 0.1, physicalUnits: 'mm' },
            items: [{ items: [{ motivation: 'painting', target: 'one', body: { type: 'Choice', items: [
              { type: 'Image', id: red, label: { en: ['Red'] } },
              { type: 'Image', id: blue, label: { en: ['Blue'] } },
            ] } }] }],
          },
          {
            id: 'two', type: 'Canvas', width: 100, height: 100, label: { en: ['Green canvas'] },
            items: [{ items: [{ motivation: 'painting', target: 'two', body: { type: 'Image', id: green } }] }],
          },
          {
            id: 'three', type: 'Canvas', width: 80, height: 80, label: { en: ['Wrong size'] },
            items: [{ items: [{ motivation: 'painting', target: 'three', body: { type: 'Image', id: image('black', 80) } }] }],
          },
        ],
      },
    });
  });
  await expect.poll(() => page.evaluate(() => window.viewer.osdController.osd.world.getItemCount())).toBe(2);
});

test('compares same-canvas layers and matching canvases, clips and resets on navigation', async ({ page }) => {
  await page.locator('[data-inspect="curtain"]').click();
  await expect(page.locator('[data-inspect="compare"] option')).toHaveCount(2);
  await expect(page.locator('[data-inspect="layers"]')).toContainText('Blue');
  await page.locator('[data-layer-visibility="0"]').click();
  await page.locator('[data-layer-clip="0"]').fill('40');
  await expect.poll(() => page.evaluate(() => {
    const clip = window.viewer.osdController.osd.world.getItemAt(1).getClip();
    return [clip.width, clip.height];
  })).toEqual([40, 100]);
  const sampleColors = () => page.evaluate(() => {
    const viewer = window.viewer.osdController.osd;
    const item = viewer.world.getItemAt(0);
    const canvas = viewer.drawer.canvas;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const sample = (x) => {
      const point = item.getContentSize().times(0);
      point.x = x;
      point.y = 50;
      const position = item.imageToViewerElementCoordinates(point);
      return [...context.getImageData(
        Math.round(position.x * canvas.width / canvas.clientWidth),
        Math.round(position.y * canvas.height / canvas.clientHeight), 1, 1).data].slice(0, 3);
    };
    return [sample(25), sample(75)];
  });
  await expect.poll(sampleColors).toEqual([[0, 0, 255], [255, 0, 0]]);
  await page.locator('[data-layer-clip="0"]').fill('0');
  await expect.poll(sampleColors).toEqual([[255, 0, 0], [255, 0, 0]]);
  await page.locator('[data-layer-clip="0"]').fill('100');
  await expect.poll(sampleColors).toEqual([[0, 0, 255], [0, 0, 255]]);
  await page.locator('[data-layer-clip="0"]').fill('40');
  await page.locator('[data-inspect="orientation"]').selectOption('horizontal');
  await expect.poll(() => page.evaluate(() => {
    const clip = window.viewer.osdController.osd.world.getItemAt(1).getClip();
    return [clip.width, clip.height];
  })).toEqual([100, 40]);
  await page.locator('[data-inspect="compare"]').selectOption('1');
  await expect.poll(() => page.evaluate(() => window.viewer.osdController.osd.world.getItemCount())).toBe(3);
  await expect(page.locator('[data-inspect="layers"]')).toContainText('Green canvas');
  await page.locator('[data-layer-visibility="1"]').click();
  expect(await page.evaluate(() => window.viewer.osdController.osd.world.getItemAt(2).getOpacity())).toBe(1);
  await page.locator('[data-layer-visibility="1"]').click();
  expect(await page.evaluate(() => window.viewer.osdController.osd.world.getItemAt(2).getOpacity())).toBe(0);
  await page.locator('[data-action="next-canvas"]').click();
  await expect.poll(() => page.evaluate(() => window.viewer.osdController.osd.world.getItemCount())).toBe(1);
  await expect(page.locator('[data-inspect="compare"]')).toHaveValue('');
});

test('uses metadata, direct calibration and a drawn calibration line', async ({ page }) => {
  await page.locator('[data-inspect="ruler"]').click();
  await expect(page.locator('[data-inspect="scale-status"]')).toContainText('0.1 mm per image pixel');
  const ruler = page.locator('[data-inspect="ruler-display"]');
  await expect(ruler).toBeVisible();
  const assertRulerIsAccurate = async () => {
    const result = await page.evaluate(() => {
      const item = window.viewer.osdController.osd.world.getItemAt(0);
      const zero = item.getContentSize().times(0);
      const one = item.getContentSize().times(0);
      one.x = 1;
      const a = item.imageToViewerElementCoordinates(zero);
      const b = item.imageToViewerElementCoordinates(one);
      const display = document.querySelector('[data-inspect="ruler-display"]');
      return {
        screenPixelsPerImagePixel: Math.hypot(b.x - a.x, b.y - a.y),
        width: parseFloat(display.style.width),
        millimeters: parseFloat(display.textContent),
        scale: window.viewer.inspectionTools.millimetersPerPixel,
      };
    });
    expect(result.width, JSON.stringify(result)).toBeGreaterThan(0);
    expect(result.screenPixelsPerImagePixel, JSON.stringify(result)).toBeGreaterThan(0);
    expect(result.width * result.scale / result.screenPixelsPerImagePixel).toBeCloseTo(result.millimeters, 3);
  };
  await assertRulerIsAccurate();
  await page.locator('[data-inspect="curtain"]').click();
  await expect(ruler).toBeVisible();
  await page.locator('[data-inspect="ruler"]').click();
  await page.locator('[data-action="zoom-in"]').click();
  await expect.poll(() => page.evaluate(() => {
    const viewport = window.viewer.osdController.osd.viewport;
    return Math.abs(viewport.getZoom() - viewport.getZoom(true));
  })).toBeLessThan(0.00001);
  await assertRulerIsAccurate();
  await page.locator('[data-inspect="scale"]').fill('0.5');
  await page.locator('[data-inspect="apply-scale"]').click();
  await expect(page.locator('[data-inspect="scale-status"]')).toContainText('0.5 mm');
  await assertRulerIsAccurate();
  await page.locator('[data-inspect="draw"]').click();
  const box = await page.locator('[data-inspect="drawing"]').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2);
  await page.mouse.up();
  await expect(page.locator('[data-inspect="scale-status"]')).toContainText('image pixels');
  const linePixels = await page.evaluate(() => window.viewer.inspectionTools.linePixels);
  const expectedPixels = await page.evaluate(() => {
    const item = window.viewer.osdController.osd.world.getItemAt(0);
    const a = item.getContentSize().times(0);
    const b = item.getContentSize().times(0);
    b.x = 1;
    const first = item.imageToViewerElementCoordinates(a);
    const second = item.imageToViewerElementCoordinates(b);
    return 50 / Math.hypot(second.x - first.x, second.y - first.y);
  });
  expect(linePixels).toBeCloseTo(expectedPixels, 2);
  await page.locator('[data-inspect="line-length"]').fill('20');
  await page.locator('[data-inspect="apply-line"]').click();
  expect(await page.evaluate(() => window.viewer.inspectionTools.millimetersPerPixel)).toBeCloseTo(20 / linePixels);
  await assertRulerIsAccurate();
  await page.locator('[data-inspect="reset-scale"]').click();
  await expect(page.locator('[data-inspect="scale-status"]')).toContainText('0.1 mm per image pixel');
});
