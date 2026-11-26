export class FullscreenController {
  constructor(wrapper, { height = '680px', onResize = () => {} } = {}) {
    this.wrapper = wrapper;
    this.height = height;
    this.onResize = onResize;
    this.isFullscreen = false;

    this._onFullscreenChange = this.handleFullscreenChange.bind(this);
    this._onKeyDown = this.handleKeyDown.bind(this);

    document.addEventListener('fullscreenchange', this._onFullscreenChange);
    document.addEventListener('keydown', this._onKeyDown);
  }

  async enter() {
    if (this.isFullscreen) return;

    if (this.wrapper.requestFullscreen && document.fullscreenEnabled) {
      try {
        await this.wrapper.requestFullscreen();
        return;
      } catch {
        // Fallback for sandboxed iframes
      }
    }

    this.applyStyles(true);
  }

  async exit() {
    if (!this.isFullscreen) return;

    if (document.fullscreenElement === this.wrapper && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
        return;
      } catch {
        // Fallback
      }
    }

    this.applyStyles(false);
  }

  toggle() {
    return this.isFullscreen ? this.exit() : this.enter();
  }

  handleFullscreenChange() {
    const active = document.fullscreenElement === this.wrapper;
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

    requestAnimationFrame(() => this.onResize());
  }

  destroy() {
    document.removeEventListener('fullscreenchange', this._onFullscreenChange);
    document.removeEventListener('keydown', this._onKeyDown);
    if (this.isFullscreen) {
      this.exit();
    }
  }
}