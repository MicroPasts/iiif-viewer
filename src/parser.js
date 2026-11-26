export function extractLangValue(val, preferredLang = 'en') {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);

  if (Array.isArray(val)) {
    const langMatch = val.find(
      (v) => v && typeof v === 'object' && v['@language'] === preferredLang
    );
    if (langMatch) return extractLangValue(langMatch['@value'], preferredLang);
    return val
      .map((v) => extractLangValue(v, preferredLang))
      .filter(Boolean)
      .join('; ');
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

function collectLanguagesFromValue(val, langSet) {
  if (!val || typeof val !== 'object') return;
  if (Array.isArray(val)) {
    val.forEach((v) => {
      if (v && typeof v === 'object' && v['@language'] && v['@language'] !== 'none') {
        langSet.add(v['@language']);
      }
    });
    return;
  }
  Object.keys(val).forEach((k) => {
    if (k !== 'none' && !k.startsWith('@')) {
      langSet.add(k);
    }
  });
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

function extractImageFromPaintingBody(rawBody, fallbackWidth = null, fallbackHeight = null) {
  let serviceUrl = null;
  let serviceProfile = null;
  let staticUrl = null;
  let width = fallbackWidth;
  let height = fallbackHeight;

  if (!rawBody) {
    return { serviceUrl, serviceProfile, staticUrl, width, height };
  }

  const body =
    rawBody.type === 'SpecificResource' && rawBody.source ? rawBody.source : rawBody;

  staticUrl = body.id || body['@id'] || null;
  width = width || body.width || null;
  height = height || body.height || null;

  const services = Array.isArray(body.service)
    ? body.service
    : body.service
      ? [body.service]
      : [];
  const imgService = services.find(
    (s) =>
      String(s.type || s['@type'] || '').includes('ImageService') ||
      String(s.profile || '').includes('iiif.io/api/image')
  );
  if (imgService) {
    serviceUrl = (imgService.id || imgService['@id'] || '').replace(/\/$/, '');
    serviceProfile = imgService.type || imgService['@type'] || imgService.profile || null;
  }

  return { serviceUrl, serviceProfile, staticUrl, width, height };
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

function normalizeImageSource(canvas, isV3) {
  let serviceUrl = null;
  let serviceProfile = null;
  let staticUrl = null;
  let width = canvas.width || null;
  let height = canvas.height || null;

  if (isV3) {
    const annoPages = canvas.items || [];
    for (const page of annoPages) {
      const painting = (page.items || []).find(
        (a) =>
          a.motivation === 'painting' ||
          (Array.isArray(a.motivation) && a.motivation.includes('painting'))
      );
      if (painting && painting.body) {
        const rawBody = Array.isArray(painting.body) ? painting.body[0] : painting.body;
        ({ serviceUrl, serviceProfile, staticUrl, width, height } =
          extractImageFromPaintingBody(rawBody, width, height));
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

      const services = Array.isArray(res.service)
        ? res.service
        : res.service
          ? [res.service]
          : [];
      const imgService = services[0];
      if (imgService) {
        serviceUrl = (imgService['@id'] || imgService.id || '').replace(/\/$/, '');
        serviceProfile = imgService.profile || imgService['@type'] || null;
      }
    }
  }

  const explicitThumb = extractItemThumbnail(canvas);
  const thumbnail =
    explicitThumb || (serviceUrl ? `${serviceUrl}/full/!200,200/0/default.jpg` : staticUrl);

  return {
    serviceUrl,
    serviceProfile,
    infoJsonUrl: serviceUrl ? `${serviceUrl}/info.json` : null,
    staticUrl,
    thumbnail,
    width,
    height,
  };
}

function canvasesFromAnnotationPage(annoPage, preferredLang) {
  const items = Array.isArray(annoPage.items) ? annoPage.items : [];
  const paintingAnnos = items.filter(
    (a) =>
      a &&
      (a.motivation === 'painting' ||
        (Array.isArray(a.motivation) && a.motivation.includes('painting'))) &&
      a.body
  );

  return paintingAnnos.map((anno, idx) => {
    const rawBody = Array.isArray(anno.body) ? anno.body[0] : anno.body;
    const { serviceUrl, serviceProfile, staticUrl, width, height } =
      extractImageFromPaintingBody(rawBody);

    const targetId =
      typeof anno.target === 'string'
        ? anno.target.split('#')[0]
        : anno.target?.id?.split('#')[0] || anno.id || `canvas-${idx}`;

    const label =
      extractLangValue(anno.label, preferredLang) ||
      extractLangValue(rawBody?.label, preferredLang) ||
      `Annotation Canvas ${idx + 1}`;

    const thumbnail =
      extractItemThumbnail(anno) ||
      (serviceUrl ? `${serviceUrl}/full/!200,200/0/default.jpg` : staticUrl);

    return {
      index: idx,
      kind: 'canvas',
      id: targetId,
      rawLabel: anno.label || rawBody?.label || label,
      label,
      image: {
        serviceUrl,
        serviceProfile,
        infoJsonUrl: serviceUrl ? `${serviceUrl}/info.json` : null,
        staticUrl,
        thumbnail,
        width,
        height,
      },
      scene: null,
      annotations: [],
      externalAnnotationUrls: [],
      externalAnnotationsLoaded: true,
      navPlace: null,
      navPlaceRefUrl: null,
      navPlaceLoaded: true,
      metadata: [],
    };
  });
}

export function normalizeNavPlace(
  rawNavPlace,
  { scope = 'manifest', canvasIndex = null, canvasLabel = '', lang = 'en' } = {}
) {
  if (!rawNavPlace || typeof rawNavPlace !== 'object') {
    return { featureCollection: null, refUrl: null };
  }

  if (
    rawNavPlace.type === 'FeatureCollection' &&
    !Array.isArray(rawNavPlace.features) &&
    typeof rawNavPlace.id === 'string'
  ) {
    return { featureCollection: null, refUrl: rawNavPlace.id };
  }

  let rawFeatures = [];
  if (rawNavPlace.type === 'FeatureCollection' && Array.isArray(rawNavPlace.features)) {
    rawFeatures = rawNavPlace.features;
  } else if (rawNavPlace.type === 'Feature') {
    rawFeatures = [rawNavPlace];
  } else if (rawNavPlace.type && rawNavPlace.coordinates) {
    rawFeatures = [{ type: 'Feature', geometry: rawNavPlace, properties: {} }];
  } else {
    return { featureCollection: null, refUrl: null };
  }

  const features = rawFeatures
    .filter((f) => f && f.type === 'Feature' && f.geometry)
    .map((f, idx) => {
      const props = { ...(f.properties || {}) };
      const propLabel = props.label
        ? extractLangValue(props.label, lang)
        : canvasLabel || `${scope === 'canvas' ? 'Canvas' : 'Manifest'} Location ${idx + 1}`;
      return {
        type: 'Feature',
        id: f.id || `${scope}-${canvasIndex ?? 'm'}-${idx}`,
        geometry: f.geometry,
        properties: {
          ...props,
          _title: propLabel,
          _scope: scope,
          _canvasIndex: canvasIndex,
        },
      };
    });

  if (!features.length) {
    return { featureCollection: null, refUrl: null };
  }

  return {
    featureCollection: {
      type: 'FeatureCollection',
      features,
    },
    refUrl: null,
  };
}

export function parseAnnotationItems(items = [], isV3 = true) {
  const results = [];

  if (isV3) {
    items.forEach((anno) => {
      const bodies = Array.isArray(anno.body) ? anno.body : anno.body ? [anno.body] : [];
      const text = bodies
        .map((b) => (typeof b === 'string' ? b : extractLangValue(b.value || b.label || '')))
        .filter(Boolean)
        .join(' ');
      if (text) {
        const targetStr =
          typeof anno.target === 'string'
            ? anno.target
            : anno.target?.id || anno.target?.source || '';
        const selectorVal = anno.target?.selector?.value || targetStr;
        const xywhMatch = String(selectorVal).match(/xywh=(?:pixel:)?([0-9,.-]+)/);
        results.push({
          id: anno.id || '',
          motivation: Array.isArray(anno.motivation)
            ? anno.motivation.join(', ')
            : anno.motivation || 'commenting',
          text,
          target: targetStr,
          xywh: xywhMatch ? xywhMatch[1].split(',').map(Number) : null,
        });
      }
    });
  } else {
    items.forEach((res) => {
      const chars = res.resource?.chars || '';
      if (chars) {
        const targetStr = typeof res.on === 'string' ? res.on : res.on?.full || '';
        const xywhMatch = String(targetStr).match(/#xywh=([0-9,.-]+)/);
        results.push({
          id: res['@id'] || '',
          motivation: res.motivation || 'sc:painting',
          text: chars,
          target: targetStr,
          xywh: xywhMatch ? xywhMatch[1].split(',').map(Number) : null,
        });
      }
    });
  }

  return results;
}

function extractAnnotations(canvas, isV3) {
  const annotations = [];
  const externalAnnotationUrls = [];

  if (isV3) {
    (canvas.annotations || []).forEach((page) => {
      if (Array.isArray(page.items) && page.items.length) {
        annotations.push(...parseAnnotationItems(page.items, true));
      } else if (page.id) {
        externalAnnotationUrls.push(page.id);
      }
    });
  } else {
    (canvas.otherContent || []).forEach((list) => {
      if (Array.isArray(list.resources) && list.resources.length) {
        annotations.push(...parseAnnotationItems(list.resources, false));
      } else if (list['@id']) {
        externalAnnotationUrls.push(list['@id']);
      }
    });
  }

  return { annotations, externalAnnotationUrls };
}

function buildStructureTree(rawStructures, isV3, canvasIndexById, preferredLang) {
  if (!Array.isArray(rawStructures) || !rawStructures.length) return [];

  const rangeMap = new Map();
  rawStructures.forEach((r) => {
    const id = r.id || r['@id'];
    if (id) rangeMap.set(id, r);
  });

  const resolveCanvasIndex = (range, ancestors = new Set()) => {
    if (ancestors.has(range)) return null;
    const visited = new Set(ancestors);
    visited.add(range);
    const targets = isV3 ? range.items || [] : range.canvases || [];

    for (const target of targets) {
      const id = typeof target === 'string' ? target : target?.id || target?.['@id'] || '';
      const cleanId = id.split('#')[0];
      if (canvasIndexById.has(cleanId)) {
        return canvasIndexById.get(cleanId);
      }
      const embeddedRange = target?.type === 'Range' && Array.isArray(target.items) ? target : null;
      const nestedRange = embeddedRange || rangeMap.get(cleanId);
      if (nestedRange) {
        const nestedIdx = resolveCanvasIndex(nestedRange, visited);
        if (nestedIdx !== null) return nestedIdx;
      }
    }
    return null;
  };

  const referencedAsChild = new Set();
  rawStructures.forEach((r) => {
    const children = isV3 ? r.items || [] : r.ranges || [];
    children.forEach((c) => {
      const cid = typeof c === 'string' ? c : c.id || c['@id'];
      if (cid && rangeMap.has(cid)) referencedAsChild.add(cid);
    });
  });

  const convertNode = (range, depth = 0, visited = new Set()) => {
    const id = range.id || range['@id'] || `range-${depth}`;
    if (visited.has(id)) return null;
    visited.add(id);

    const rawChildren = isV3
      ? (range.items || []).filter(
          (i) =>
            (typeof i === 'object' && i.type === 'Range') ||
            rangeMap.has(typeof i === 'string' ? i : i.id)
        )
      : (range.ranges || [])
          .map((rid) => (typeof rid === 'string' ? rangeMap.get(rid) : rid))
          .filter(Boolean);

    const children = rawChildren
      .map((child) => {
        const resolved =
          typeof child === 'string'
            ? rangeMap.get(child)
            : child.items
              ? child
              : rangeMap.get(child.id) || child;
        return resolved ? convertNode(resolved, depth + 1, new Set(visited)) : null;
      })
      .filter(Boolean);

    const canvasIndex = resolveCanvasIndex(range);
    if (canvasIndex === null && children.length === 0) return null;

    return {
      id,
      rawLabel: range.label,
      label: extractLangValue(range.label, preferredLang) || 'Section',
      canvasIndex: canvasIndex ?? children[0]?.canvasIndex ?? 0,
      children,
    };
  };

  const topNodes = rawStructures.filter((r) => {
    const id = r.id || r['@id'];
    const isTop = (r.behavior || []).includes('top');
    return !isTop && !referencedAsChild.has(id);
  });

  if (topNodes.length === 0) {
    const topWrapper = rawStructures.find((r) => (r.behavior || []).includes('top'));
    if (topWrapper) {
      const node = convertNode(topWrapper);
      return node?.children || [];
    }
  }

  return topNodes.map((r) => convertNode(r)).filter(Boolean);
}

export function parseIIIFManifest(manifest, preferredLang = 'en') {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Invalid IIIF Manifest JSON.');
  }

  const contextStr = JSON.stringify(manifest['@context'] || '');
  const isV4 = contextStr.includes('/presentation/4/');
  const isV3 =
    isV4 ||
    contextStr.includes('/presentation/3/') ||
    manifest.type === 'Manifest' ||
    manifest.type === 'AnnotationPage' ||
    Array.isArray(manifest.items);

  const langSet = new Set();
  collectLanguagesFromValue(manifest.label, langSet);
  collectLanguagesFromValue(manifest.summary || manifest.description, langSet);
  (manifest.metadata || []).forEach((m) => {
    collectLanguagesFromValue(m.label, langSet);
    collectLanguagesFromValue(m.value, langSet);
  });

  const id = manifest.id || manifest['@id'] || '';
  const rawLabel = manifest.label;
  const rawSummary = manifest.summary || manifest.description || '';
  const rawAttribution = manifest.requiredStatement?.value || manifest.attribution || '';

  const rights =
    typeof manifest.rights === 'string'
      ? manifest.rights
      : typeof manifest.license === 'string'
        ? manifest.license
        : extractLangValue(manifest.license || '', preferredLang);

  const rawMetadata = (manifest.metadata || []).map((entry) => ({
    rawLabel: entry.label,
    rawValue: entry.value,
    label: extractLangValue(entry.label, preferredLang),
    value: extractLangValue(entry.value, preferredLang),
  }));

  const seeAlso = (
    Array.isArray(manifest.seeAlso)
      ? manifest.seeAlso
      : manifest.seeAlso
        ? [manifest.seeAlso]
        : []
  )
    .map((item) => ({
      id: item.id || item['@id'] || '',
      label: extractLangValue(item.label, preferredLang) || item.format || 'Related Resource',
      format: item.format || '',
    }))
    .filter((s) => s.id);

  const homepage = (
    Array.isArray(manifest.homepage)
      ? manifest.homepage
      : manifest.homepage
        ? [manifest.homepage]
        : []
  )
    .map((item) => ({
      id: item.id || item['@id'] || '',
      label: extractLangValue(item.label, preferredLang) || 'Record Homepage',
    }))
    .filter((h) => h.id);

  const manifestNav = normalizeNavPlace(manifest.navPlace, {
    scope: 'manifest',
    canvasIndex: null,
    canvasLabel: extractLangValue(rawLabel, preferredLang),
    lang: preferredLang,
  });

  const canvases =
    manifest.type === 'AnnotationPage'
      ? canvasesFromAnnotationPage(manifest, preferredLang)
      : (isV3 ? manifest.items || [] : manifest.sequences?.[0]?.canvases || []).map(
          (c, index) => {
            const itemId = c.id || c['@id'] || `canvas-${index}`;
            const isScene = c.type === 'Scene';
            const canvasLabel =
              extractLangValue(c.label, preferredLang) ||
              (isScene ? `3D Scene ${index + 1}` : `Canvas ${index + 1}`);
            const { annotations, externalAnnotationUrls } = extractAnnotations(c, isV3);
            const canvasNav = normalizeNavPlace(c.navPlace, {
              scope: 'canvas',
              canvasIndex: index,
              canvasLabel,
              lang: preferredLang,
            });

            const canvasMeta = (c.metadata || []).map((m) => ({
              rawLabel: m.label,
              rawValue: m.value,
              label: extractLangValue(m.label, preferredLang),
              value: extractLangValue(m.value, preferredLang),
            }));

            if (isScene) {
              const scene = normalizeSceneSource(c);
              return {
                index,
                kind: 'scene',
                id: itemId,
                rawLabel: c.label,
                label: canvasLabel,
                image: {
                  serviceUrl: null,
                  serviceProfile: null,
                  infoJsonUrl: null,
                  staticUrl: null,
                  thumbnail: scene.thumbnail,
                  width: null,
                  height: null,
                },
                scene,
                annotations,
                externalAnnotationUrls,
                externalAnnotationsLoaded: false,
                navPlace: canvasNav.featureCollection,
                navPlaceRefUrl: canvasNav.refUrl,
                navPlaceLoaded: !canvasNav.refUrl,
                metadata: canvasMeta,
              };
            }

            const image = normalizeImageSource(c, isV3);
            return {
              index,
              kind: 'canvas',
              id: itemId,
              rawLabel: c.label,
              label: canvasLabel,
              image,
              scene: null,
              annotations,
              externalAnnotationUrls,
              externalAnnotationsLoaded: false,
              navPlace: canvasNav.featureCollection,
              navPlaceRefUrl: canvasNav.refUrl,
              navPlaceLoaded: !canvasNav.refUrl,
              metadata: canvasMeta,
            };
          }
        );

  const canvasIndexById = new Map(canvases.map((c) => [c.id.split('#')[0], c.index]));
  const structures = buildStructureTree(manifest.structures || [], isV3, canvasIndexById, preferredLang);
  const hasScenes = canvases.some((c) => c.kind === 'scene');

  return {
    version: isV4 || hasScenes ? '4.0' : isV3 ? '3.0' : '2.1',
    isV3,
    id,
    availableLanguages: Array.from(langSet),
    rawLabel,
    rawSummary,
    rawAttribution,
    label:
      extractLangValue(rawLabel, preferredLang) ||
      (manifest.type === 'AnnotationPage' ? 'IIIF Annotation Page' : 'Untitled IIIF Manifest'),
    summary: extractLangValue(rawSummary, preferredLang),
    attribution: extractLangValue(rawAttribution, preferredLang),
    rights,
    rawMetadata,
    metadata: rawMetadata,
    seeAlso,
    homepage,
    navPlace: manifestNav.featureCollection,
    navPlaceRefUrl: manifestNav.refUrl,
    navPlaceLoaded: !manifestNav.refUrl,
    canvases,
    structures,
  };
}