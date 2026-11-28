export class FullscreenController {
  constructor(wrapper, { height = '680px', onResize = () => {}, host = wrapper } = {}) {
    this.wrapper = wrapper;
    this.host = host;
    this.height = height;
    this.onResize = onResize;
    this.isFullscreen = false;
    this.destroyed = false;
    this.fallback = false;

    this._onFullscreenChange = this.handleFullscreenChange.bind(this);
    this._onKeyDown = this.handleKeyDown.bind(this);

    document.addEventListener('fullscreenchange', this._onFullscreenChange);
    document.addEventListener('keydown', this._onKeyDown);
  }

  async enter() {
    if (this.isFullscreen || this.destroyed) return;

    if (this.host.requestFullscreen && document.fullscreenEnabled) {
      try {
        await this.host.requestFullscreen();
      } catch {
        if (this.destroyed) return;
        // Fallback for sandboxed iframes
        this.fallback = true;
        this.applyStyles(true);
        return;
      }
      if (this.destroyed && document.fullscreenElement === this.host && document.exitFullscreen) {
        await document.exitFullscreen();
      }
      return;
    }

    this.fallback = true;
    this.applyStyles(true);
  }

  async exit() {
    if (!this.isFullscreen) return;

    if (document.fullscreenElement === this.host && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
        return;
      } catch {
        // Fallback
      }
    }

    this.fallback = false;
    this.applyStyles(false);
  }

  toggle() {
    return this.isFullscreen ? this.exit() : this.enter();
  }

  handleFullscreenChange() {
    if (this.fallback) return;
    const active = document.fullscreenElement === this.host;
    this.applyStyles(active);
  }

  handleKeyDown(e) {
    if (e.key === 'Escape' && this.isFullscreen && !document.fullscreenElement) {
      this.exit();
    }
  }

  applyStyles(active) {
    this.isFullscreen = active;
    const root = this.wrapper.querySelector('[data-el="viewer-root"]');
    const enterIcon = this.wrapper.querySelector('[data-icon="enter-fullscreen"]');
    const exitIcon = this.wrapper.querySelector('[data-icon="exit-fullscreen"]');

    if (root) {
      if (active) {
        this.wrapper.classList.add('fixed', 'inset-0', 'z-50');
        root.style.height = '100vh';
        root.classList.remove('rounded-xl', 'border');
      } else {
        this.wrapper.classList.remove('fixed', 'inset-0', 'z-50');
        root.style.height = this.height;
        root.classList.add('rounded-xl', 'border');
      }
    }

    enterIcon?.classList.toggle('hidden', active);
    exitIcon?.classList.toggle('hidden', !active);
    this.wrapper.querySelector('[data-action="toggle-fullscreen"]')?.setAttribute('aria-pressed', String(active));

    requestAnimationFrame(() => {
      if (!this.destroyed) this.onResize();
    });
  }

  destroy() {
    document.removeEventListener('fullscreenchange', this._onFullscreenChange);
    document.removeEventListener('keydown', this._onKeyDown);
    if (this.isFullscreen) {
      this.exit();
    }
    this.destroyed = true;
  }
}