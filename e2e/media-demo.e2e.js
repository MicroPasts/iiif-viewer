import { expect, test } from '@playwright/test';

function silentWav() {
  const data = Buffer.alloc(8000 * 3 * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(16000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

test('opens the audio and video demo and navigates to temporal cues', async ({ page }) => {
  await page.route('https://iiif.vam.ac.uk/collections/O24955/manifest.json', (route) => route.abort());
  await page.route('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', (route) =>
    route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' } }));
  await page.route('https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3', (route) => {
    const body = silentWav();
    const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
    const headers = { 'accept-ranges': 'bytes', 'access-control-allow-origin': '*' };
    if (!range) return route.fulfill({ contentType: 'audio/wav', body, headers });
    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
    return route.fulfill({
      status: 206, contentType: 'audio/wav', body: body.subarray(start, end + 1),
      headers: { ...headers, 'content-range': `bytes ${start}-${end}/${body.length}` },
    });

  });
  await page.goto('/');
  const viewer = page.locator('#example-media');
  await expect(viewer.locator('[data-el="viewer-root"]')).toHaveCount(0);
  await page.getByText('Play audio and video', { exact: true }).click();
  await expect(viewer.locator('[data-el="manifest-title"]')).toHaveText('Audio and video demo');
  const video = viewer.locator('video');
  await expect(video).toBeVisible();
  await expect(viewer.getByRole('group', { name: 'Playback controls' })).toBeVisible();
  await expect(video.locator('track')).toHaveAttribute('src', 'https://micropasts.github.io/iiif-viewer/examples/media-captions.vtt');

  await viewer.getByRole('tab', { name: 'Index' }).click();
  await viewer.getByRole('button', { name: /Roar: 1 to 2 seconds/ }).click();
  const audio = viewer.locator('audio');
  await expect(audio).toHaveCount(1);
  await expect(viewer.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeCloseTo(1, 1);
  expect(await audio.evaluate((element) => element.paused)).toBe(true);
  await expect(viewer.getByRole('button', { name: /Roar: 1 to 2 seconds/ })).toHaveAttribute('aria-current', 'true');
  await viewer.getByRole('tab', { name: 'Notes (1)' }).click();
  await expect(viewer.getByText('Listen to the second half of the roar.')).toBeVisible();
  await viewer.getByRole('button', { name: 'Go to 0:01–0:02' }).click();
  await expect(viewer.getByRole('button', { name: 'Go to 0:01–0:02' })).toHaveAttribute('aria-current', 'true');
  await viewer.evaluate((host) => host.style.setProperty('--iiif-accent', '#b45309'));
  await expect(viewer.getByRole('button', { name: 'Play', exact: true })).toHaveCSS('color', 'rgb(180, 83, 9)');
  await page.locator('#demo-theme').dispatchEvent('click');
  await expect(viewer.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Play', exact: true })).toHaveCSS('color', 'rgb(180, 83, 9)');
});

test('keeps the compact controls and options usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.route('https://iiif.vam.ac.uk/collections/O24955/manifest.json', (route) => route.abort());
  await page.route('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', (route) =>
    route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('/');
  await page.getByText('Play audio and video', { exact: true }).click();
  const viewer = page.locator('#example-media');
  await viewer.getByRole('button', { name: 'Close Info Panel' }).click();
  const controls = viewer.getByRole('group', { name: 'Playback controls' });
  await expect(controls).toBeVisible();
  const dimensions = await controls.evaluate((element) => ({
    width: element.clientWidth, scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  await viewer.getByLabel('Playback options').click();
  await expect(viewer.getByRole('slider', { name: 'Volume' })).toBeVisible();
  const captions = viewer.getByLabel('Captions');
  await expect(captions).toBeVisible();
  await captions.selectOption('0');
  const panel = viewer.locator('.iiif-media-options-panel');
  const assertContained = async () => {
    const bounds = await panel.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const select = element.querySelector('[aria-label="Captions"]').getBoundingClientRect();
      const label = element.querySelector('[aria-label="Captions"]').parentElement.getBoundingClientRect();
      const bar = element.closest('.iiif-media-controls').getBoundingClientRect();
      return { panel: { left: box.left, right: box.right }, label: { left: label.left, right: label.right },
        select: { left: select.left, right: select.right }, bar: { left: bar.left, right: bar.right } };
    });
    expect(bounds.panel.left).toBeGreaterThanOrEqual(bounds.bar.left - 1);
    expect(bounds.panel.right).toBeLessThanOrEqual(bounds.bar.right + 1);
    expect(bounds.label.left).toBeGreaterThanOrEqual(bounds.panel.left);
    expect(bounds.label.right).toBeLessThanOrEqual(bounds.panel.right);
    expect(bounds.select.left).toBeGreaterThanOrEqual(bounds.panel.left);
    expect(bounds.select.right).toBeLessThanOrEqual(bounds.panel.right);
  };
  await assertContained();
  await captions.evaluate((element) => {
    element.options[1].textContent = 'A very long caption track language and description';
  });
  await assertContained();
  await controls.evaluate((element) => { element.style.width = '180px'; });
  await assertContained();
  await captions.selectOption('');
  await captions.selectOption('0');
  await expect(captions).toHaveValue('0');
});
