export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function sanitizeHtml(dirty) {
  if (!dirty) return '';
  const template = document.createElement('template');
  template.innerHTML = String(dirty);

  const allowedTags = new Set([
    'A', 'B', 'STRONG', 'I', 'EM', 'U', 'P', 'BR', 'SPAN', 'UL', 'OL', 'LI', 'SUB', 'SUP',
  ]);

  const walk = (node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!allowedTags.has(child.tagName)) {
          walk(child);
          child.replaceWith(...child.childNodes);
          continue;
        }

        for (const attr of Array.from(child.attributes)) {
          if (child.tagName === 'A' && attr.name.toLowerCase() === 'href') {
            const val = attr.value.trim();
            if (!/^(https?:|mailto:|\/|#)/i.test(val)) {
              child.removeAttribute(attr.name);
            }
          } else {
            child.removeAttribute(attr.name);
          }
        }

        if (child.tagName === 'A' && child.hasAttribute('href')) {
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noopener noreferrer');
          child.className = 'text-cyan-700 dark:text-cyan-400 hover:underline';
        }

        walk(child);
      }
    }
  };

  walk(template.content);
  return template.innerHTML;
}

export function renderShell({ showUrlInput, currentUrl, height }) {
  const urlBar = showUrlInput
    ? `
      <form data-el="url-form" class="flex items-center gap-1.5 flex-1 max-w-md mx-2">
        <input
          type="url"
          data-el="url-input"
          value="${escapeHtml(currentUrl)}"
          placeholder="https://media.getty.edu/iiif/manifest/3/..."
          class="w-full px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
        />
        <button type="submit" class="px-2.5 py-1 text-xs font-medium rounded bg-purple-600 hover:bg-purple-500 text-white transition shrink-0">
          Load
        </button>
      </form>
    `
    : '';

  return `
    <div data-el="viewer-root" style="height: ${escapeHtml(height)}; min-height: 540px;" class="w-full rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-lg flex flex-col overflow-hidden text-slate-800 dark:text-slate-200">
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

        <div class="flex items-center gap-1.5">
          <!-- Zoom Controls (2D Canvas) -->
          <div data-el="zoom-controls" class="inline-flex rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 divide-x divide-slate-200 dark:divide-slate-700">
            <button type="button" data-action="zoom-in" title="Zoom In" class="px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition">+</button>
            <button type="button" data-action="zoom-out" title="Zoom Out" class="px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition">&minus;</button>
            <button type="button" data-action="zoom-home" title="Reset View" class="px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition">Reset</button>
            <button type="button" data-action="rotate" title="Rotate 90°" class="px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition">&#8635;</button>
          </div>

          <button type="button" data-action="toggle-sidebar" title="Toggle Info Panel" aria-expanded="false" class="px-2.5 py-1 text-xs font-medium rounded bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 aria-expanded:bg-purple-600 aria-expanded:hover:bg-purple-500 aria-expanded:border-purple-600 aria-expanded:text-white transition">
            Info
          </button>

          <button type="button" data-action="toggle-fullscreen" title="Toggle Fullscreen" aria-label="Toggle Fullscreen" class="p-1.5 rounded text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition">
            <svg data-icon="enter-fullscreen" class="w-4 h-4 block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <svg data-icon="exit-fullscreen" class="w-4 h-4 hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4H4m0 0l5 5M15 9V4h5m0 0l-5 5M9 15v5H4m0 0l5-5m6 0v5h5m0 0l-5-5" />
            </svg>
          </button>

          <button type="button" data-action="toggle-theme" title="Toggle Light/Dark Mode" class="p-1.5 rounded text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition">
            <svg class="w-4 h-4 hidden dark:block text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg class="w-4 h-4 block dark:hidden text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Main Workspace -->
      <div class="relative flex-1 min-h-0 flex overflow-hidden">
        <!-- Deep Zoom 2D & 3D Viewport -->
        <div class="relative flex-1 min-w-0 bg-slate-100 dark:bg-slate-950 flex flex-col">
          <div data-el="osd-container" class="w-full h-full"></div>
          <div data-el="scene-container" class="hidden w-full h-full overflow-hidden"></div>

          <!-- Loading Overlay -->
          <div data-el="loading-box" class="hidden absolute inset-0 z-20 flex items-center justify-center bg-white/85 dark:bg-slate-950/85 backdrop-blur-xs text-sm font-medium text-slate-600 dark:text-slate-300">
            Loading IIIF Manifest...
          </div>

          <!-- Error Box -->
          <div data-el="error-box" class="hidden absolute top-4 left-4 right-4 z-20 p-3 rounded-lg bg-red-50 dark:bg-red-950/80 border border-red-300 dark:border-red-800 text-xs text-red-700 dark:text-red-200"></div>

          <!-- Empty State -->
          <div data-el="empty-state" class="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-sm text-slate-500 dark:text-slate-400">
            <p class="font-medium">No IIIF Manifest loaded</p>
            <p class="text-xs mt-1">Enter a IIIF Presentation 2.0, 3.0, or 4.0 manifest URL above or call <code class="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800">loadManifest()</code>.</p>
          </div>

          <!-- Prev / Next Canvas Floating Controls -->
          <div data-el="pager-controls" class="hidden absolute bottom-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow-md backdrop-blur-xs text-xs">
            <button type="button" data-action="prev-canvas" class="font-semibold hover:text-purple-600 dark:hover:text-purple-400 px-1">&larr; Prev</button>
            <span data-el="canvas-counter" class="font-mono text-[11px] text-slate-500 dark:text-slate-400">1 / 1</span>
            <button type="button" data-action="next-canvas" class="font-semibold hover:text-purple-600 dark:hover:text-purple-400 px-1">Next &rarr;</button>
          </div>
        </div>

        <!-- Right Metadata / Index / Annotations Sidebar (Overlay drawer on < md, docked on md+) -->
        <aside data-el="sidebar" class="absolute inset-y-0 right-0 z-30 w-80 max-w-[85vw] md:static md:z-auto md:max-w-none shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 shadow-2xl md:shadow-none flex flex-col overflow-hidden">
          <div class="shrink-0 flex items-center border-b border-slate-200 dark:border-slate-800 text-xs font-medium">
            <button type="button" data-tab="metadata" class="flex-1 py-2.5 text-center border-b-2 transition">Metadata</button>
            <button type="button" data-tab="structures" class="flex-1 py-2.5 text-center border-b-2 transition">Index</button>
            <button type="button" data-tab="annotations" class="flex-1 py-2.5 text-center border-b-2 transition">Notes</button>
            <button type="button" data-action="toggle-sidebar" title="Close Info Panel" aria-label="Close Info Panel" class="md:hidden px-3 py-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">&times;</button>
          </div>
          <div data-el="sidebar-content" class="iiif-scroll flex-1 overflow-y-auto p-4 text-xs space-y-4"></div>
        </aside>
      </div>

      <!-- Bottom Thumbnail Strip (shown for multi-canvas / 2D+3D manifests) -->
      <div data-el="filmstrip" class="hidden iiif-scroll shrink-0 h-24 px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2.5 overflow-x-auto"></div>
    </div>
  `;
}

export function renderMetadataTab(manifest, currentCanvas) {
  const metaRows = manifest.metadata
    .map(
      (m) => `
      <div class="border-b border-slate-100 dark:border-slate-800/80 pb-2">
        <dt class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">${escapeHtml(m.label)}</dt>
        <dd class="text-slate-800 dark:text-slate-200 mt-0.5 break-words whitespace-pre-line [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4">${sanitizeHtml(m.value)}</dd>
      </div>`
    )
    .join('');

  const links = [...(manifest.homepage || []), ...(manifest.seeAlso || [])];
  const linksHtml = links.length
    ? `<div class="space-y-1.5">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Related Endpoints</span>
        <div class="flex flex-col gap-1">
          ${links
            .map(
              (l) => `
              <a href="${escapeHtml(l.id)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-cyan-700 dark:text-cyan-400 hover:border-cyan-500/50 transition">
                <span class="truncate font-medium">${escapeHtml(l.label)}</span>
                <span class="text-[10px] font-mono text-slate-400 shrink-0">&nearr;</span>
              </a>`
            )
            .join('')}
        </div>
      </div>`
    : '';

  return `
    <div class="space-y-3">
      <div>
        <h4 class="text-sm font-bold text-slate-900 dark:text-white">${escapeHtml(manifest.label)}</h4>
        ${manifest.summary ? `<div class="text-slate-600 dark:text-slate-400 mt-1 leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0">${sanitizeHtml(manifest.summary)}</div>` : ''}
      </div>

      ${
        currentCanvas
          ? `<div class="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[10px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                  ${currentCanvas.kind === 'scene' ? 'Current 3D Scene' : 'Current Canvas'}
                </span>
                ${
                  currentCanvas.kind === 'scene'
                    ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">GLB / 3D</span>`
                    : ''
                }
              </div>
              <span class="font-medium text-slate-900 dark:text-slate-100 block mt-0.5">${escapeHtml(currentCanvas.label)}</span>
              ${
                currentCanvas.image.width && currentCanvas.image.height
                  ? `<span class="block text-[10px] font-mono text-slate-500 mt-0.5">${currentCanvas.image.width} &times; ${currentCanvas.image.height} px</span>`
                  : ''
              }
            </div>`
          : ''
      }

      ${metaRows ? `<dl class="space-y-2.5">${metaRows}</dl>` : ''}

      ${linksHtml}

      ${
        manifest.attribution
          ? `<div class="p-2.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
              <strong class="block text-slate-700 dark:text-slate-300 mb-0.5">Attribution</strong>
              <div>${sanitizeHtml(manifest.attribution)}</div>
            </div>`
          : ''
      }

      ${
        manifest.rights
          ? `<div>
              <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Rights / License</span>
              <a href="${escapeHtml(manifest.rights)}" target="_blank" rel="noopener noreferrer" class="text-cyan-700 dark:text-cyan-400 hover:underline break-all">${escapeHtml(manifest.rights)}</a>
            </div>`
          : ''
      }
    </div>
  `;
}

export function renderStructuresTab(structures, activeCanvasIndex) {
  if (!structures.length) {
    return `<p class="text-slate-500 dark:text-slate-400 italic">This manifest does not define structural ranges or a table of contents.</p>`;
  }

  return `
    <div class="space-y-1">
      ${structures
        .map((s) => {
          const isCurrent = s.canvasIndex === activeCanvasIndex;
          return `
            <button
              type="button"
              data-canvas-index="${s.canvasIndex}"
              class="w-full text-left px-2.5 py-2 rounded-md transition flex items-center justify-between gap-2 ${
                isCurrent
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }"
            >
              <span class="truncate">${escapeHtml(s.label)}</span>
              <span class="text-[10px] font-mono opacity-75 shrink-0">p.${s.canvasIndex + 1}</span>
            </button>`;
        })
        .join('')}
    </div>
  `;
}

export function renderAnnotationsTab(currentCanvas) {
  const annos = currentCanvas?.annotations || [];
  if (!annos.length) {
    return `<p class="text-slate-500 dark:text-slate-400 italic">No transcriptions or annotations attached to this canvas.</p>`;
  }

  return `
    <div class="space-y-2.5">
      ${annos
        .map(
          (a) => `
          <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                ${escapeHtml(a.motivation)}
              </span>
              ${a.xywh ? `<span class="text-[10px] font-mono text-slate-400">xywh: ${a.xywh.join(',')}</span>` : ''}
            </div>
            <div class="text-slate-800 dark:text-slate-200 leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0">${sanitizeHtml(a.text)}</div>
          </div>`
        )
        .join('')}
    </div>
  `;
}