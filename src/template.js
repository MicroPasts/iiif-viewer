import { escapeHtml } from './sanitize.js';
import { SIDEBAR_TABS } from './sidebar-tabs.js';

let nextViewerId = 0;

export function renderShell({ showUrlInput, allowManifestDrop = true, currentUrl, height, inspector = false, permalink = false, resizableSidebar = false, sidebarTabs = SIDEBAR_TABS.map(({ id }) => id), sideBySide = false }) {
  const id = `iiif-viewer-${++nextViewerId}`;
  const urlBar = showUrlInput
    ? `
      <form data-el="url-form" class="flex items-center gap-1.5 flex-1 max-w-md mx-2">
        <input
          type="url"
          data-el="url-input"
          aria-label="IIIF manifest URL"
          value="${escapeHtml(currentUrl)}"
          placeholder="https://media.getty.edu/iiif/manifest/3/..."
          class="w-full px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-600 dark:placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
        />
        <button type="submit" class="px-2.5 py-1 text-xs font-medium rounded bg-purple-600 hover:bg-purple-700 text-white transition shrink-0">
          Load
        </button>
      </form>
    `
    : '';

  return `
    <div data-el="viewer-root" role="region" aria-label="IIIF viewer" aria-describedby="${id}-shortcuts" tabindex="0" style="height: ${escapeHtml(height)}; min-height: 540px;" class="w-full rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-lg flex flex-col overflow-hidden text-slate-800 dark:text-slate-200 focus:outline-hidden">
      <span id="${id}-shortcuts" class="sr-only">When the viewer itself has focus, use left and right arrows to change canvas, plus or minus to zoom, zero to reset, I for the information panel, and F for fullscreen.</span>
      <div data-el="status-message" role="status" class="sr-only"></div>
      <div data-el="error-message" role="alert" class="sr-only"></div>
      <!-- Top Bar -->
      <div class="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90">
        <div class="flex items-center gap-2 min-w-0">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 shrink-0">
            IIIF Viewer
          </span>
          <span data-el="version-badge" class="hidden px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0"></span>
          <span data-el="manifest-title" class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[220px] hidden md:inline"></span>
        </div>

        ${urlBar}

        <div class="flex flex-wrap items-center gap-1.5">
          <!-- Zoom & Image Controls (2D Canvas) -->
          <div data-el="zoom-controls" class="inline-flex rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 divide-x divide-slate-200 dark:divide-slate-700">
            <button type="button" data-action="zoom-in" title="Zoom In (+)" aria-label="Zoom in" class="px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition">+</button>
            <button type="button" data-action="zoom-out" title="Zoom Out (-)" aria-label="Zoom out" class="px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition">&minus;</button>
            <button type="button" data-action="zoom-home" title="Reset View (0)" class="px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition">Reset</button>
            <button type="button" data-action="rotate" title="Rotate 90°" aria-label="Rotate image 90 degrees" class="px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition">&#8635;</button>
            <button type="button" data-action="toggle-filters" title="Image Inspection Filters" aria-expanded="false" aria-controls="${id}-filters" class="px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 aria-expanded:bg-purple-600 aria-expanded:text-white transition">Filters</button>
          </div>

          <div data-el="inspection-buttons" class="iiif-inspection-buttons" role="group" aria-label="Image inspection tools" hidden></div>
          <div data-el="download-button" class="iiif-inspection-buttons" hidden></div>
          ${sideBySide ? `<button type="button" data-action="toggle-compare" aria-expanded="false" aria-controls="${id}-compare" class="px-2.5 py-1 text-xs font-medium rounded bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 aria-expanded:bg-purple-600 aria-expanded:text-white">Compare</button>` : ''}

          ${inspector ? `<button type="button" data-action="toggle-json-inspector" aria-expanded="false" aria-controls="${id}-json-inspector" class="px-2.5 py-1 text-xs font-medium rounded bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 aria-expanded:bg-purple-600 aria-expanded:text-white transition">Inspector</button>` : ''}
          ${permalink ? `<button type="button" data-action="copy-permalink" class="px-2.5 py-1 text-xs font-medium rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">Copy link to current view</button>` : ''}

          <button type="button" data-action="toggle-sidebar" title="Toggle Info Panel (I)" aria-expanded="false" aria-controls="${id}-sidebar" class="px-2.5 py-1 text-xs font-medium rounded bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 aria-expanded:bg-purple-600 aria-expanded:hover:bg-purple-700 aria-expanded:border-purple-600 aria-expanded:text-white transition">
            Info
          </button>

          <button type="button" data-action="toggle-fullscreen" title="Toggle Fullscreen (F)" aria-label="Fullscreen" aria-pressed="false" class="p-1.5 rounded text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition">
            <svg data-icon="enter-fullscreen" aria-hidden="true" class="w-4 h-4 block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <svg data-icon="exit-fullscreen" aria-hidden="true" class="w-4 h-4 hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4H4m0 0l5 5M15 9V4h5m0 0l-5 5M9 15v5H4m0 0l5-5m6 0v5h5m0 0l-5-5" />
            </svg>
          </button>

          <button type="button" data-action="toggle-theme" title="Toggle Light/Dark Mode" aria-label="Dark mode" aria-pressed="false" class="p-1.5 rounded text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition">
            <svg aria-hidden="true" class="w-4 h-4 hidden dark:block text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg aria-hidden="true" class="w-4 h-4 block dark:hidden text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Main Workspace -->
      <div data-el="workspace" class="relative flex-1 min-h-0 flex overflow-hidden">
        ${permalink ? `<div data-el="permalink-status" role="status" class="iiif-permalink-status"></div>` : ''}
        <!-- Deep Zoom 2D & 3D Viewport -->
        <div data-el="comparison-stage" class="iiif-comparison-stage flex-1 min-w-0 min-h-0">
        <div data-el="primary-pane" class="relative min-w-0 min-h-0 bg-slate-100 dark:bg-slate-950 flex flex-col">
          <div data-el="osd-container" class="w-full h-full"></div>
          <div data-el="scene-container" class="hidden w-full h-full overflow-hidden"></div>
          <div id="${id}-inspection" data-el="inspection-tools" class="iiif-inspection-tools" hidden></div>
          <section id="${id}-download" data-el="download-panel" class="iiif-inspection-panel iiif-download-panel" aria-label="Download image" hidden></section>

          <!-- 2D Image Filters Bar -->
          <div id="${id}-filters" data-el="filter-bar" class="hidden absolute top-3 right-3 z-20 p-3 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-lg backdrop-blur-xs text-xs space-y-2.5 w-60">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-slate-700 dark:text-slate-200">Image Inspection</span>
              <button type="button" data-action="reset-filters" class="text-[11px] text-purple-600 dark:text-purple-400 hover:underline">Reset</button>
            </div>
            <div role="group" aria-label="Move image view" class="flex items-center gap-1">
              <span class="mr-1">Pan</span>
              <button type="button" data-action="pan-left" aria-label="Move image view left" class="px-2 rounded border border-slate-300 dark:border-slate-700">&larr;</button>
              <button type="button" data-action="pan-up" aria-label="Move image view up" class="px-2 rounded border border-slate-300 dark:border-slate-700">&uarr;</button>
              <button type="button" data-action="pan-down" aria-label="Move image view down" class="px-2 rounded border border-slate-300 dark:border-slate-700">&darr;</button>
              <button type="button" data-action="pan-right" aria-label="Move image view right" class="px-2 rounded border border-slate-300 dark:border-slate-700">&rarr;</button>
            </div>
            <div role="group" aria-label="Flip image" class="flex items-center gap-2">
              <button type="button" data-action="flip-horizontal" aria-pressed="false" class="flex-1 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 aria-pressed:bg-purple-600 aria-pressed:text-white">Flip horizontal</button>
              <button type="button" data-action="flip-vertical" aria-pressed="false" class="flex-1 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 aria-pressed:bg-purple-600 aria-pressed:text-white">Flip vertical</button>
            </div>
            <label class="block space-y-1">
              <div class="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span>Brightness</span>
                <span data-el="brightness-val" class="font-mono">100%</span>
              </div>
              <input type="range" data-filter="brightness" min="40" max="200" value="100" aria-label="Brightness" aria-valuetext="100%" class="w-full accent-purple-600" />
            </label>
            <label class="block space-y-1">
              <div class="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span>Contrast</span>
                <span data-el="contrast-val" class="font-mono">100%</span>
              </div>
              <input type="range" data-filter="contrast" min="40" max="250" value="100" aria-label="Contrast" aria-valuetext="100%" class="w-full accent-purple-600" />
            </label>
            <div class="flex items-center gap-2 pt-1">
              <button type="button" data-filter-toggle="grayscale" aria-pressed="false" class="flex-1 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 aria-pressed:bg-purple-600 aria-pressed:text-white aria-pressed:border-purple-600 transition">
                Grayscale
              </button>
              <button type="button" data-filter-toggle="invert" aria-pressed="false" class="flex-1 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 aria-pressed:bg-purple-600 aria-pressed:text-white aria-pressed:border-purple-600 transition">
                Invert
              </button>
            </div>
          </div>

          <!-- Loading Overlay -->
          <div data-el="loading-box" class="hidden absolute inset-0 z-20 flex items-center justify-center bg-white/85 dark:bg-slate-950/85 backdrop-blur-xs text-sm font-medium text-slate-600 dark:text-slate-300">
            Loading IIIF Manifest...
          </div>

          <!-- Error Box -->
          <div data-el="error-box" class="hidden absolute top-4 left-4 right-4 z-20 p-3 rounded-lg bg-red-50 dark:bg-red-950/80 border border-red-300 dark:border-red-800 text-xs text-red-700 dark:text-red-200"></div>

          <!-- Empty State -->
          <div data-el="empty-state" class="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-sm text-slate-500 dark:text-slate-400">
            <p class="font-medium">No IIIF Manifest loaded</p>
            <p class="text-xs mt-1">${showUrlInput ? 'Enter a IIIF Presentation 2.0, 3.0, or 4.0 manifest URL above. ' : ''}${allowManifestDrop ? 'Drag a IIIF link here. ' : ''}${showUrlInput || allowManifestDrop ? 'Or call' : 'Call'} <code class="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800">loadManifest()</code>.</p>
          </div>

          <!-- Prev / Next Canvas Floating Controls -->
          <div data-el="pager-controls" class="hidden absolute bottom-3 left-1/2 -translate-x-1/2 z-10 items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow-md backdrop-blur-xs text-xs">
            <button type="button" data-action="prev-canvas" title="Previous Canvas (Left Arrow)" class="font-semibold hover:text-purple-600 dark:hover:text-purple-400 px-1">&larr; Prev</button>
            <span data-el="canvas-counter" class="font-mono text-[11px] text-slate-500 dark:text-slate-400">1 / 1</span>
            <button type="button" data-action="next-canvas" title="Next Canvas (Right Arrow)" class="font-semibold hover:text-purple-600 dark:hover:text-purple-400 px-1">Next &rarr;</button>
          </div>
        </div>
        <section id="${id}-compare" data-el="secondary-pane" class="iiif-secondary-pane" aria-label="Secondary comparison pane" hidden></section>
        </div>

        <!-- Right Metadata / Index / Notes / Search / Map Sidebar -->
        <aside id="${id}-sidebar" data-el="sidebar" aria-label="Viewer information" class="absolute inset-y-0 right-0 z-30 w-80 max-w-[85vw] md:static md:z-auto md:max-w-none shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 shadow-2xl md:shadow-none flex flex-col overflow-hidden ${resizableSidebar ? 'iiif-resizable-sidebar' : ''}">
          <div data-el="compare-context" class="iiif-compare-context" role="status" hidden></div>
          ${resizableSidebar ? `<div data-el="sidebar-resizer" class="iiif-sidebar-resizer" role="separator" aria-label="Information panel width" aria-orientation="vertical" aria-controls="${id}-sidebar" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" tabindex="0" title="Drag to resize the information panel"></div>` : ''}
          <div class="shrink-0 flex items-center border-b border-slate-200 dark:border-slate-800 text-xs font-medium">
            <div role="tablist" aria-label="Information sections" class="iiif-sidebar-tabs flex flex-1">
              ${SIDEBAR_TABS.filter((tab) => sidebarTabs.includes(tab.id)).map((tab) => `<button type="button" role="tab" id="${id}-tab-${tab.id}" aria-controls="${id}-panel" data-tab="${tab.id}" class="flex-1 py-2.5 text-center border-b-2 transition">${tab.label}</button>`).join('')}
            </div>
            <button type="button" data-action="toggle-sidebar" title="Close Info Panel" aria-label="Close Info Panel" class="md:hidden px-3 py-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200 transition">&times;</button>
          </div>
          <div id="${id}-panel" data-el="sidebar-content" role="tabpanel" tabindex="0" class="iiif-scroll flex-1 overflow-y-auto p-4 text-xs space-y-4"></div>
          ${resizableSidebar ? `<details class="iiif-sidebar-size-settings">
            <summary>Panel width</summary>
            <div class="iiif-sidebar-size-controls" role="group" aria-label="Information panel width">
              <button type="button" data-sidebar-size="narrow" aria-label="Make information panel narrower" title="Make information panel narrower">&minus;</button>
              <button type="button" data-sidebar-size="reset" aria-label="Reset information panel width" title="Reset information panel width">Reset</button>
              <button type="button" data-sidebar-size="wide" aria-label="Make information panel wider" title="Make information panel wider">+</button>
            </div>
          </details>` : ''}
        </aside>
        ${inspector ? `<aside id="${id}-json-inspector" data-el="json-inspector" class="iiif-json-inspector" aria-label="IIIF JSON inspector" hidden></aside>` : ''}
      </div>

      <!-- Bottom Thumbnail Strip -->
      <div data-el="filmstrip" role="group" aria-label="Canvas thumbnails" class="hidden iiif-scroll shrink-0 h-24 px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2.5 overflow-x-auto"></div>
    </div>
  `;
}