export function extractLangValue(val, preferredLang = 'en') {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);

  if (Array.isArray(val)) {
    const langMatch = val.find((v) => v && typeof v === 'object' && v['@language'] === preferredLang);
    if (langMatch) return extractLangValue(langMatch['@value'], preferredLang);
    return val.map((v) => extractLangValue(v, preferredLang)).filter(Boolean).join('; ');
  }

  if (typeof val === 'object') {
    if (val['@value']) return String(val['@value']);
    const keys = Object.keys(val);
    if (keys.length === 0) return '';
    const langKey = keys.includes(preferredLang)
      ? preferredLang
      : keys.includes('none')
        ? 'none'
        : keys[0];
    const entries = val[langKey];
    return Array.isArray(entries) ? entries.join('; ') : String(entries);
  }

  return String(val);
}

function extractItemThumbnail(item) {
  const thumbs = Array.isArray(item.thumbnail)
    ? item.thumbnail
    : item.thumbnail
      ? [item.thumbnail]
      : [];
  const first = thumbs[0];
  if (!first) return null;
  return typeof first === 'string' ? first : first.id || first['@id'] || null;
}

function normalizeImageSource(canvas, isV3) {
  let serviceUrl = null;
  let staticUrl = null;
  let width = canvas.width || null;
  let height = canvas.height || null;

  if (isV3) {
    const annoPages = canvas.items || [];
    for (const page of annoPages) {
      const painting = (page.items || []).find(
        (a) => a.motivation === 'painting' || (Array.isArray(a.motivation) && a.motivation.includes('painting'))
      );
      if (painting && painting.body) {
        const rawBody = Array.isArray(painting.body) ? painting.body[0] : painting.body;
        const body = rawBody.type === 'SpecificResource' && rawBody.source ? rawBody.source : rawBody;

        staticUrl = body.id || null;
        width = width || body.width || null;
        height = height || body.height || null;

        const services = Array.isArray(body.service) ? body.service : body.service ? [body.service] : [];
        const imgService = services.find(
          (s) =>
            String(s.type || s['@type'] || '').includes('ImageService') ||
            String(s.profile || '').includes('iiif.io/api/image')
        );
        if (imgService) {
          serviceUrl = (imgService.id || imgService['@id'] || '').replace(/\/$/, '');
        }
        break;
      }
    }
  } else {
    const images = canvas.images || [];
    const painting = images[0];
    if (painting && painting.resource) {
      const res = painting.resource;
      staticUrl = res['@id'] || res.id || null;
      width = width || res.width || null;
      height = height || res.height || null;

      const services = Array.isArray(res.service) ? res.service : res.service ? [res.service] : [];
      const imgService = services[0];
      if (imgService) {
        serviceUrl = (imgService['@id'] || imgService.id || '').replace(/\/$/, '');
      }
    }
  }

  const explicitThumb = extractItemThumbnail(canvas);
  const thumbnail =
    explicitThumb ||
    (serviceUrl ? `${serviceUrl}/full/!200,200/0/default.jpg` : staticUrl);

  return {
    serviceUrl,
    infoJsonUrl: serviceUrl ? `${serviceUrl}/info.json` : null,
    staticUrl,
    thumbnail,
    width,
    height,
  };
}

function normalizeSceneSource(scene) {
  let modelUrl = null;
  let format = 'model/gltf-binary';
  let transforms = [];

  for (const page of scene.items || []) {
    const annos = page.items || [];
    for (const anno of annos) {
      const isPainting =
        anno.motivation === 'painting' ||
        (Array.isArray(anno.motivation) && anno.motivation.includes('painting'));
      if (!isPainting || !anno.body) continue;

      const bodies = Array.isArray(anno.body) ? anno.body : [anno.body];
      for (const rawBody of bodies) {
        if (rawBody.type === 'SpecificResource' && rawBody.source) {
          const src = Array.isArray(rawBody.source) ? rawBody.source[0] : rawBody.source;
          if (src?.type === 'Model' || /\.(glb|gltf)(\?|$)/i.test(src?.id || '')) {
            modelUrl = src.id || null;
            format = src.format || format;
            transforms = Array.isArray(rawBody.transform) ? rawBody.transform : [];
            break;
          }
        } else if (rawBody.type === 'Model' || /\.(glb|gltf)(\?|$)/i.test(rawBody.id || '')) {
          modelUrl = rawBody.id || null;
          format = rawBody.format || format;
          transforms = Array.isArray(rawBody.transform) ? rawBody.transform : [];
          break;
        }
      }
      if (modelUrl) break;
    }
    if (modelUrl) break;
  }

  return {
    modelUrl,
    format,
    transforms,
    thumbnail: extractItemThumbnail(scene),
  };
}

function extractAnnotations(canvas, isV3) {
  const results = [];

  if (isV3) {
    const annoPages = [...(canvas.annotations || [])];
    annoPages.forEach((page) => {
      (page.items || []).forEach((anno) => {
        const bodies = Array.isArray(anno.body) ? anno.body : anno.body ? [anno.body] : [];
        const text = bodies
          .map((b) => (typeof b === 'string' ? b : extractLangValue(b.value || b.label || '')))
          .filter(Boolean)
          .join(' ');
        if (text) {
          const targetStr = typeof anno.target === 'string' ? anno.target : anno.target?.id || '';
          const xywhMatch = targetStr.match(/#xywh=([0-9,.-]+)/);
          results.push({
            id: anno.id || '',
            motivation: Array.isArray(anno.motivation) ? anno.motivation.join(', ') : anno.motivation || 'commenting',
            text,
            target: targetStr,
            xywh: xywhMatch ? xywhMatch[1].split(',').map(Number) : null,
          });
        }
      });
    });
  } else {
    (canvas.otherContent || []).forEach((list) => {
      (list.resources || []).forEach((res) => {
        const chars = res.resource?.chars || '';
        if (chars) {
          results.push({
            id: res['@id'] || '',
            motivation: res.motivation || 'sc:painting',
            text: chars,
            target: res.on || '',
            xywh: null,
          });
        }
      });
    });
  }

  return results;
}

export function parseIIIFManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Invalid IIIF Manifest JSON.');
  }

  const contextStr = JSON.stringify(manifest['@context'] || '');
  const isV4 = contextStr.includes('/presentation/4/');
  const isV3 =
    isV4 ||
    contextStr.includes('/presentation/3/') ||
    manifest.type === 'Manifest' ||
    Array.isArray(manifest.items);

  const id = manifest.id || manifest['@id'] || '';
  const label = extractLangValue(manifest.label) || 'Untitled IIIF Manifest';
  const summary = extractLangValue(manifest.summary || manifest.description || '');
  const attribution = extractLangValue(
    manifest.requiredStatement?.value || manifest.attribution || ''
  );
  const rights =
    typeof manifest.rights === 'string'
      ? manifest.rights
      : typeof manifest.license === 'string'
        ? manifest.license
        : extractLangValue(manifest.license || '');

  const metadata = (manifest.metadata || []).map((entry) => ({
    label: extractLangValue(entry.label),
    value: extractLangValue(entry.value),
  }));

  const seeAlso = (Array.isArray(manifest.seeAlso) ? manifest.seeAlso : manifest.seeAlso ? [manifest.seeAlso] : [])
    .map((item) => ({
      id: item.id || item['@id'] || '',
      label: extractLangValue(item.label) || item.format || 'Related Resource',
      format: item.format || '',
    }))
    .filter((s) => s.id);

  const homepage = (Array.isArray(manifest.homepage) ? manifest.homepage : manifest.homepage ? [manifest.homepage] : [])
    .map((item) => ({
      id: item.id || item['@id'] || '',
      label: extractLangValue(item.label) || 'Record Homepage',
    }))
    .filter((h) => h.id);

  const rawItems = isV3
    ? manifest.items || []
    : manifest.sequences?.[0]?.canvases || [];

  const canvases = rawItems.map((c, index) => {
    const itemId = c.id || c['@id'] || `canvas-${index}`;
    const isScene = c.type === 'Scene';

    if (isScene) {
      const scene = normalizeSceneSource(c);
      return {
        index,
        kind: 'scene',
        id: itemId,
        label: extractLangValue(c.label) || `3D Scene ${index + 1}`,
        image: {
          serviceUrl: null,
          infoJsonUrl: null,
          staticUrl: null,
          thumbnail: scene.thumbnail,
          width: null,
          height: null,
        },
        scene,
        annotations: extractAnnotations(c, isV3),
        metadata: (c.metadata || []).map((m) => ({
          label: extractLangValue(m.label),
          value: extractLangValue(m.value),
        })),
      };
    }

    const image = normalizeImageSource(c, isV3);
    return {
      index,
      kind: 'canvas',
      id: itemId,
      label: extractLangValue(c.label) || `Canvas ${index + 1}`,
      image,
      scene: null,
      annotations: extractAnnotations(c, isV3),
      metadata: (c.metadata || []).map((m) => ({
        label: extractLangValue(m.label),
        value: extractLangValue(m.value),
      })),
    };
  });

  const canvasIndexById = new Map(canvases.map((c) => [c.id.split('#')[0], c.index]));
  const structures = (manifest.structures || [])
    .filter((s) => !(s.behavior || []).includes('top'))
    .map((range) => {
      const targets = isV3
        ? (range.items || []).map((i) => (typeof i === 'string' ? i : i.id || ''))
        : range.canvases || [];

      const firstTarget = targets[0]?.split('#')[0] || '';
      const targetIndex = canvasIndexById.has(firstTarget) ? canvasIndexById.get(firstTarget) : null;

      return {
        id: range.id || range['@id'] || '',
        label: extractLangValue(range.label) || 'Section',
        canvasIndex: targetIndex,
      };
    })
    .filter((s) => s.canvasIndex !== null);

  const hasScenes = canvases.some((c) => c.kind === 'scene');

  return {
    version: isV4 || hasScenes ? '4.0' : isV3 ? '3.0' : '2.1',
    id,
    label,
    summary,
    attribution,
    rights,
    metadata,
    seeAlso,
    homepage,
    canvases,
    structures,
  };
}