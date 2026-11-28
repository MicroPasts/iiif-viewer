import { describe, expect, it } from 'vitest';
import { parseTemporalFragment } from '../src/temporal.js';
import { parseIIIFManifest } from '../src/parser.js';
import mediaDemo from '../public/examples/media-manifest.json';

describe('temporal media fragments', () => {
  it.each([
    ['#t=12', { start: 12, end: null }],
    ['https://example.test/c#xywh=1,2,3,4&t=12.5,45', { start: 12.5, end: 45 }],
    ['#t=01:02:03,01:05:00', { start: 3723, end: 3900 }],
    ['t=npt:0,1.25', { start: 0, end: 1.25 }],
  ])('parses %s', (value, result) => expect(parseTemporalFragment(value)).toEqual(result));

  it.each(['', '#t=', '#t=-1', '#t=1,', '#t=1,no', '#t=2,1', '#t=1,1', '#t=1,2,3',
    '#t=01:99:00', '#t=Infinity', '#t=1&t=2', '#xywh=1,2,3,4'])('rejects %s', (value) => {
    expect(parseTemporalFragment(value)).toBeNull();
  });
});

it('normalizes audio, video, captions and temporal annotation and range targets', () => {
  const parsed = parseIIIFManifest({
    type: 'Manifest',
    items: [{
      type: 'Canvas', id: 'c1', duration: 90, thumbnail: [{ id: 'poster.jpg' }],
      items: [{ items: [{ motivation: 'painting', body: { type: 'Choice', items: [
        { type: 'SpecificResource', source: { type: 'Video', id: 'movie.mp4', format: 'video/mp4' } },
      ] } }] }],
      annotations: [{ items: [
        { motivation: 'supplementing', body: { type: 'Text', id: 'captions.vtt', format: 'text/vtt', language: 'en' } },
        { motivation: 'commenting', body: { type: 'TextualBody', value: 'A note' },
          target: { source: { id: 'c1' }, selector: { type: 'FragmentSelector', value: 't=12.5,45' } } },
      ] }],
    }, {
      type: 'Canvas', id: 'c2', items: [{ items: [{ motivation: 'painting',
        body: { id: 'audio.ogg', format: 'audio/ogg', duration: 20 } }] }],
    }],
    structures: [{ id: 'r1', type: 'Range', label: { en: ['Section'] },
      items: [{ type: 'SpecificResource', source: 'c1', selector: { type: 'FragmentSelector', value: 't=5,10' } }] }],
  });

  expect(parsed.canvases[0]).toMatchObject({
    kind: 'media', image: { thumbnail: 'poster.jpg' },
    media: { type: 'video', url: 'movie.mp4', duration: 90, format: 'video/mp4', poster: 'poster.jpg',
      tracks: [{ url: 'captions.vtt', language: 'en' }] },
    annotations: [{ text: 'A note', target: 'c1', temporal: { start: 12.5, end: 45 } }],
  });
  expect(parsed.canvases[1].media).toMatchObject({ type: 'audio', url: 'audio.ogg', duration: 20 });
  expect(parsed.structures[0]).toMatchObject({ canvasIndex: 0, temporal: { start: 5, end: 10 } });
});

it('uses GitHub Pages IDs for the demo manifest and resolves its temporal targets', () => {
  const parsed = parseIIIFManifest(mediaDemo);
  expect(mediaDemo.id).toBe('https://micropasts.github.io/iiif-viewer/examples/media-manifest.json');
  expect(parsed.canvases.map((canvas) => canvas.media.type)).toEqual(['video', 'audio']);
  expect(parsed.canvases[0].media.tracks[0].url).toBe('https://micropasts.github.io/iiif-viewer/examples/media-captions.vtt');
  expect(parsed.canvases.map((canvas) => canvas.annotations.find((annotation) => annotation.temporal).temporal.start)).toEqual([2, 1]);
  expect(parsed.structures.map((range) => [range.canvasIndex, range.temporal.start])).toEqual([[0, 2], [1, 1]]);
});
