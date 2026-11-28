import { expect, test } from '@playwright/test';

function silentWav(seconds = 8) {
  const rate = 8000;
  const data = Buffer.alloc(rate * seconds * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

test('plays and seeks temporal media canvases and cleans up on navigation', async ({ page }) => {
  await page.route('**/proxied/sound.wav', (route) => {
    const body = silentWav();
    const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
    if (!range) return route.fulfill({ contentType: 'audio/wav', body, headers: { 'accept-ranges': 'bytes' } });
    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
    return route.fulfill({ status: 206, contentType: 'audio/wav', body: body.subarray(start, end + 1),
      headers: { 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${body.length}` } });
  });
  await page.route('**/proxied/captions.vtt', (route) => route.fulfill({
    contentType: 'text/vtt', body: 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello\n',
  }));
  await page.goto('/e2e/fixture.html?sideBySide');
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    context.fillStyle = 'red';
    context.fillRect(0, 0, 32, 32);
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const done = new Promise((resolve) => { recorder.onstop = resolve; });
    recorder.start();
    for (let frame = 0; frame < 10; frame++) {
      context.fillStyle = frame % 2 ? 'red' : 'blue';
      context.fillRect(0, 0, 32, 32);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    recorder.stop();
    await done;
    stream.getTracks().forEach((track) => track.stop());
    window.recordedVideoUrl = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
    window.viewer.setProxyRoutes({ 'https://media.example/': '/proxied/' });
    await window.viewer.setManifest({
      type: 'Manifest', id: 'm', label: { en: ['Media'] },
      items: [{
        type: 'Canvas', id: 'image', items: [{ items: [{ motivation: 'painting',
          body: { type: 'Image', id: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' } }] }],
      }, {
        type: 'Canvas', id: 'audio', label: { en: ['Audio'] }, duration: 8,
        items: [{ items: [{ motivation: 'painting', body: { type: 'Audio', id: 'https://media.example/sound.wav', format: 'audio/wav' } }] }],
        annotations: [{ items: [
          { motivation: 'supplementing', body: { type: 'Text', id: 'https://media.example/captions.vtt', format: 'text/vtt', language: 'en' } },
          { motivation: 'commenting', target: 'audio#t=3,5', body: { type: 'TextualBody', value: 'Temporal note' } },
        ] }],
      }, {
        type: 'Canvas', id: 'video', label: { en: ['Video'] }, duration: 8,
        items: [{ items: [{ motivation: 'painting', body: { type: 'Video', id: window.recordedVideoUrl, format: 'video/webm' } }] }],
      }],
      structures: [{ id: 'range', type: 'Range', label: { en: ['Audio section'] }, items: ['audio#t=2,6'] }],
    });
  });
  await page.getByRole('tab', { name: 'Index' }).click();
  await page.getByRole('button', { name: /Audio section/ }).click();
  const audio = page.locator('#viewer audio');
  await expect(audio).toHaveCount(1);
  await expect(page.getByRole('group', { name: 'Playback controls' })).toBeVisible();
  await expect.poll(() => audio.evaluate((element) => element.readyState)).toBeGreaterThanOrEqual(1);
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeCloseTo(2, 1);
  await expect(page.locator('[data-el="zoom-controls"]')).toBeHidden();
  await expect(page.locator('[data-el="media-container"] [role="status"]')).toContainText('0:02–0:06');
  await expect(page.getByRole('button', { name: /Audio section/ })).toHaveAttribute('aria-current', 'true');
  await expect(audio.locator('track')).toHaveAttribute('src', '/proxied/captions.vtt');
  await page.getByLabel('Playback options').click();
  await page.getByLabel('Captions').selectOption('0');
  await expect.poll(() => audio.evaluate((element) => element.textTracks[0].cues?.length)).toBe(1);
  await page.getByLabel('Captions').selectOption('');
  await expect.poll(() => audio.evaluate((element) => element.textTracks[0].mode)).toBe('disabled');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => audio.evaluate((element) => element.paused)).toBe(false);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect.poll(() => audio.evaluate((element) => element.paused)).toBe(true);
  const seek = page.getByRole('slider', { name: 'Seek' });
  await seek.focus();
  const beforeSeek = await audio.evaluate((element) => element.currentTime);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(beforeSeek);
  await page.getByRole('button', { name: 'Mute', exact: true }).click();
  await expect.poll(() => audio.evaluate((element) => element.muted)).toBe(true);
  await page.getByRole('button', { name: 'Unmute', exact: true }).click();
  await page.getByLabel('Playback speed').selectOption('1.5');
  await expect.poll(() => audio.evaluate((element) => element.playbackRate)).toBe(1.5);
  await page.getByLabel('Playback speed').focus();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Playback speed')).toBeHidden();
  await expect(page.getByLabel('Playback options')).toBeFocused();
  await page.getByRole('tab', { name: 'Notes (1)' }).click();
  await page.getByRole('button', { name: 'Go to 0:03–0:05' }).click();
  await expect(page.getByRole('button', { name: 'Go to 0:03–0:05' })).toHaveAttribute('aria-current', 'true');
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThanOrEqual(3);
  await page.evaluate(() => { window.previousAudio = window.viewer.activeMedia.player; });
  await page.locator('[data-el="filmstrip"] [data-canvas-index="2"]').click();
  const video = page.locator('#viewer video');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((element) => element.videoWidth)).toBe(32);
  await video.evaluate((element) => element.play());
  await expect.poll(() => video.evaluate((element) => element.currentTime)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.previousAudio.paused && !window.previousAudio.isConnected && !window.previousAudio.querySelector('source'))).toBe(true);
  await page.locator('[data-action="toggle-compare"]').click();
  await expect(page.getByRole('button', { name: 'Sync View' })).toBeDisabled();
  await page.getByRole('button', { name: 'Comparison settings' }).click();
  await page.getByRole('combobox', { name: 'Secondary canvas' }).selectOption('1');
  await expect(page.locator('[data-compare="media"] [aria-label="Playback controls"]')).toBeVisible();
  await page.locator('[data-compare="media"] [data-media="play"]').focus();
  await expect.poll(() => page.evaluate(() => window.viewer.comparison.activePane)).toBe('secondary');
  await page.locator('[data-el="media-container"] [data-media="play"]').focus();
  await expect.poll(() => page.evaluate(() => window.viewer.comparison.activePane)).toBe('primary');
  await page.getByRole('button', { name: 'Close Split' }).click();
  await expect(page.locator('[data-compare="media"] audio')).toHaveCount(0);
  await page.evaluate(() => { window.viewer.destroy(); URL.revokeObjectURL(window.recordedVideoUrl); });
  await expect(page.locator('#viewer video')).toHaveCount(0);
});

test('reports media load failures in the viewer', async ({ page }) => {
  await page.route('**/missing-media.mp4', (route) => route.fulfill({ status: 404 }));
  await page.goto('/e2e/fixture.html');
  await page.evaluate(() => window.viewer.setManifest({
    type: 'Manifest', items: [{ type: 'Canvas', id: 'broken',
      items: [{ items: [{ motivation: 'painting', body: { type: 'Video', id: '/missing-media.mp4', format: 'video/mp4' } }] }] }],
  }));
  await expect(page.locator('[data-el="media-container"] [role="alert"]')).toContainText('Unable to load media');
});
