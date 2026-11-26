export function preserveSecureTileUrls(item, infoUrl) {
  if (typeof infoUrl !== 'string' || !infoUrl.startsWith('https://') ||
      !/\/info\.json(?:\?.*)?$/.test(infoUrl)) return;
  const source = item?.source;
  if (!source || typeof source.getTileUrl !== 'function') return;
  const secureBase = infoUrl.replace(/\/info\.json(?:\?.*)?$/, '');
  const insecureBase = `http://${secureBase.slice('https://'.length)}`;
  const getTileUrl = source.getTileUrl;
  source.getTileUrl = function (...args) {
    const url = getTileUrl.apply(this, args);
    return typeof url === 'string' && url.startsWith(`${insecureBase}/`)
      ? `${secureBase}${url.slice(insecureBase.length)}`
      : url;
  };
}
