export class UrlResolver {
  constructor({ proxyUrl = '', assetProxyUrl = '', proxyRoutes = null } = {}) {
    this.proxyUrl = proxyUrl;
    this.assetProxyUrl = assetProxyUrl;
    this.proxyRoutes = proxyRoutes;
  }

  setProxyRoutes(proxyRoutes) {
    this.proxyRoutes = proxyRoutes;
  }

  /**
   * Resolves a manifest or asset URL through proxyRoutes, assetProxyUrl, or proxyUrl.
   * @param {string} url
   * @param {'manifest'|'image'|'model'|'thumbnail'|'annotation'} resourceType
   */
  resolve(url, resourceType = 'asset') {
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }

    const routes = this.proxyRoutes;
    if (typeof routes === 'function') {
      const rewritten = routes(url, resourceType);
      if (rewritten) return rewritten;
    } else if (Array.isArray(routes)) {
      for (const rule of routes) {
        if (!rule) continue;
        if (rule.types && !rule.types.includes(resourceType)) continue;
        if (typeof rule.match === 'string' && url.startsWith(rule.match)) {
          return `${rule.replace}${url.slice(rule.match.length)}`;
        }
        if (rule.match instanceof RegExp && rule.match.test(url)) {
          return url.replace(rule.match, rule.replace);
        }
      }
    } else if (routes && typeof routes === 'object') {
      for (const [prefix, replacement] of Object.entries(routes)) {
        if (url.startsWith(prefix)) {
          return `${replacement}${url.slice(prefix.length)}`;
        }
      }
    }

    if (resourceType === 'manifest' && this.proxyUrl) {
      return `${this.proxyUrl}${encodeURIComponent(url)}`;
    }

    if (resourceType !== 'manifest' && this.assetProxyUrl) {
      return `${this.assetProxyUrl}${encodeURIComponent(url)}`;
    }

    return url;
  }
}