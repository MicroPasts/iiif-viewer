import { escapeHtml } from './sanitize.js';

export class Filmstrip {
  constructor(wrapper, { onSelectCanvas = () => {} } = {}) {
    this.wrapper = wrapper;
    this.onSelectCanvas = onSelectCanvas;

    const strip = this.wrapper.querySelector('[data-el="filmstrip"]');
    strip?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-canvas-index]');
      if (btn) {
        this.onSelectCanvas(parseInt(btn.dataset.canvasIndex, 10));
      }
    });
  }

  render(canvases = [], resolveUrl = (u) => u) {
    const strip = this.wrapper.querySelector('[data-el="filmstrip"]');
    if (!strip) return;

    if (canvases.length <= 1) {
      strip.classList.add('hidden');
      strip.innerHTML = '';
      return;
    }

    strip.classList.remove('hidden');
    strip.innerHTML = canvases
      .map((c) => {
        const thumbUrl = c.image.thumbnail ? resolveUrl(c.image.thumbnail, 'thumbnail') : null;
        return `
        <button
          type="button"
          data-canvas-index="${c.index}"
          title="${escapeHtml(c.label)}"
          aria-label="${escapeHtml(c.label)}, ${c.kind === 'scene' ? '3D scene' : c.kind === 'media' ? c.media.type : 'canvas'} ${c.index + 1}"
          class="group relative h-18 w-16 shrink-0 rounded-md overflow-hidden border-2 border-transparent bg-slate-200 dark:bg-slate-800 transition focus:outline-hidden"
        >
          ${
            thumbUrl
              ? `<img src="${escapeHtml(thumbUrl)}" alt="" class="w-full h-full object-cover" loading="lazy" />`
              : `<span class="text-[10px] text-slate-700 dark:text-slate-300 p-1 block truncate">${escapeHtml(c.label)}</span>`
          }
          ${
            c.kind === 'scene'
              ? `<span class="absolute top-1 right-1 px-1 rounded bg-amber-500 text-slate-950 text-[8px] font-bold">3D</span>`
              : c.kind === 'media' ? `<span class="absolute top-1 right-1 px-1 rounded bg-amber-500 text-slate-950 text-[8px] font-bold">${c.media.type === 'audio' ? 'AUDIO' : 'VIDEO'}</span>` : ''
          }
          <span class="absolute bottom-0 inset-x-0 bg-slate-950/75 text-white text-[9px] font-mono px-1 truncate">
            ${c.index + 1}
          </span>
        </button>`;
      })
      .join('');
  }

  setActive(activeIndex) {
    const strip = this.wrapper.querySelector('[data-el="filmstrip"]');
    if (!strip) return;

    strip.querySelectorAll('[data-canvas-index]').forEach((btn) => {
      const idx = parseInt(btn.dataset.canvasIndex, 10);
      const isCurrent = idx === activeIndex;
      if (isCurrent) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
      btn.classList.toggle('border-purple-500', isCurrent);
      btn.classList.toggle('border-transparent', !isCurrent);
      if (isCurrent) {
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        btn.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  }
}