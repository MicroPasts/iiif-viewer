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
        const body = Array.isArray(painting.body) ? painting.body[0] : painting.body;
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

  const thumbnail = serviceUrl
    ? `${serviceUrl}/full/!200,200/0/default.jpg`
    : staticUrl;

  return {
    serviceUrl,
    infoJsonUrl: serviceUrl ? `${serviceUrl}/info.json` : null,
    staticUrl,
    thumbnail,
    width,
    height,
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
          results.push({
            id: anno.id || '',
            motivation: Array.isArray(anno.motivation) ? anno.motivation.join(', ') : anno.motivation || 'commenting',
            text,
            target: typeof anno.target === 'string' ? anno.target : anno.target?.id || '',
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
  const isV3 =
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

  const rawCanvases = isV3
    ? manifest.items || []
    : manifest.sequences?.[0]?.canvases || [];

  const canvases = rawCanvases.map((c, index) => {
    const canvasId = c.id || c['@id'] || `canvas-${index}`;
    const image = normalizeImageSource(c, isV3);
    const annotations = extractAnnotations(c, isV3);

    return {
      index,
      id: canvasId,
      label: extractLangValue(c.label) || `Canvas ${index + 1}`,
      image,
      annotations,
      metadata: (c.metadata || []).map((m) => ({
        label: extractLangValue(m.label),
        value: extractLangValue(m.value),
      })),
    };
  });

  // Parse structures / ranges (Table of Contents)
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

  return {
    version: isV3 ? '3.0' : '2.1',
    id,
    label,
    summary,
    attribution,
    rights,
    metadata,
    canvases,
    structures,
  };
}