import { describe, expect, it } from 'vitest';
import { configureImageDownload, downloadSizes, imageRequestUrl } from '../src/image-download.js';

describe('image download sizing', () => {
  const image = { serviceUrl: 'https://example.test/image', serviceDetails: { type: 'ImageService3' } };
  it('is optional and validates configuration', () => {
    expect(configureImageDownload()).toBeNull();
    expect(configureImageDownload(false)).toBeNull();
    expect(configureImageDownload({ widths: [300, 300, 600], maxPixels: 1000000 }))
      .toEqual({ widths: [300, 600], maxPixels: 1000000, maxWidth: null, maxHeight: null, excludeSizes: [], allowOriginal: true });
    for (const option of [{ widths: [0] }, { maxPixels: Infinity }, { maxWidth: 0 }, { maxHeight: 1.5 },
      { excludeSizes: [{ width: 10, height: 0 }] }, { allowOriginal: 'no' }]) {
      expect(() => configureImageDownload(option)).toThrow(TypeError);
    }
  });

  it('lists info and manifest sizes, presets and full resolution with reasons for restrictions', () => {
    const info = {
      width: 4000, height: 2000, profile: 'level2', maxWidth: 1500, maxHeight: 700,
      maxArea: 600000, sizes: [{ width: 200, height: 100 }, { width: 1600, height: 800 }],
      manifestService: { maxWidth: 1200, sizes: [{ width: 300, height: 150 }, { width: 200, height: 100 }] },
    };
    const sizes = downloadSizes(info, configureImageDownload({
      widths: [200, 500, 1000, 1200], maxPixels: 450000, maxWidth: 1300,
      excludeSizes: [{ width: 300, height: 150 }],
    }));
    expect(sizes).toEqual([
      { width: 200, height: 100, advertised: true, full: false, reason: '' },
      { width: 300, height: 150, advertised: true, full: false, reason: 'disallowed by configuration' },
      { width: 500, height: 250, advertised: false, full: false, reason: '' },
      { width: 1000, height: 500, advertised: false, full: false, reason: 'exceeds export pixel limit' },
      { width: 1200, height: 600, advertised: false, full: false, reason: 'exceeds image service limits' },
      { width: 1600, height: 800, advertised: true, full: false, reason: 'disallowed by configuration' },
      { width: 4000, height: 2000, advertised: false, full: true, reason: 'disallowed by configuration' },
    ]);
    expect(imageRequestUrl(image, info, sizes[0])).toBe('https://example.test/image/full/200,100/0/default.jpg');
    expect(imageRequestUrl(image, info, sizes[2])).toBe('https://example.test/image/full/500,/0/default.jpg');
    expect(() => imageRequestUrl(image, info, { width: 1250, height: 625 })).toThrow(/does not advertise/);
  });

  it('supports manifest-advertised level-0 sizes and a full-size request', () => {
    const info = { width: 1000, height: 500, profile: 'level0', sizes: [{ width: 200, height: 100 }],
      manifestService: { sizes: [{ width: 300, height: 150 }] } };
    const sizes = downloadSizes(info, configureImageDownload({ widths: [500], maxPixels: 1000000 }));
    expect(sizes.map(({ width }) => width)).toEqual([200, 300, 1000]);
    expect(imageRequestUrl(image, info, sizes[1])).toBe('https://example.test/image/full/300,150/0/default.jpg');
    expect(imageRequestUrl(image, info, sizes[2])).toBe('https://example.test/image/full/max/0/default.jpg');
    expect(imageRequestUrl({ serviceUrl: image.serviceUrl }, info, sizes[2])).toBe('https://example.test/image/full/full/0/default.jpg');
    expect(() => imageRequestUrl(image, info, { width: 500, height: 250 })).toThrow(/does not advertise/);
    expect(downloadSizes(info, configureImageDownload({ allowOriginal: false })).map(({ width }) => width)).toEqual([200, 300]);
  });

  it('rejects invalid metadata and incompatible overlay sizes', () => {
    expect(() => downloadSizes({}, configureImageDownload(true))).toThrow(/dimensions/);
    expect(() => imageRequestUrl(image, { width: 100, height: 100, maxWidth: 40, profile: 'level2' },
      { width: 50, height: 50 })).toThrow(/does not advertise/);
  });
});
