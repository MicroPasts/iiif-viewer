import { describe, expect, it } from 'vitest';
import { extractLangValue, normalizeNavPlace, parseAnnotationItems, parseIIIFManifest } from '../src/parser.js';

describe('IIIF parser', () => {
  it('normalizes a Presentation 2 image service and embedded annotations', () => {
    const parsed = parseIIIFManifest({
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      label: 'Book',
      sequences: [{ canvases: [{
        '@id': 'https://example.test/c1',
        label: 'Page 1',
        images: [{ resource: {
          '@id': 'https://example.test/image.jpg',
          service: { '@id': 'https://example.test/iiif/image/', profile: 'level2' },
        } }],
        otherContent: [{ resources: [{ '@id': 'note', resource: { chars: 'A note' }, on: 'https://example.test/c1#xywh=1,2,3,4' }] }],
      }] }],
    });

    expect(parsed.version).toBe('2.1');
    expect(parsed.canvases[0].image.infoJsonUrl).toBe('https://example.test/iiif/image/info.json');
    expect(parsed.canvases[0].annotations[0]).toMatchObject({ text: 'A note', xywh: [1, 2, 3, 4] });
  });

  it('normalizes Presentation 3 canvases, references and localized values', () => {
    const parsed = parseIIIFManifest({
      type: 'Manifest',
      label: { en: ['Book'], fr: ['Livre'] },
      navPlace: { type: 'FeatureCollection', id: 'https://example.test/places' },
      items: [{
        id: 'canvas-1', type: 'Canvas', label: { fr: ['Premiere'] },
        items: [{ items: [{ motivation: 'painting', body: {
          id: 'image.jpg', type: 'Image', service: [{ id: 'https://example.test/image', type: 'ImageService3' }],
        } }] }],
        annotations: [{ id: 'https://example.test/notes' }],
      }],
    }, 'fr');
    expect(parsed.label).toBe('Livre');
    expect(parsed.navPlaceRefUrl).toBe('https://example.test/places');
    expect(parsed.canvases[0]).toMatchObject({
      label: 'Premiere',
      externalAnnotationUrls: ['https://example.test/notes'],
      image: { infoJsonUrl: 'https://example.test/image/info.json' },
    });
    expect(extractLangValue({ none: ['Unlabelled'] }, 'de')).toBe('Unlabelled');
  });

  it('resolves embedded ranges in item order and localizes every range', () => {
    const parsed = parseIIIFManifest({
      type: 'Manifest',
      items: [{ id: 'canvas-1', type: 'Canvas' }, { id: 'canvas-2', type: 'Canvas' }],
      structures: [{
        id: 'parent', type: 'Range', label: { en: ['Parent'], fr: ['Parent français'] },
        items: [
          {
            id: 'child', type: 'Range', label: { en: ['Child'], fr: ['Enfant'] },
            items: [{ type: 'Range', label: { en: ['Inner'], fr: ['Interieur'] }, items: ['canvas-2#xywh=1,2,3,4'] }],
          },
          'canvas-1',
        ],
      }],
    }, 'fr');
    expect(parsed.structures).toMatchObject([{
      label: 'Parent français', canvasIndex: 1,
      children: [{ label: 'Enfant', canvasIndex: 1, children: [{ label: 'Interieur', canvasIndex: 1 }] }],
    }]);
  });

  it('resolves referenced ranges without looping on cyclic references', () => {
    const parsed = parseIIIFManifest({
      type: 'Manifest',
      items: [{ id: 'canvas-1', type: 'Canvas' }, { id: 'canvas-2', type: 'Canvas' }],
      structures: [
        { id: 'root', type: 'Range', items: ['first', 'canvas-1'] },
        { id: 'first', type: 'Range', items: ['second'] },
        { id: 'second', type: 'Range', items: ['first', 'canvas-2'] },
      ],
    });
    expect(parsed.structures[0]).toMatchObject({
      id: 'root', canvasIndex: 1,
      children: [{ id: 'first', canvasIndex: 1, children: [{ id: 'second', canvasIndex: 1 }] }],
    });
  });

  it('uses the preferred language for Presentation 2 range labels', () => {
    const parsed = parseIIIFManifest({
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      sequences: [{ canvases: [{ '@id': 'canvas-1' }] }],
      structures: [{
        '@id': 'section',
        label: [{ '@language': 'en', '@value': 'Chapter' }, { '@language': 'fr', '@value': 'Chapitre' }],
        canvases: ['canvas-1'],
      }],
    }, 'fr');
    expect(parsed.structures[0]).toMatchObject({ label: 'Chapitre', canvasIndex: 0 });
  });

  it('normalizes 3D scenes and their transformations', () => {
    const parsed = parseIIIFManifest({
      '@context': 'http://iiif.io/api/presentation/4/context.json', type: 'Manifest',
      items: [{ type: 'Scene', items: [{ items: [{
        motivation: 'painting',
        body: { type: 'SpecificResource', source: { id: 'model.glb', type: 'Model' }, transform: [{ type: 'RotateTransform', y: 90 }] },
      }] }] }],
    });
    expect(parsed.version).toBe('4.0');
    expect(parsed.canvases[0].scene).toMatchObject({
      modelUrl: 'model.glb', transforms: [{ type: 'RotateTransform', y: 90 }],
    });
  });

  it('preserves geographic scope and canvas index for embedded GeoJSON', () => {
    const point = { type: 'Point', coordinates: [-0.12, 51.5] };
    const result = normalizeNavPlace(point, { scope: 'canvas', canvasIndex: 2, canvasLabel: 'London' });
    expect(result.featureCollection.features[0]).toMatchObject({
      geometry: point, properties: { _title: 'London', _scope: 'canvas', _canvasIndex: 2 },
    });
    expect(normalizeNavPlace({ type: 'FeatureCollection', features: [] }).featureCollection).toBeNull();
  });

  it('parses annotation selectors and skips annotations without text', () => {
    const notes = parseAnnotationItems([
      { id: 'a', body: { value: 'Detail' }, target: { source: 'canvas', selector: { value: 'xywh=pixel:4,5,6,7' } } },
      { body: { type: 'Image' }, target: 'canvas' },
    ]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ text: 'Detail', xywh: [4, 5, 6, 7] });
  });
});
