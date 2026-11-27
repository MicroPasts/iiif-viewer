const DEFAULT_WIDTH = 320;
const MIN_PANE_WIDTH = 240;
const STEP = 24;

export class SidebarResizer {
  constructor(wrapper, onResize) {
    this.sidebar = wrapper.querySelector('[data-el="sidebar"]');
    this.workspace = wrapper.querySelector('[data-el="workspace"]');
    this.handle = wrapper.querySelector('[data-el="sidebar-resizer"]');
    this.onResize = onResize;
    this.desiredWidth = DEFAULT_WIDTH;
    this.lastSidebarWidth = null;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    this.handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      this.handle.focus();
      this.drag = { pointerId: event.pointerId, x: event.clientX, width: this.sidebar.getBoundingClientRect().width };
      this.handle.setPointerCapture(event.pointerId);
    }, { signal });
    this.handle.addEventListener('pointermove', (event) => {
      if (this.drag?.pointerId === event.pointerId) {
        this.setWidth(this.drag.width + this.drag.x - event.clientX);
      }
    }, { signal });
    const endDrag = (event) => {
      if (this.drag?.pointerId === event.pointerId) this.drag = null;
    };
    this.handle.addEventListener('pointerup', endDrag, { signal });
    this.handle.addEventListener('pointercancel', endDrag, { signal });
    this.handle.addEventListener('lostpointercapture', endDrag, { signal });
    this.handle.addEventListener('keydown', (event) => {
      const { min, max } = this.bounds();
      const current = this.actualWidth();
      const widths = { ArrowLeft: current + STEP, ArrowRight: current - STEP, Home: min, End: max };
      if (!Object.hasOwn(widths, event.key)) return;
      event.preventDefault();
      this.setWidth(widths[event.key]);
    }, { signal });
    this.sidebar.addEventListener('click', (event) => {
      const action = event.target.closest('[data-sidebar-size]')?.dataset.sidebarSize;
      if (action === 'reset') this.setWidth(DEFAULT_WIDTH);
      if (action === 'narrow') this.setWidth(this.actualWidth() - STEP);
      if (action === 'wide') this.setWidth(this.actualWidth() + STEP);
    }, { signal });
    this.observer = new ResizeObserver(() => this.update());
    this.observer.observe(this.workspace);
    this.observer.observe(this.sidebar);
    this.update();
  }

  bounds() {
    const width = this.workspace.clientWidth;
    const min = Math.min(MIN_PANE_WIDTH, Math.floor(width / 2));
    return { min, max: Math.max(min, width - min) };
  }

  actualWidth() {
    const { min, max } = this.bounds();
    return Math.max(min, Math.min(max, this.desiredWidth));
  }

  setWidth(width) {
    const { min, max } = this.bounds();
    this.desiredWidth = Math.max(min, Math.min(max, Math.round(width)));
    this.update();
  }

  update() {
    const { min, max } = this.bounds();
    const width = this.actualWidth();
    this.sidebar.style.setProperty('--iiif-sidebar-width', `${width}px`);
    this.handle.setAttribute('aria-valuemin', String(min));
    this.handle.setAttribute('aria-valuemax', String(max));
    this.handle.setAttribute('aria-valuenow', String(width));
    this.handle.setAttribute('aria-valuetext', `${width} pixels`);
    const renderedWidth = this.sidebar.getBoundingClientRect().width;
    if (renderedWidth !== this.lastSidebarWidth) {
      this.lastSidebarWidth = renderedWidth;
      this.onResize();
    }
  }

  destroy() {
    this.observer.disconnect();
    this.abortController.abort();
  }
}
