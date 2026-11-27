import OpenSeadragon from 'openseadragon';
import { preserveSecureTileUrls } from './iiif-tile-source.js';

export class OsdController {
  constructor(element, { onAnnotationClick = null, onTransformChange = null } = {}) {
    this.element = element;
    this.onAnnotationClick = onAnnotationClick;
    this.onTransformChange = onTransformChange;
    this.overlays = [];
    this.pendingAnnotationHandler = null;
    this.pendingAnnotations = [];
    this.pendingFocus = null;
    this.imageGeneration = 0;
    this.awaitingImage = false;
    this.showAnnotations = true;
    this.transform = { rotation: 0, flipHorizontal: false, flipVertical: false };
    this.filters = {
      brightness: 100,
      contrast: 100,
      invert: false,
      grayscale: false,
    };

    this.osd = OpenSeadragon({
      element: this.element,
      showNavigationControl: false,
      crossOriginPolicy: 'Anonymous',
      animationTime: 0.4,
      blendTime: 0.1,
      maxZoomPixelRatio: 2.5,
      visibilityRatio: 0.8,
      constrainDuringPan: true,
    });
    this.osd.canvas.setAttribute('role', 'group');
    this.osd.canvas.setAttribute('aria-label', 'Image viewer. Use arrow keys to pan and plus or minus to zoom.');
    this.onRotate = ({ degrees }) => {
      if (this.applyingTransform) return;
      const { flipHorizontal, flipVertical } = this.transform;
      const angle = flipHorizontal !== flipVertical ? -degrees : degrees;
      this.transform.rotation = ((angle - (flipVertical ? 180 : 0)) % 360 + 360) % 360;
      this.onTransformChange?.(this.transform);
    };
    this.onFlip = () => {
      if (this.applyingTransform) return;
      const quarterTurns = this.transform.rotation / 90;
      const axis = Number.isInteger(quarterTurns) && quarterTurns % 2 ? 'flipVertical' : 'flipHorizontal';
      this.transform[axis] = !this.transform[axis];
      if (!Number.isInteger(quarterTurns)) this.transform.rotation = (360 - this.transform.rotation) % 360;
      this.onTransformChange?.(this.transform);
    };
    this.osd.addHandler('rotate', this.onRotate);
    this.osd.addHandler('flip', this.onFlip);
  }

  open(tileSource, annotations = [], focusAnnotation = null) {
    this.clearAnnotations();
    const generation = this.imageGeneration;
    this.pendingAnnotations = annotations.filter((a) => Array.isArray(a.xywh) && a.xywh.length === 4);
    this.pendingFocus = focusAnnotation;
    this.awaitingImage = true;
    const handler = () => {
      if (this.pendingAnnotationHandler !== handler) return;
      this.cancelPendingAnnotationHandler();
      this.awaitingImage = false;
      const annotations = this.pendingAnnotations;
      this.pendingAnnotations = [];
      const focus = this.pendingFocus;
      this.pendingFocus = null;
      preserveSecureTileUrls(this.osd.world.getItemAt(0), tileSource);
      this.renderAnnotationOverlays(annotations);
      if (focus && this.imageGeneration === generation) this.focusAnnotation(focus);
    };
    this.pendingAnnotationHandler = handler;
    this.osd.addHandler('open', handler);
    this.osd.open(tileSource);
  }

  clearAnnotations() {
    this.imageGeneration += 1;
    this.cancelPendingAnnotationHandler();
    this.pendingAnnotations = [];
    this.pendingFocus = null;
    this.awaitingImage = false;
    this.clearOverlays();
  }

  cancelPendingAnnotationHandler() {
    if (!this.pendingAnnotationHandler) return;
    this.osd.removeHandler('open', this.pendingAnnotationHandler);
    this.pendingAnnotationHandler = null;
  }

  renderAnnotationOverlays(annotations) {
    if (this.awaitingImage) {
      this.pendingAnnotations = annotations;
      return;
    }
    this.clearOverlays();
    const tiledImage = this.osd.world.getItemAt(0);
    if (!tiledImage) return;

    annotations.forEach((anno, idx) => {
      const [x, y, w, h] = anno.xywh;
      const rect = tiledImage.imageToViewportRectangle(x, y, w, h);

      const el = document.createElement('div');
      el.className = 'iiif-anno-overlay';
      el.dataset.annoIndex = String(idx);
      el.title = anno.text.replace(/<[^>]+>/g, '').slice(0, 140);
      el.setAttribute('aria-hidden', 'true');
      if (!this.showAnnotations) {
        el.classList.add('hidden');
        el.style.visibility = 'hidden';
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.focusAnnotation(anno);
        this.onAnnotationClick?.(anno, idx);
      });

      this.osd.addOverlay({ element: el, location: rect });
      this.overlays.push({ element: el, anno, rect });
    });
  }

  focusAnnotation(anno) {
    if (!anno?.xywh || anno.xywh.length !== 4) return;
    if (this.awaitingImage) {
      this.pendingFocus = anno;
      return;
    }
    const tiledImage = this.osd.world.getItemAt(0);
    if (!tiledImage) return;

    const [x, y, w, h] = anno.xywh;
    const rect = tiledImage.imageToViewportRectangle(x, y, w, h);
    // Add slight breathing room around the target region
    const padded = new OpenSeadragon.Rect(
      rect.x - rect.width * 0.25,
      rect.y - rect.height * 0.25,
      rect.width * 1.5,
      rect.height * 1.5
    );
    this.osd.viewport.fitBounds(padded, false);

    this.overlays.forEach(({ element, anno: item }) => {
      element.classList.toggle('is-active', item === anno);
    });
  }

  setAnnotationsVisible(visible) {
    this.showAnnotations = Boolean(visible);
    this.overlays.forEach(({ element }) => {
      element.classList.toggle('hidden', !this.showAnnotations);
      element.style.visibility = this.showAnnotations ? '' : 'hidden';
    });
  }

  clearOverlays() {
    this.overlays.forEach(({ element }) => {
      try {
        this.osd.removeOverlay(element);
      } catch {
        // Ignore if world already cleared
      }
    });
    this.overlays = [];
  }

  zoomBy(factor) {
    this.osd.viewport?.zoomBy(factor);
  }

  panBy(x, y) {
    const viewport = this.osd.viewport;
    if (!viewport) return;
    const bounds = viewport.getBounds(true);
    viewport.panBy(new OpenSeadragon.Point(x * bounds.width * 0.2, y * bounds.height * 0.2));
    viewport.applyConstraints();
  }

  goHome() {
    this.osd.viewport?.goHome();
  }

  rotateBy(deg = 90) {
    this.transform.rotation = ((this.transform.rotation + deg) % 360 + 360) % 360;
    this.applyTransform();
  }

  toggleFlip(axis) {
    const key = axis === 'horizontal' ? 'flipHorizontal' : 'flipVertical';
    this.transform[key] = !this.transform[key];
    this.applyTransform();
  }

  resetTransform() {
    this.transform = { rotation: 0, flipHorizontal: false, flipVertical: false };
    this.applyTransform();
  }

  applyTransform() {
    const { rotation, flipHorizontal, flipVertical } = this.transform;
    const flipped = flipHorizontal !== flipVertical;
    const angle = (rotation + (flipVertical ? 180 : 0)) % 360;
    this.applyingTransform = true;
    try {
      this.osd.viewport.setFlip(flipped);
      this.osd.viewport.setRotation((flipped ? 360 - angle : angle) % 360, true);
    } finally {
      this.applyingTransform = false;
    }
    this.onTransformChange?.(this.transform);
  }

  setFilter(patch) {
    Object.assign(this.filters, patch);
    this.applyFilters();
  }

  resetFilters() {
    this.filters = { brightness: 100, contrast: 100, invert: false, grayscale: false };
    this.applyFilters();
  }

  applyFilters() {
    const canvas = this.osd.canvas;
    if (!canvas) return;
    const { brightness, contrast, invert, grayscale } = this.filters;
    canvas.style.filter = [
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
      invert ? 'invert(1)' : '',
      grayscale ? 'grayscale(1)' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  resize() {
    this.osd.viewport?.resize();
    this.osd.viewport?.applyConstraints();
  }

  destroy() {
    this.clearAnnotations();
    this.osd.removeHandler('rotate', this.onRotate);
    this.osd.removeHandler('flip', this.onFlip);
    this.osd?.destroy();
  }
}