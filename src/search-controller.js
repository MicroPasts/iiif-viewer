import { extractLangValue, parseAnnotationItems } from './parser.js';
import { getPlainText } from './sanitize.js';

function searchText(value) {
  return getPlainText(value).replace(/\s+/g, ' ').trim();
}

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

    return rawItems.flatMap((rawItem, idx) => {
      const [anno] = parseAnnotationItems([rawItem], !this.searchService.isV2);
      if (!anno) return [];
      const targetClean = String(anno.target || '').split('#')[0];
      const canvasIndex = canvasIndexById.has(targetClean)
        ? canvasIndexById.get(targetClean)
        : 0;

      // Also check raw item for `on` / `target.source` canvas ID if needed
      const fallbackSource =
        rawItem?.target?.source?.id ||
        rawItem?.target?.source?.['@id'] ||
        rawItem?.target?.source ||
        (typeof rawItem?.on === 'string' ? rawItem.on : rawItem?.on?.full) ||
        '';
      const fallbackClean = typeof fallbackSource === 'string' ? fallbackSource.split('#')[0] : '';
      const resolvedCanvasIndex = canvasIndexById.has(fallbackClean)
        ? canvasIndexById.get(fallbackClean)
        : canvasIndex;

      const canvas = parsedManifest?.canvases?.[resolvedCanvasIndex];
      const snippet =
        extractLangValue(rawItem?.body?.value) ||
        anno.text;

      return [{
        id: anno.id || `hit-${idx}`,
        canvasIndex: resolvedCanvasIndex,
        canvasLabel: canvas?.label || `Canvas ${resolvedCanvasIndex + 1}`,
        text: snippet,
        xywh: anno.xywh,
        temporal: anno.temporal,
        source: 'iiif-search',
      }];
    });
  }

  searchLocal(query, parsedManifest) {
    if (!parsedManifest) return [];
    const needle = query.replace(/\s+/g, ' ').trim().toLowerCase();
    const hits = [];

    // 1. Search manifest-level metadata
    const manifestMetaMatches = (parsedManifest.metadata || []).filter(
      (m) =>
        searchText(m.label).toLowerCase().includes(needle) ||
        searchText(m.value).toLowerCase().includes(needle)
    );

    if (
      searchText(parsedManifest.label).toLowerCase().includes(needle) ||
      searchText(parsedManifest.summary).toLowerCase().includes(needle) ||
      manifestMetaMatches.length > 0
    ) {
      const detail =
        manifestMetaMatches[0]
          ? `${searchText(manifestMetaMatches[0].label)}: ${searchText(manifestMetaMatches[0].value)}`
          : searchText(parsedManifest.summary) || searchText(parsedManifest.label);
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
      const labelMatch = searchText(canvas.label).toLowerCase().includes(needle);
      const metaMatch = (canvas.metadata || []).find(
        (m) =>
          searchText(m.label).toLowerCase().includes(needle) ||
          searchText(m.value).toLowerCase().includes(needle)
      );
      const annoMatches = (canvas.annotations || []).filter((a) =>
        searchText(a.text).toLowerCase().includes(needle)
      );

      for (const anno of annoMatches) {
        hits.push({
          id: anno.id || `${canvas.id}-anno`,
          canvasIndex: canvas.index,
          canvasLabel: canvas.label,
          text: searchText(anno.text).slice(0, 180),
          xywh: anno.xywh,
          temporal: anno.temporal,
          source: 'local',
        });
      }

      if ((labelMatch || metaMatch) && annoMatches.length === 0) {
        const snippet = metaMatch
          ? `${searchText(metaMatch.label)}: ${searchText(metaMatch.value)}`
          : searchText(canvas.label);
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