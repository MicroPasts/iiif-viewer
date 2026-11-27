export function configurePermalink(option) {
  if (option === undefined || option === false) return null;
  if (option === true) return { prefix: 'iiif' };
  if (!option || typeof option !== 'object' || Array.isArray(option) ||
      typeof option.prefix !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(option.prefix)) {
    throw new TypeError('permalink must be true, false, or an object with an alphanumeric URL prefix.');
  }
  return { prefix: option.prefix };
}

function manifestUrl(value, base) {
  const url = new URL(value, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('The manifest URL must be an HTTP(S) URL without embedded credentials.');
  }
  return url.href;
}

export function parsePermalink(href, prefix) {
  const params = new URL(href).searchParams;
  const key = (name) => `${prefix}-${name}`;
  const names = ['manifest', 'canvas', 'xywh', 'lang', 'rotation', 'flip'];
  if (!names.some((name) => params.has(key(name)))) return null;
  for (const name of names) {
    if (params.getAll(key(name)).length > 1) throw new Error(`Duplicate permalink parameter: ${key(name)}.`);
  }
  const manifest = params.get(key('manifest'));
  if (!manifest) throw new Error('The permalink is missing its manifest URL.');
  const canvas = params.get(key('canvas'));
  if (canvas !== null && (!/^(0|[1-9]\d*)$/.test(canvas) || !Number.isSafeInteger(Number(canvas)))) {
    throw new Error('The permalink canvas index is invalid.');
  }
  const region = params.get(key('xywh'));
  let xywh = null;
  if (region !== null) {
    const parts = region.split(',');
    const number = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
    if (parts.length !== 4 || parts.some((part) => !number.test(part))) throw new Error('The permalink region is invalid.');
    xywh = parts.map(Number);
    if (xywh.some((value) => !Number.isFinite(value)) || xywh[2] <= 0 || xywh[3] <= 0) {
      throw new Error('The permalink region is invalid.');
    }
  }
  const language = params.get(key('lang'));
  if (language !== null && !/^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/.test(language)) throw new Error('The permalink language is invalid.');
  const rotation = params.get(key('rotation')) ?? '0';
  const flip = params.get(key('flip')) ?? 'none';
  if (!['0', '90', '180', '270'].includes(rotation) || !['none', 'h', 'v', 'hv'].includes(flip)) {
    throw new Error('The permalink orientation is invalid.');
  }
  return { manifest: manifestUrl(manifest, href), canvas: canvas === null ? 0 : Number(canvas),
    xywh, language, rotation: Number(rotation), flip };
}

export function serializePermalink(href, prefix, state) {
  const url = new URL(href);
  const params = url.searchParams;
  const set = (key, value) => params.set(`${prefix}-${key}`, value);
  set('manifest', manifestUrl(state.manifest, href));
  set('canvas', String(state.canvas));
  set('xywh', state.xywh.map((value) => Number(value.toPrecision(12))).join(','));
  set('lang', state.language);
  set('rotation', String(state.rotation));
  set('flip', state.flip);
  parsePermalink(url.href, prefix);
  return url.href;
}
