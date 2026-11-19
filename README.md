# IIIF Viewer (`@micropasts/iiif-viewer`)

A standalone, framework-agnostic deep-zoom viewer for **IIIF Presentation API 2.0/2.1 and 3.0** manifests and cultural heritage collections.

Built on **OpenSeadragon** and bundled **Tailwind CSS v4**—requiring no external CDN scripts or host-framework CSS setup.

* **Live Demo:** https://micropasts.github.io/iiif-viewer/
* **Repository:** https://github.com/micropasts/iiif-viewer
* **Author:** Daniel Pett ([MicroPasts](https://github.com/micropasts))

## Features

* **IIIF Presentation 2.0 & 3.0 Support:** Automatically detects and normalizes both IIIF Presentation 2.0/2.1 (`sequences` / `canvases` / `@id`) and Presentation 3.0 (`items` / `AnnotationPage` / language maps) manifests.
* **Deep-Zoom OpenSeadragon Canvas:** Supports tiled IIIF Image API 2.0 & 3.0 (`info.json`) endpoints with smooth pan, zoom, reset, and 90° rotation controls, plus automatic fallback to static image URLs when no tile service is defined.
* **Multi-Canvas Navigation & Filmstrip:** Includes floating previous/next canvas pagination (`1 / N`) and a scrollable bottom thumbnail strip for multi-page books, manuscripts, and multi-angle object photography.
* **Synchronized Sidebar Inspector:**
  * **Metadata Tab:** Displays manifest-level and active-canvas metadata, summaries, attribution statements, and license/rights links with safe HTML sanitization (`sanitizeHtml`) for formatted descriptions and external links.
  * **Index Tab:** Renders structural `structures` / `ranges` (table of contents) for one-click navigation to specific pages or sections.
  * **Notes Tab:** Displays canvas-level Web Annotations and transcriptions (`painting`, `commenting`, `transcribing`).
* **CORS-Friendly Fetching & Proxy Support:** Sends simple `GET` requests by default to avoid triggering unnecessary CORS preflight `OPTIONS` rejections on museum servers, with optional `proxyUrl` and `fetchOptions` configuration.
* **Scoped Light & Dark Mode:** Bundled Tailwind CSS with a built-in header theme toggle scoped to the viewer wrapper so it operates independently of your host application's theme.

## Installation

Install the package via npm:

```bash
npm install @micropasts/iiif-viewer
```

## Quick Start

Import both the `IIIFViewer` class and its bundled stylesheet:

```javascript
import { IIIFViewer } from '@micropasts/iiif-viewer';
import '@micropasts/iiif-viewer/style.css';

// Initialize the viewer from a IIIF Presentation 2.0 or 3.0 manifest URL
const viewer = new IIIFViewer('#iiif-viewer', {
  manifestUrl: 'https://iiif.vam.ac.uk/collections/O24955/manifest.json',
  theme: 'dark',
  height: '680px',
});
```

Ensure your HTML contains the target mount element:

```html
<div id="iiif-viewer"></div>
```

## How It Works

When a manifest is passed via `manifestUrl` or `setManifest()`, `parseIIIFManifest()` normalizes version-specific IIIF structures into a unified internal model:

1. **Version & Language Map Normalization:** Inspects `@context`, `type`, and `items` vs. `sequences` to distinguish Presentation 3.0 from 2.x, resolving language maps (`{ "en": ["..."] }`, `@language`/`@value` arrays, and plain strings) via `extractLangValue()`.
2. **Canvas & Image Service Extraction:** Resolves painting annotations on each canvas to locate the IIIF Image API service endpoint (`info.json`) for deep tile zooming, generates `!200,200` thumbnails for the filmstrip, and falls back to direct static image URLs if no image service is advertised.
3. **HTML Sanitization:** Metadata values, summaries, attribution statements, and annotations often contain embedded HTML (`<a>`, `<p>`, `<br>`, `<em>`, `<ul>`). Before rendering into the sidebar, `sanitizeHtml()` strips disallowed tags and attributes while preserving safe formatting and enforcing `target="_blank" rel="noopener noreferrer"` on links.
4. **Structural Ranges & Annotations:** Maps `structures` ranges back to canvas indices for the **Index** tab and extracts canvas-attached `annotations` (v3) or `otherContent` (v2) for the **Notes** tab.

## Usage Patterns

### 1. Load from a Pre-Parsed Manifest Object or JSON String

Pass a manifest object or JSON string directly via `manifest` (or `data`) at initialization, or update an active viewer with `setManifest()`:

```javascript
import { IIIFViewer } from '@micropasts/iiif-viewer';
import '@micropasts/iiif-viewer/style.css';

const viewer = new IIIFViewer('#iiif-viewer', {
  manifest: myManifestObject,
  showUrlInput: false,
  theme: 'light',
});

// Swap in a different manifest later
viewer.setManifest(anotherManifestObject);
```

### 2. Using a CORS Proxy or Custom Fetch Options

For IIIF endpoints that omit `Access-Control-Allow-Origin` headers on manifest JSON files, configure `proxyUrl` or pass custom `fetchOptions`:

```javascript
const viewer = new IIIFViewer('#iiif-viewer', {
  manifestUrl: 'https://example.org/iiif/manifest.json',
  proxyUrl: 'https://cors-proxy.example.org/?url=',
  fetchOptions: {
    credentials: 'same-origin',
  },
});
```

### 3. Framework Integration Examples

#### Vanilla HTML / UMD Script Tag

```html
<link rel="stylesheet" href="./node_modules/@micropasts/iiif-viewer/dist/iiif-viewer.css" />
<div id="iiif-viewer"></div>

<script src="./node_modules/@micropasts/iiif-viewer/dist/iiif-viewer.umd.cjs"></script>
<script>
  const viewer = new IIIFViewer.IIIFViewer('#iiif-viewer', {
    manifestUrl: 'https://media.getty.edu/iiif/manifest/3/888f5484-9f14-4549-8d44-287a1d232cbf',
  });
</script>
```

#### React

```jsx
import { useEffect, useRef } from 'react';
import { IIIFViewer } from '@micropasts/iiif-viewer';
import '@micropasts/iiif-viewer/style.css';

export function CulturalObjectViewer({ manifestUrl, theme = 'dark' }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    viewerRef.current = new IIIFViewer(containerRef.current, {
      manifestUrl,
      theme,
    });
    return () => viewerRef.current?.destroy();
  }, []);

  useEffect(() => {
    if (viewerRef.current && manifestUrl) {
      viewerRef.current.loadManifest(manifestUrl);
    }
  }, [manifestUrl]);

  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.setTheme(theme);
    }
  }, [theme]);

  return <div ref={containerRef} />;
}
```

#### Vue 3

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { IIIFViewer } from '@micropasts/iiif-viewer';
import '@micropasts/iiif-viewer/style.css';

const props = defineProps({
  manifestUrl: String,
  theme: { type: String, default: 'dark' },
});

const container = ref(null);
let viewer = null;

onMounted(() => {
  viewer = new IIIFViewer(container.value, {
    manifestUrl: props.manifestUrl,
    theme: props.theme,
  });
});

watch(() => props.manifestUrl, (newUrl) => {
  if (viewer && newUrl) viewer.loadManifest(newUrl);
});

watch(() => props.theme, (newTheme) => {
  if (viewer) viewer.setTheme(newTheme);
});

onBeforeUnmount(() => {
  viewer?.destroy();
});
</script>

<template>
  <div ref="container" />
</template>
```

## Configuration Options

Pass these options as the second argument to `new IIIFViewer(target, options)`:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `manifestUrl` | `string` | `''` | IIIF Presentation 2.0 or 3.0 manifest URL to fetch on mount (also accepts `url`). |
| `manifest` | `object \| string \| null` | `null` | Pre-loaded manifest JSON object or string (also accepts `data`). Takes precedence over `manifestUrl`. |
| `proxyUrl` | `string` | `''` | Optional CORS proxy prefix prepended to `encodeURIComponent(url)` when fetching manifests. |
| `theme` | `'light' \| 'dark'` | `'dark'` | Initial color theme of the viewer UI. Users can switch themes via the header toggle button. |
| `showUrlInput` | `boolean` | `true` | Displays an interactive manifest URL input bar and **Load** button in the header. |
| `showSidebar` | `boolean` | `true` | Sets whether the right-hand Metadata / Index / Notes sidebar is open on initial render. |
| `height` | `string` | `'680px'` | CSS height of the viewer container (minimum height is `540px`). |
| `initialCanvas` | `number` | `0` | Zero-based index of the canvas to display when a manifest first loads. |
| `fetchOptions` | `RequestInit` | `{}` | Additional options passed to `fetch()` when requesting `manifestUrl`. |

## Instance Methods

Once instantiated (`const viewer = new IIIFViewer(...)`), the following methods are available:

| Method | Signature | Description |
| :--- | :--- | :--- |
| `loadManifest(url)` | `(url: string) => Promise<void>` | Fetches a IIIF manifest from `url` and renders the viewer. |
| `setManifest(json)` | `(json: object \| string) => void` | Parses and renders a manifest JSON object or string immediately. |
| `goToCanvas(index)` | `(index: number) => void` | Navigates OpenSeadragon, the filmstrip, and the sidebar to the canvas at `index`. |
| `toggleSidebar()` | `() => void` | Shows or hides the right-hand Metadata / Index / Notes panel. |
| `setTheme(theme)` | `(theme: 'light' \| 'dark') => void` | Sets the viewer theme (`'light'` or `'dark'`). |
| `toggleTheme()` | `() => void` | Toggles between `'light'` and `'dark'` themes. |
| `destroy()` | `() => void` | Destroys the OpenSeadragon instance and cleans up the DOM container. |

## Development & Building

```bash
# Install dependencies
npm install

# Start local dev sandbox (serves index.html)
npm run dev

# Build npm library bundle (outputs to dist/)
npm run build

# Build static GitHub Pages demo site (outputs to docs/)
npm run build:docs
```

## License

This project is licensed under the **Mozilla Public License Version 2.0 (MPL-2.0)** — see the [LICENSE.md](./LICENSE.md) file for details.