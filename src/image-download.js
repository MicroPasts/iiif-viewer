const defaultWidths = [500, 1000, 2000];
const defaultMaxPixels = 16_000_000;

export function configureImageDownload(option) {
  if (option === undefined || option === false) return null;
  if (option !== true && (!option || typeof option !== 'object' || Array.isArray(option))) {
    throw new TypeError('imageDownload must be a boolean or an object.');
  }
  const { widths = defaultWidths, maxPixels = defaultMaxPixels, maxWidth = null, maxHeight = null,
    excludeSizes = [], allowOriginal = true } = option === true ? {} : option;
  const validLimit = (value) => value === null || (Number.isSafeInteger(value) && value > 0);
  if (!Array.isArray(widths) || widths.some((width) => !Number.isSafeInteger(width) || width <= 0) ||
      !Number.isSafeInteger(maxPixels) || maxPixels <= 0 || !validLimit(maxWidth) || !validLimit(maxHeight) ||
      !Array.isArray(excludeSizes) || excludeSizes.some((size) =>
        !size || !Number.isSafeInteger(size.width) || size.width <= 0 ||
        !Number.isSafeInteger(size.height) || size.height <= 0) || typeof allowOriginal !== 'boolean') {
    throw new TypeError('imageDownload limits and sizes must be positive integers, and allowOriginal must be a boolean.');
  }
  return { widths: [...new Set(widths)], maxPixels, maxWidth, maxHeight,
    excludeSizes: excludeSizes.map(({ width, height }) => ({ width, height })), allowOriginal };
}

function supportsWidth(info) {
  const profile = JSON.stringify(info.profile || '');
  const features = [...(info.extraFeatures || []), ...(info.profile?.[1]?.supports || [])];
  return /level[12]/i.test(profile) || features.includes('sizeByW');
}

function withinLimits(width, height, info, maxPixels) {
  const limits = Array.isArray(info.profile) && typeof info.profile[1] === 'object' ? info.profile[1] : {};
  const manifest = info.manifestService || {};
  const manifestLimits = Array.isArray(manifest.profile) && typeof manifest.profile[1] === 'object' ? manifest.profile[1] : {};
  const limit = (name) => Math.min(...[info[name], limits[name], manifest[name], manifestLimits[name]]
    .filter((value) => Number.isFinite(value) && value > 0), Infinity);
  return width > 0 && height > 0 && width <= info.width && height <= info.height &&
    width <= limit('maxWidth') && height <= limit('maxHeight') &&
    width * height <= Math.min(limit('maxArea'), maxPixels);
}

function restricted(width, height, options) {
  return width > (options.maxWidth ?? Infinity) || height > (options.maxHeight ?? Infinity) ||
    (options.excludeSizes || []).some((size) => size.width === width && size.height === height);
}

function isFullSize(size, info) {
  return size.width === info.width && size.height === info.height;
}

function advertisedSize(info, width, height) {
  return [...(info.sizes || []), ...(info.manifestService?.sizes || [])]
    .some((size) => size.width === width && size.height === height);
}

export function downloadSizes(info, { widths, maxPixels, maxWidth, maxHeight, excludeSizes, allowOriginal = true }) {
  if (!Number.isSafeInteger(info.width) || !Number.isSafeInteger(info.height) ||
      info.width <= 0 || info.height <= 0) throw new Error('Image service did not provide valid dimensions.');
  const options = { maxWidth, maxHeight, excludeSizes };
  const sizes = new Map();
  const add = (width, height, advertised = false) => {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) return;
    const key = `${width}x${height}`;
    const full = width === info.width && height === info.height;
    if (full && !allowOriginal) return;
    let reason = '';
    if (restricted(width, height, options)) reason = 'disallowed by configuration';
    else if (!withinLimits(width, height, info, Infinity)) reason = 'exceeds image service limits';
    else if (width * height > maxPixels) reason = 'exceeds export pixel limit';
    else if (!full && !advertisedSize(info, width, height) && !supportsWidth(info)) reason = 'not supported by image service';
    const previous = sizes.get(key);
    sizes.set(key, { width, height, advertised: advertised || Boolean(previous?.advertised), full, reason });
  };
  for (const size of [...(info.sizes || []), ...(info.manifestService?.sizes || [])]) add(size.width, size.height, true);
  if (supportsWidth(info)) {
    for (const width of widths) {
      if (width <= info.width) add(width, Math.round(width * info.height / info.width));
    }
  }
  if (allowOriginal) add(info.width, info.height);
  return [...sizes.values()].sort((a, b) => a.width - b.width);
}

export function imageRequestUrl(image, info, size) {
  const advertised = advertisedSize(info, size.width, size.height);
  const full = isFullSize(size, info);
  if (!withinLimits(size.width, size.height, info, Infinity) || (!full && !advertised && !supportsWidth(info))) {
    throw new Error(`The image service does not advertise support for ${size.width} × ${size.height}.`);
  }
  const version3 = /ImageService3|image\/3\/context/.test(JSON.stringify([info.type, info['@context'], image.serviceDetails?.type]));
  const sizePart = full ? (version3 ? 'max' : 'full') : advertised ? `${size.width},${size.height}` : `${size.width},`;
  return `${image.serviceUrl}/full/${sizePart}/0/default.jpg`;
}

async function loadInfo(image, resolveUrl, signal) {
  const response = await fetch(resolveUrl(image.infoJsonUrl, 'image'), { signal });
  if (!response.ok) throw new Error(`Image service returned HTTP ${response.status}.`);
  return { ...await response.json(), manifestService: image.serviceDetails };
}

async function loadBitmap(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Image request returned HTTP ${response.status}.`);
  return createImageBitmap(await response.blob());
}

function outputBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) =>
    blob ? resolve(blob) : reject(new Error('Could not encode the image.')), 'image/png'));
}

export class ImageDownload {
  constructor(wrapper, controller, options, { resolveUrl, getLayers, getRights, closeInspection }) {
    this.wrapper = wrapper;
    this.controller = controller;
    this.options = options;
    this.resolveUrl = resolveUrl;
    this.getLayers = getLayers;
    this.getRights = getRights;
    this.closeInspection = closeInspection;
    this.generation = 0;
    this.toolbar = wrapper.querySelector('[data-el="download-button"]');
    this.host = wrapper.querySelector('[data-el="download-panel"]');
    this.toolbar.innerHTML = `<button type="button" aria-expanded="false" aria-controls="${this.host.id}">Download</button>`;
    this.host.innerHTML = `
      <div class="iiif-inspection-heading"><span class="iiif-inspection-icon" aria-hidden="true">&#8595;</span><div><strong>Download image</strong><p>Full canvas with visible layers and filters</p></div></div>
      <p class="iiif-inspection-help">Respect the image provider's rights and terms of use.</p>
      <a data-download="rights" target="_blank" rel="noopener noreferrer" class="iiif-download-rights" hidden>View rights statement</a>
      <label class="iiif-inspection-field">Output size <select data-download="size"></select></label>
      <button type="button" data-download="export" class="iiif-inspection-primary iiif-inspection-wide">Download PNG</button>
      <button type="button" data-download="original" class="iiif-inspection-wide" hidden>Download original image</button>
      <p data-download="status" class="iiif-inspection-help" role="status"></p>`;
    this.button = this.toolbar.querySelector('button');
    this.onButton = () => {
      this.host.hidden = !this.host.hidden;
      this.button.setAttribute('aria-expanded', String(!this.host.hidden));
      if (!this.host.hidden) {
        this.closeInspection();
        this.prepare();
      }
      else {
        this.abort?.abort();
        this.generation += 1;
      }
    };
    this.onClick = (event) => {
      const action = event.target.closest('[data-download]')?.dataset.download;
      if (action === 'export') this.exportComposite();
      if (action === 'original') this.downloadOriginal();
    };
    this.onOtherTool = (event) => {
      if (!event.target.closest('[data-el="inspection-buttons"] button, [data-action="toggle-filters"]')) return;
      this.close();
    };
    this.button.addEventListener('click', this.onButton);
    this.host.addEventListener('click', this.onClick);
    this.wrapper.addEventListener('click', this.onOtherTool);
  }

  close() {
    this.abort?.abort();
    this.generation += 1;
    this.host.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
  }

  setCanvas(canvas) {
    this.abort?.abort();
    this.generation += 1;
    this.canvas = canvas;
    this.info = null;
    this.sizes = [];
    const hidden = !canvas || canvas.kind !== 'canvas' || !(canvas.image?.infoJsonUrl || canvas.image?.staticUrl);
    const focused = this.host.contains(document.activeElement) || this.toolbar.contains(document.activeElement);
    this.toolbar.hidden = hidden;
    this.host.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
    if (hidden && focused) this.wrapper.querySelector('[data-el="viewer-root"]')?.focus();
  }

  status(text) {
    this.host.querySelector('[data-download="status"]').textContent = text;
  }

  async prepare() {
    this.abort?.abort();
    const controller = new AbortController();
    this.abort = controller;
    const generation = ++this.generation;
    const image = this.canvas.image;
    const select = this.host.querySelector('[data-download="size"]');
    const exportButton = this.host.querySelector('[data-download="export"]');
    const original = this.host.querySelector('[data-download="original"]');
    const rights = this.host.querySelector('[data-download="rights"]');
    const rightsUrl = this.getRights();
    rights.hidden = !/^https?:\/\//i.test(rightsUrl || '');
    if (!rights.hidden) rights.href = rightsUrl;
    original.hidden = !this.options.allowOriginal || (!image.infoJsonUrl && !image.staticUrl);
    original.textContent = image.infoJsonUrl ? 'Download full-resolution service image (JPEG)' : 'Download original image';
    original.disabled = true;
    select.innerHTML = '';
    exportButton.disabled = true;
    this.status('Loading available sizes…');
    try {
      let info;
      if (image.infoJsonUrl) {
        info = await loadInfo(image, this.resolveUrl, controller.signal);
      } else {
        const bitmap = await loadBitmap(this.resolveUrl(image.staticUrl, 'image'), controller.signal);
        info = { width: bitmap.width, height: bitmap.height, profile: 'level2', sizes: [{ width: bitmap.width, height: bitmap.height }] };
        bitmap.close();
      }
      if (generation !== this.generation) return;
      this.info = info;
      this.sizes = this.canvas.imageCoversCanvas === false ? [] : downloadSizes(info, this.options);
      select.innerHTML = this.sizes.map((size, index) =>
        `<option value="${index}"${size.reason ? ' disabled' : ''}>${size.width} × ${size.height}${size.full ? ' (full resolution)' : size.advertised ? ' (advertised)' : ''}${size.reason ? ` — ${size.reason}` : ''}</option>`).join('');
      exportButton.disabled = !this.sizes.some((size) => !size.reason);
      original.disabled = restricted(info.width, info.height, this.options) ||
        !withinLimits(info.width, info.height, info, Infinity);
      this.status(!exportButton.disabled ? 'Exports the full image, not the current zoom or annotations. Unavailable sizes show their restriction.' :
        this.canvas.imageCoversCanvas === false ? 'Export is unavailable for images painted on part of a canvas.' :
          'No sizes are available within the service and configured limits.');
    } catch (error) {
      if (error.name !== 'AbortError' && generation === this.generation) this.status(`Cannot load image sizes: ${error.message}`);
    }
  }

  async exportComposite() {
    if (!this.info) return;
    const select = this.host.querySelector('[data-download="size"]');
    const size = this.sizes[Number(select.value)];
    if (!size || size.reason) return this.status('Choose an available output size.');
    const button = this.host.querySelector('[data-download="export"]');
    const generation = ++this.generation;
    this.abort?.abort();
    const controller = new AbortController();
    this.abort = controller;
    const canvasItem = this.canvas;
    const layers = this.getLayers();
    if (layers === null) return this.status('Comparison layers are still loading or failed to load; resolve the curtain errors before exporting.');
    const filters = { ...this.controller.filters };
    const rotation = this.controller.osd.viewport.getRotation();
    button.disabled = true;
    this.host.querySelector('[data-download="original"]').disabled = true;
    this.status('Preparing image…');
    const bitmaps = [];
    try {
      const images = [{ image: canvasItem.image }, ...layers];
      for (const entry of images) {
        let url;
        if (entry.image.infoJsonUrl) {
          const info = entry.image === canvasItem.image ? this.info : await loadInfo(entry.image, this.resolveUrl, controller.signal);
          url = imageRequestUrl(entry.image, info, size);
        } else {
          url = entry.image.staticUrl;
        }
        bitmaps.push(await loadBitmap(this.resolveUrl(url, 'image'), controller.signal));
      }
      if (generation !== this.generation) return;
      const composite = document.createElement('canvas');
      composite.width = size.width;
      composite.height = size.height;
      const ctx = composite.getContext('2d');
      if (!ctx) throw new Error('Canvas rendering is unavailable.');
      ctx.drawImage(bitmaps[0], 0, 0, size.width, size.height);
      layers.forEach((layer, index) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, size.width * (layer.horizontal ? 1 : layer.clip), size.height * (layer.horizontal ? layer.clip : 1));
        ctx.clip();
        ctx.drawImage(bitmaps[index + 1], 0, 0, size.width, size.height);
        ctx.restore();
      });
      const degrees = ((rotation % 360) + 360) % 360;
      if (![0, 90, 180, 270].includes(degrees)) throw new Error('Only right-angle rotations can be exported.');
      const output = document.createElement('canvas');
      output.width = degrees % 180 ? size.height : size.width;
      output.height = degrees % 180 ? size.width : size.height;
      const out = output.getContext('2d');
      if (!out) throw new Error('Canvas rendering is unavailable.');
      out.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%)${filters.invert ? ' invert(1)' : ''}${filters.grayscale ? ' grayscale(1)' : ''}`;
      out.translate(output.width / 2, output.height / 2);
      out.rotate(degrees * Math.PI / 180);
      out.drawImage(composite, -size.width / 2, -size.height / 2);
      const blob = await outputBlob(output);
      if (generation !== this.generation) return;
      this.save(blob, 'iiif-image.png');
      this.status('Download ready.');
    } catch (error) {
      if (error.name !== 'AbortError' && generation === this.generation) this.status(`Download failed: ${error.message}`);
    } finally {
      bitmaps.forEach((bitmap) => bitmap.close());
      if (generation === this.generation) {
        button.disabled = false;
        this.host.querySelector('[data-download="original"]').disabled =
          restricted(this.info.width, this.info.height, this.options) ||
          !withinLimits(this.info.width, this.info.height, this.info, Infinity);
      }
    }
  }

  async downloadOriginal() {
    if (!this.info || !this.options.allowOriginal || restricted(this.info.width, this.info.height, this.options) ||
        !withinLimits(this.info.width, this.info.height, this.info, Infinity)) {
      return this.status('Full-resolution download is unavailable within the service and configured limits.');
    }
    const generation = ++this.generation;
    this.abort?.abort();
    const controller = new AbortController();
    this.abort = controller;
    this.host.querySelector('[data-download="original"]').disabled = true;
    this.host.querySelector('[data-download="export"]').disabled = true;
    this.status('Downloading original image…');
    try {
      const image = this.canvas.image;
      const url = image.infoJsonUrl ? imageRequestUrl(image, this.info, this.info) : image.staticUrl;
      const response = await fetch(this.resolveUrl(url, 'image'), { signal: controller.signal });
      if (!response.ok) throw new Error(`Image request returned HTTP ${response.status}.`);
      const blob = await response.blob();
      if (generation !== this.generation) return;
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/tiff': 'tif', 'image/gif': 'gif' }[blob.type] || 'bin';
      this.save(blob, `${image.infoJsonUrl ? 'iiif-full-resolution' : 'iiif-original'}.${ext}`);
      this.status(image.infoJsonUrl ? 'Full-resolution service image ready.' : 'Original image ready.');
    } catch (error) {
      if (error.name !== 'AbortError' && generation === this.generation) this.status(`Download failed: ${error.message}`);
    } finally {
      if (generation === this.generation) {
        this.host.querySelector('[data-download="original"]').disabled = false;
        this.host.querySelector('[data-download="export"]').disabled = !this.sizes?.some((size) => !size.reason);
      }
    }
  }

  save(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  destroy() {
    this.abort?.abort();
    this.generation += 1;
    this.button.removeEventListener('click', this.onButton);
    this.host.removeEventListener('click', this.onClick);
    this.wrapper.removeEventListener('click', this.onOtherTool);
    this.toolbar.innerHTML = '';
    this.toolbar.hidden = true;
    this.host.hidden = true;
  }
}
