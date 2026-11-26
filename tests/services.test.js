// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UrlResolver } from '../src/url-resolver.js';
import { ManifestSearchController } from '../src/search-controller.js';
import { escapeHtml, sanitizeHtml } from '../src/sanitize.js';

afterEach(() => vi.unstubAllGlobals());

describe('URL resolution', () => {
  it('applies matching typed rules before proxy fallbacks and preserves blob URLs', () => {
    const resolver = new UrlResolver({
      proxyUrl: '/manifest?url=', assetProxyUrl: '/asset?url=',
      proxyRoutes: [{ match: /^https:\/\/example\.test\//, replace: '/local/', types: ['image'] }],
    });
    expect(resolver.resolve('https://example.test/image', 'image')).toBe('/local/image');
    expect(resolver.resolve('https://example.test/manifest', 'manifest')).toBe('/manifest?url=https%3A%2F%2Fexample.test%2Fmanifest');
    expect(resolver.resolve('blob:local', 'image')).toBe('blob:local');
    resolver.setProxyRoutes((url, type) => type === 'model' ? '/model' : null);
    expect(resolver.resolve('https://example.test/model', 'model')).toBe('/model');
    expect(resolver.resolve('https://example.test/image', 'image')).toContain('/asset?url=');
  });
});

describe('manifest search', () => {
  const parsed = {
    label: 'Museum', summary: '', metadata: [],
    canvases: [{ id: 'canvas-1', index: 0, label: 'Page', metadata: [], annotations: [{ id: 'a', text: '<b>Ancient</b> pottery', xywh: [1, 2, 3, 4] }] }],
  };

  it('finds local annotations case-insensitively and preserves their region', async () => {
    const search = new ManifestSearchController();
    expect(await search.search(' ANCIENT ', parsed)).toMatchObject([
      { canvasIndex: 0, text: 'Ancient pottery', xywh: [1, 2, 3, 4], source: 'local' },
    ]);
  });

  it('queries a remote search service and maps hits to canvases', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      items: [{ id: 'hit', body: { value: 'Found' }, target: 'canvas-1#xywh=1,2,3,4' }],
    }) });
    vi.stubGlobal('fetch', fetch);
    const search = new ManifestSearchController();
    search.setManifest({ service: [{ id: 'https://example.test/search/', type: 'SearchService2' }] });
    const hits = await search.search('hello world', parsed);
    expect(fetch.mock.calls[0][0]).toBe('https://example.test/search?q=hello%20world');
    expect(hits[0]).toMatchObject({ id: 'hit', canvasIndex: 0, xywh: [1, 2, 3, 4], source: 'iiif-search' });
  });

  it.each([
    {
      service: { id: '/search', type: 'SearchService2' },
      response: { items: [
        { body: { type: 'Image' }, target: { source: 'canvas-2' } },
        { id: 'hit', body: { value: { en: ['Correct result'] } }, target: { source: { id: 'canvas-1' }, selector: { value: 'xywh=1,2,3,4' } } },
      ] },
    },
    {
      service: { '@id': '/search', '@type': 'sc:SearchService' },
      response: { resources: [
        { resource: { type: 'Image' }, on: 'canvas-2' },
        { '@id': 'hit', resource: { chars: 'Correct result' }, on: { full: 'canvas-1#xywh=1,2,3,4' } },
      ] },
    },
  ])('keeps remote hits paired with their source items: $service', async ({ service, response }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => response }));
    const search = new ManifestSearchController();
    search.setManifest({ service });
    const hits = await search.search('result', {
      ...parsed,
      canvases: [...parsed.canvases, { id: 'canvas-2', index: 1, label: 'Other page' }],
    });
    expect(hits).toMatchObject([{
      id: 'hit', canvasIndex: 0, canvasLabel: 'Page',
      text: 'Correct result', xywh: [1, 2, 3, 4],
    }]);
  });

  it.each([
    { field: 'annotation', manifest: { ...parsed } },
    { field: 'summary', manifest: { ...parsed, summary: '<b>Ancient</b> pottery', canvases: [] } },
    { field: 'manifest metadata value', manifest: { ...parsed, metadata: [{ label: 'Period', value: '<b>Ancient</b> pottery' }], canvases: [] } },
    { field: 'manifest metadata label', manifest: { ...parsed, metadata: [{ label: '<b>Ancient</b> pottery', value: 'Yes' }], canvases: [] } },
    { field: 'canvas metadata value', manifest: { ...parsed, canvases: [{ ...parsed.canvases[0], annotations: [], metadata: [{ label: 'Period', value: '<b>Ancient</b> pottery' }] }] } },
    { field: 'canvas metadata label', manifest: { ...parsed, canvases: [{ ...parsed.canvases[0], annotations: [], metadata: [{ label: '<b>Ancient</b> pottery', value: 'Yes' }] }] } },
  ])('matches visible text in $field', async ({ manifest }) => {
    const search = new ManifestSearchController();
    const hits = await search.search('ancient pottery', manifest);
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toContain('Ancient pottery');
    expect(await search.search('b>', manifest)).toEqual([]);
  });

  it('decodes HTML entities when matching and displaying local search snippets', async () => {
    const search = new ManifestSearchController();
    const hits = await search.search('ART & HISTORY', {
      ...parsed, summary: '<strong>Art &amp;</strong> history', canvases: [],
    });
    expect(hits[0].text).toBe('Art & history');
  });

  it('falls back to local search when the remote service fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const search = new ManifestSearchController();
    search.setManifest({ service: { id: '/search', type: 'SearchService2' } });
    expect((await search.search('ancient', parsed))[0].source).toBe('local');
  });
});

describe('HTML sanitization', () => {
  it('keeps safe formatting and links while removing unsafe elements and attributes', () => {
    const html = sanitizeHtml('<p onclick="evil()">Hello <strong>world</strong><a href="javascript:evil()">bad</a><a href="https://example.test">good</a><img src=x onerror=evil()></p>');
    const root = document.createElement('div');
    root.innerHTML = html;
    expect(root.querySelector('p').hasAttribute('onclick')).toBe(false);
    expect(root.querySelector('strong').textContent).toBe('world');
    expect(root.querySelector('a').hasAttribute('href')).toBe(false);
    expect(root.querySelectorAll('a')[1].getAttribute('rel')).toBe('noopener noreferrer');
    expect(root.querySelector('img')).toBeNull();
    expect(escapeHtml('"<&')).toBe('&quot;&lt;&amp;');
  });
});
