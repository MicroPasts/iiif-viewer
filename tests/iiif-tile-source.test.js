import { describe, expect, it } from 'vitest';
import { preserveSecureTileUrls } from '../src/iiif-tile-source.js';

describe('IIIF tile URLs', () => {
  it('keeps tiles on HTTPS when the same service advertises an HTTP identifier', () => {
    const source = {
      base: 'http://example.test/iiif/image',
      getTileUrl(level) { return `${this.base}/${level}/tile.jpg`; },
    };
    preserveSecureTileUrls({ source }, 'https://example.test/iiif/image/info.json');
    expect(source.getTileUrl(4)).toBe('https://example.test/iiif/image/4/tile.jpg');
    source.base = 'http://example.test/iiif/image-other';
    expect(source.getTileUrl(4)).toBe('http://example.test/iiif/image-other/4/tile.jpg');
    source.base = 'http://other.test/iiif/image';
    expect(source.getTileUrl(4)).toBe('http://other.test/iiif/image/4/tile.jpg');
  });

  it('does not rewrite HTTP, proxied, or non-IIIF sources', () => {
    const makeItem = () => ({ source: { getTileUrl: () => 'http://example.test/image/tile.jpg' } });
    for (const infoUrl of ['http://example.test/image/info.json', '/proxy/info.json', 'https://example.test/image.dzi']) {
      const item = makeItem();
      preserveSecureTileUrls(item, infoUrl);
      expect(item.source.getTileUrl()).toBe('http://example.test/image/tile.jpg');
    }
  });
});
