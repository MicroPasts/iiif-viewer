// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { MediaStage } from '../src/media-stage.js';

afterEach(() => vi.restoreAllMocks());

it('routes media and captions, applies the latest pending seek and cleans up', () => {
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const resolve = vi.fn((url, type) => `/proxy/${type}/${url}`);
  const host = document.createElement('div');
  const stage = new MediaStage(host, { label: 'Film', media: {
    type: 'video', url: 'film.mp4', format: 'video/mp4', poster: 'poster.jpg',
    tracks: [{ url: 'captions.vtt', label: 'English', language: 'en' }],
  } }, resolve);
  expect(resolve).toHaveBeenCalledWith('film.mp4', 'media');
  expect(resolve).toHaveBeenCalledWith('captions.vtt', 'annotation');
  expect(resolve).toHaveBeenCalledWith('poster.jpg', 'thumbnail');
  stage.seek({ start: 2, end: 4 });
  stage.seek({ start: 5, end: null });
  stage.player.dispatchEvent(new Event('loadedmetadata'));
  expect(stage.player.currentTime).toBe(5);
  expect(stage.status.textContent).toContain('0:05');
  stage.player.querySelector('source').dispatchEvent(new Event('error'));
  expect(stage.error.textContent).toContain('Unable to load media');
  stage.destroy();
  expect(pause).toHaveBeenCalledOnce();
  expect(load).toHaveBeenCalledOnce();
  expect(host.childNodes).toHaveLength(0);
});

it('keeps themed controls in sync with playback, volume, seeking and errors', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('blocked'));
  const host = document.createElement('div');
  const stage = new MediaStage(host, { label: 'Recording', media: {
    type: 'audio', url: 'audio.mp3', format: 'audio/mpeg', tracks: [],
  } }, (url) => url);
  const button = host.querySelector('[data-media="play"]');
  const seek = host.querySelector('[data-media="seek"]');
  const mute = host.querySelector('[data-media="mute"]');
  const volume = host.querySelector('[data-media="volume"]');
  expect(host.querySelector('[aria-label="Playback controls"]')).not.toBeNull();
  expect(seek.disabled).toBe(true);
  Object.defineProperty(stage.player, 'duration', { configurable: true, value: 10 });
  stage.player.dispatchEvent(new Event('loadedmetadata'));
  expect(seek.disabled).toBe(false);
  seek.value = '3';
  seek.dispatchEvent(new Event('input'));
  expect(stage.player.currentTime).toBe(3);
  stage.player.dispatchEvent(new Event('timeupdate'));
  expect(host.querySelector('[data-media="elapsed"]').textContent).toBe('0:03');
  volume.value = '0.5';
  volume.dispatchEvent(new Event('input'));
  expect(stage.player.volume).toBe(0.5);
  mute.click();
  expect(stage.player.muted).toBe(true);
  mute.click();
  expect(stage.player.muted).toBe(false);
  volume.value = '0';
  volume.dispatchEvent(new Event('input'));
  mute.click();
  expect(stage.player.volume).toBe(1);
  expect(stage.player.muted).toBe(false);
  const speed = host.querySelector('[data-media="speed"]');
  speed.value = '1.5';
  speed.dispatchEvent(new Event('change'));
  expect(stage.player.playbackRate).toBe(1.5);
  button.click();
  await Promise.resolve();
  expect(play).toHaveBeenCalledOnce();
  expect(stage.error.textContent).toContain('Unable to start playback');
  stage.destroy();
});
