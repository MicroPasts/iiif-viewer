import { describe, expect, it } from 'vitest';
import { configurePermalink, parsePermalink, serializePermalink } from '../src/permalink.js';

describe('permalink encoding', () => {
  const base = 'https://viewer.example/page?other=1#notes';
  const state = { manifest: 'https://images.example/manifest?x=1', canvas: 2,
    xywh: [-12.5, 23, 100.5, 200], language: 'fr', rotation: 90, flip: 'hv' };

  it('round-trips state without removing other URL parameters or the hash', () => {
    const url = serializePermalink(base, 'book', state);
    expect(parsePermalink(url, 'book')).toEqual(state);
    expect(new URL(url).searchParams.get('other')).toBe('1');
    expect(new URL(url).hash).toBe('#notes');
    expect(parsePermalink(url, 'other-viewer')).toBeNull();
  });

  it('validates options and malformed or ambiguous state', () => {
    expect(configurePermalink()).toBeNull();
    expect(configurePermalink(true)).toEqual({ prefix: 'iiif' });
    expect(() => configurePermalink({ prefix: 'bad prefix' })).toThrow(TypeError);
    for (const query of [
      'iiif-canvas=0', 'iiif-manifest=javascript:alert(1)',
      'iiif-manifest=https://u:p@example.test/',
      'iiif-manifest=https://example.test/&iiif-canvas=-1',
      'iiif-manifest=https://example.test/&iiif-canvas=1&iiif-canvas=2',
      'iiif-manifest=https://example.test/&iiif-xywh=1,2,0,4',
      'iiif-manifest=https://example.test/&iiif-xywh=1,2,NaN,4',
      'iiif-manifest=https://example.test/&iiif-lang=fr%20en',
      'iiif-manifest=https://example.test/&iiif-rotation=45',
    ]) expect(() => parsePermalink(`${base.split('?')[0]}?${query}`, 'iiif')).toThrow();
  });
});
