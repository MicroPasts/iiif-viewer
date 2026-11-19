# IIIF Viewer (`@micropasts/iiif-viewer`)

A lightweight, framework-agnostic **IIIF Presentation API 2.0, 3.0 & 4.0** viewer built with **OpenSeadragon**, **Three.js**, and **Tailwind CSS v4**. Designed for museums, archives, libraries, and digital heritage platforms to display deep-zoom 2D canvases, interactive 3D `.glb`/`.gltf` scenes, structural tables of contents, sanitized HTML metadata, and Web Annotations without external CDN bloat.

* **Live Demo:** https://micropasts.github.io/iiif-viewer/
* **Repository:** https://github.com/micropasts/iiif-viewer
* **Author:** Daniel Pett ([MicroPasts](https://github.com/micropasts))

### Screenshot of interface

![A screenshot of how the iiif viewer looks](./images/screenshot-iiif.png)

## Features

* **IIIF Presentation 2.0, 3.0 & 4.0 Support:** Automatically detects and normalizes Presentation 2.x (`sequences`/`canvases`), Presentation 3.0 (`items`/`AnnotationPage`), and Presentation 4.0 (`Scene`/`Model`/`SpecificResource`) manifests.
* **Deep-Zoom 2D & Interactive 3D in One Filmstrip:** Seamlessly switches between OpenSeadragon tiled/static 2D images and a built-in Three.js WebGL 3D scene viewer (`GLTFLoader` + `DRACOLoader`) with camera reset, auto-rotate, wireframe, raking light, local `.glb` file picker, and IIIF `RotateTransform` / `ScaleTransform` / `TranslateTransform` support.
* **Configurable Proxy Routing:** Route manifests and downstream assets (`info.json`, static images, `.glb` models, thumbnails) through custom prefixes, regex rules, functions, or CORS proxy endpoints via `proxyRoutes`, `proxyUrl`, and `assetProxyUrl`.
* **Safe HTML Metadata Rendering:** Sanitizes HTML inside manifest metadata values, summaries, attributions, and annotations—preserving formatting and safe links while stripping unsafe scripts or attributes.
* **Fullscreen & Scoped Dark/Light Themes:** Built-in Fullscreen API support (with a fixed-viewport fallback for sandboxed iframes) and isolated `.dark` class theming.

---

## Installation

### From npm

```bash
npm install @micropasts/iiif-viewer
```

### From GitHub Packages

Add a `.npmrc` file in your project root:

```ini
@micropasts:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @micropasts/iiif-viewer
```

---

## Quick Start

### Vanilla JS / ES Modules

```javascript
import { IIIFViewer } from '@micropasts/iiif-viewer';
import '@micropasts/iiif-viewer/style.css';

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

### Using Custom Proxy Routes (Local Dev / CORS Bypass)

When a manifest contains embedded asset URLs pointing to a local dev server (such as `http://localhost:8000/images/...`) or an origin lacking `Access-Control-Allow-Origin` headers, configure `proxyRoutes`, `proxyUrl`, or `assetProxyUrl`:

```javascript
const viewer = new IIIFViewer('#iiif-viewer', {
  manifestUrl: 'http://localhost:8000/finds/1704/iiif/manifest',
  // Prefix map rewriting both manifest and embedded .glb / image URLs
  proxyRoutes: {
    'http://localhost:8000/images': '/images',
    'http://localhost:8000/finds': '/finds',
  },
});
```

You can also pass an array of `{ match, replace, types }` rules or a resolver function:

```javascript
const viewer = new IIIFViewer('#iiif-viewer', {
  manifestUrl: 'https://example.org/iiif/manifest.json',
  proxyRoutes: (url, resourceType) => {
    if (resourceType === 'model' && url.startsWith('http://localhost:8000/')) {
      return `/api/proxy-glb?url=${encodeURIComponent(url)}`;
    }
    return url;
  },
});
```

### Passing an Inline Manifest Object

```javascript
const viewer = new IIIFViewer('#iiif-viewer', {
  manifest: myManifestJsonObject,
  theme: 'light',
  showUrlInput: false,
});
```

---

## Framework Integration Examples

### UMD Script Tag

```html
<link rel="stylesheet" href="./node_modules/@micropasts/iiif-viewer/dist/iiif-viewer.css" />
<div id="iiif-viewer"></div>

<script src="./node_modules/@micropasts/iiif-viewer/dist/iiif-viewer.umd.cjs"></script>
<script>
  const viewer = new IIIFViewer.IIIFViewer('#iiif-viewer', {
    manifestUrl: 'https://iiif.io/api/cookbook/recipe/0608-mvm-3d/v4/manifest.json',
  });
</script>
```

### React

```jsx
import { useEffect, useRef } from 'react';
import { IIIFViewer } from '@micropasts/iiif-viewer';
import '@micropasts/iiif-viewer/style.css';

export function MuseumIIIFViewer({ manifestUrl, theme = 'dark', proxyRoutes = null }) {
  const containerRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    instanceRef.current = new IIIFViewer(containerRef.current, {
      manifestUrl,
      theme,
      proxyRoutes,
    });

    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (manifestUrl) instanceRef.current?.loadManifest(manifestUrl);
  }, [manifestUrl]);

  useEffect(() => {
    if (instanceRef.current) instanceRef.current.setTheme(theme);
  }, [theme]);

  return <div ref={containerRef} />;
}
```

### Vue 3

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { IIIFViewer } from '@micropasts/iiif-viewer';
import '@micropasts/iiif-viewer/style.css';

const props = defineProps({
  manifestUrl: { type: String, required: true },
  theme: { type: String, default: 'dark' },
  proxyRoutes: { type: [Object, Array, Function], default: null },
});

const container = ref(null);
let viewer = null;

onMounted(() => {
  viewer = new IIIFViewer(container.value, {
    manifestUrl: props.manifestUrl,
    theme: props.theme,
    proxyRoutes: props.proxyRoutes,
  });
});

watch(() => props.manifestUrl, (url) => url && viewer?.loadManifest(url));
watch(() => props.theme, (theme) => viewer?.setTheme(theme));

onBeforeUnmount(() => viewer?.destroy());
</script>

<template>
  <div ref="container" />
</template>
```

---

## Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `manifestUrl` (or `url`) | `string` | `''` | URL of a IIIF Presentation 2.0, 3.0, or 4.0 manifest to fetch on mount. |
| `manifest` (or `data`) | `object \| string` | `null` | Pre-loaded IIIF manifest JSON object or JSON string. |
| `proxyRoutes` | `object \| array \| function` | `null` | Rewrites manifest and asset URLs (`'manifest'`, `'image'`, `'model'`, `'thumbnail'`). Accepts `{ prefix: replacement }`, `[{ match, replace, types }]`, or `(url, resourceType) => string`. |
| `proxyUrl` | `string` | `''` | Prefix URL prepended to `encodeURIComponent(url)` when fetching manifests. |
| `assetProxyUrl` | `string` | `''` | Prefix URL prepended to `encodeURIComponent(url)` when fetching downstream images, `.glb` models, and thumbnails. |
| `dracoDecoderPath` | `string` | Google CDN 1.5.7 | Path/URL to Draco WASM/JS decoders for Draco-compressed `.glb` models. |
| `theme` | `'dark' \| 'light'` | `'dark'` | Initial scoped theme for the viewer container. |
| `height` | `string` | `'680px'` | CSS height of the viewer container when not in fullscreen. |
| `showUrlInput` | `boolean` | `true` | Shows or hides the manifest URL input bar in the top toolbar. |
| `showSidebar` | `boolean` | `true` | Initial visibility of the Metadata / Index / Notes sidebar. |
| `initialCanvas` | `number` | `0` | Zero-based index of the initial canvas or 3D scene to display. |
| `fetchOptions` | `RequestInit` | `{}` | Optional `fetch` options (such as `credentials` or custom `headers`). |
| `modelViewer` | `class` | `null` | Optional custom 3D viewer class (e.g., `GlbModelViewer` from `@micropasts/glb-model-viewer`) to override the built-in Three.js scene viewer. |
| `onSelectScene` | `function` | `null` | Optional callback `(container, sceneData, meta) => instance` for custom 3D scene rendering. |

---

## Instance Methods

| Method | Signature | Description |
| :--- | :--- | :--- |
| `loadManifest` | `async loadManifest(url)` | Fetches and renders a IIIF manifest from the given URL (applying `proxyRoutes` / `proxyUrl`). |
| `setManifest` | `setManifest(jsonOrString)` | Parses and renders a manifest JSON object or string directly. |
| `goToCanvas` | `goToCanvas(index)` | Navigates to the specified zero-based canvas or 3D scene index. |
| `setProxyRoutes` | `setProxyRoutes(routes)` | Updates `proxyRoutes` at runtime and reloads the active canvas/scene. |
| `resolveUrl` | `resolveUrl(url, resourceType)` | Resolves a URL through configured `proxyRoutes`, `assetProxyUrl`, or `proxyUrl`. |
| `setTheme` | `setTheme('dark' \| 'light')` | Switches the viewer theme between dark and light mode. |
| `toggleTheme` | `toggleTheme()` | Toggles between dark and light mode. |
| `toggleSidebar` | `toggleSidebar()` | Shows or hides the right-hand Metadata / Index / Notes sidebar. |
| `enterFullscreen` | `async enterFullscreen()` | Expands the viewer to fullscreen (with fixed-viewport fallback). |
| `exitFullscreen` | `async exitFullscreen()` | Exits fullscreen mode. |
| `toggleFullscreen` | `toggleFullscreen()` | Toggles fullscreen mode. |
| `destroy` | `destroy()` | Cleans up OpenSeadragon, Three.js WebGL contexts, event listeners, and DOM nodes. |

---

## Local Development & GitHub Pages Build

```bash
# Install dependencies
npm install

# Start local dev server (includes /images and /finds proxy to http://localhost:8000)
npm run dev

# Build npm library bundle into dist/
npm run build

# Build static demo site into docs/ for GitHub Pages
npm run build:docs
```

## License

This project is licensed under the **Mozilla Public License Version 2.0 (MPL-2.0)** — see the [LICENSE.md](./LICENSE.md) file for details.