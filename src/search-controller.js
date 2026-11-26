import { extractLangValue, parseAnnotationItems } from './parser.js';

export function findSearchService(rawManifest) {
  if (!rawManifest || typeof rawManifest !== 'object') return null;
  const services = Array.isArray(rawManifest.service)
    ? rawManifest.service
    : rawManifest.service
      ? [rawManifest.service]
      : [];

  for (const svc of services) {
    if (!svc || typeof svc !== 'object') continue;
    const typeStr = String(svc.type || svc['@type'] || '');
    const profileStr = String(svc.profile || '');
    if (
      typeStr.includes('SearchService') ||
      profileStr.includes('api/search')
    ) {
      const endpoint = (svc.id || svc['@id'] || '').replace(/\/$/, '');
      if (endpoint) {
        return {
          id: endpoint,
          isV2: typeStr === 'sc:SearchService' || profileStr.includes('/search/1/'),
        };
      }
    }
  }
  return null;
}

export class ManifestSearchController {
  constructor({ resolveUrl = (u) => u, fetchOptions = {} } = {}) {
    this.resolveUrl = resolveUrl;
    this.fetchOptions = fetchOptions;
    this.searchService = null;
    this.abortController = null;
  }

  setManifest(rawManifest) {
    this.abortController?.abort();
    this.searchService = findSearchService(rawManifest);
  }

  hasRemoteSearch() {
    return Boolean(this.searchService?.id);
  }

  async search(query, parsedManifest, { signal } = {}) {
    const q = String(query || '').trim();
    if (!q) return [];

    if (this.searchService?.id) {
      try {
        return await this.searchRemote(q, parsedManifest, signal);
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        // Fall back to local manifest search if remote search endpoint fails
      }
    }

    return this.searchLocal(q, parsedManifest);
  }

  async searchRemote(query, parsedManifest, externalSignal) {
    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;

    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const sep = this.searchService.id.includes('?') ? '&' : '?';
    const rawSearchUrl = `${this.searchService.id}${sep}q=${encodeURIComponent(query)}`;
    const resolvedUrl = this.resolveUrl(rawSearchUrl, 'search');

    const res = await fetch(resolvedUrl, {
      ...this.fetchOptions,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Search HTTP ${res.status}`);
    const data = await res.json();

    const canvasIndexById = new Map();
    (parsedManifest?.canvases || []).forEach((c) => {
      const clean = c.id.split('#')[0];
      canvasIndexById.set(clean, c.index);
    });

    const rawItems = this.searchService.isV2
      ? data.resources || []
      : data.items || [];

    const parsedAnnos = parseAnnotationItems(rawItems, !this.searchService.isV2);

    return parsedAnnos.map((anno, idx) => {
      const targetClean = String(anno.target || '').split('#')[0];
      const canvasIndex = canvasIndexById.has(targetClean)
        ? canvasIndexById.get(targetClean)
        : 0;

      // Also check raw item for `on` / `target.source` canvas ID if needed
      const rawItem = rawItems[idx];
      const fallbackSource =
        rawItem?.target?.source?.id ||
        rawItem?.target?.source ||
        (typeof rawItem?.on === 'string' ? rawItem.on.split('#')[0] : rawItem?.on?.full?.split('#')[0]) ||
        '';
      const resolvedCanvasIndex = canvasIndexById.has(fallbackSource)
        ? canvasIndexById.get(fallbackSource)
        : canvasIndex;

      const canvas = parsedManifest?.canvases?.[resolvedCanvasIndex];
      const snippet =
        rawItem?.body?.value ||
        extractLangValue(rawItem?.body?.value) ||
        anno.text;

      return {
        id: anno.id || `hit-${idx}`,
        canvasIndex: resolvedCanvasIndex,
        canvasLabel: canvas?.label || `Canvas ${resolvedCanvasIndex + 1}`,
        text: snippet,
        xywh: anno.xywh,
        source: 'iiif-search',
      };
    });
  }

  searchLocal(query, parsedManifest) {
    if (!parsedManifest) return [];
    const needle = query.toLowerCase();
    const hits = [];

    // 1. Search manifest-level metadata
    const manifestMetaMatches = (parsedManifest.metadata || []).filter(
      (m) =>
        String(m.label || '').toLowerCase().includes(needle) ||
        String(m.value || '').toLowerCase().includes(needle)
    );

    if (
      String(parsedManifest.label || '').toLowerCase().includes(needle) ||
      String(parsedManifest.summary || '').toLowerCase().includes(needle) ||
      manifestMetaMatches.length > 0
    ) {
      const detail =
        manifestMetaMatches[0]
          ? `${manifestMetaMatches[0].label}: ${manifestMetaMatches[0].value.replace(/<[^>]+>/g, '')}`
          : parsedManifest.summary?.replace(/<[^>]+>/g, '') || parsedManifest.label;
      hits.push({
        id: 'manifest-match',
        canvasIndex: 0,
        canvasLabel: 'Manifest Overview',
        text: detail.slice(0, 180),
        xywh: null,
        source: 'local',
      });
    }

    // 2. Search each canvas's label, metadata, and annotations
    for (const canvas of parsedManifest.canvases || []) {
      const labelMatch = String(canvas.label || '').toLowerCase().includes(needle);
      const metaMatch = (canvas.metadata || []).find(
        (m) =>
          String(m.label || '').toLowerCase().includes(needle) ||
          String(m.value || '').toLowerCase().includes(needle)
      );
      const annoMatches = (canvas.annotations || []).filter((a) =>
        String(a.text || '').toLowerCase().includes(needle)
      );

      for (const anno of annoMatches) {
        hits.push({
          id: anno.id || `${canvas.id}-anno`,
          canvasIndex: canvas.index,
          canvasLabel: canvas.label,
          text: anno.text.replace(/<[^>]+>/g, '').slice(0, 180),
          xywh: anno.xywh,
          source: 'local',
        });
      }

      if ((labelMatch || metaMatch) && annoMatches.length === 0) {
        const snippet = metaMatch
          ? `${metaMatch.label}: ${String(metaMatch.value || '').replace(/<[^>]+>/g, '')}`
          : canvas.label;
        hits.push({
          id: `${canvas.id}-match`,
          canvasIndex: canvas.index,
          canvasLabel: canvas.label,
          text: snippet.slice(0, 180),
          xywh: null,
          source: 'local',
        });
      }
    }

    return hits;
  }

  destroy() {
    this.abortController?.abort();
  }
}