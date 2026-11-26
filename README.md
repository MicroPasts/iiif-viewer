# IIIF Viewer (`@micropasts/iiif-viewer`)

A framework-agnostic **IIIF Presentation API 2.x, 3.0 & 4.0** viewer built with **OpenSeadragon**, **Three.js**, **MapLibre GL JS**, and **Tailwind CSS v4**. Designed for museums, archives, libraries, and digital heritage platforms to display deep-zoom 2D canvases, interactive 3D `.glb`/`.gltf` scenes, tables of contents, metadata, annotations, and geographic locations.

* **Live Demo:** https://micropasts.github.io/iiif-viewer/
* **Repository:** https://github.com/micropasts/iiif-viewer
* **Author:** Daniel Pett ([MicroPasts](https://github.com/micropasts))

### Screenshot of interface

![Screenshot of the IIIF Viewer interface](https://raw.githubusercontent.com/MicroPasts/iiif-viewer/main/images/screenshot-iiif.png)

## Features

* **IIIF Presentation 2.x, 3.0 & 4.0 Support:** Detects and normalizes common Presentation 2.x (`sequences`/`canvases`), Presentation 3.0 (`items`/`AnnotationPage`), and Presentation 4.0 (`Scene`/`Model`/`SpecificResource`) structures. A Presentation 3 annotation page with painting annotations can also be loaded directly.
* **Deep-Zoom 2D & Interactive 3D in One Filmstrip:** Switch between OpenSeadragon tiled/static 2D images and a Three.js WebGL 3D scene viewer (`GLTFLoader` + `DRACOLoader`). The 3D controls include camera presets and reset, auto-rotate, wireframe, raking light, model statistics, a local file picker, and IIIF `RotateTransform` / `ScaleTransform` / `TranslateTransform` support.
* **Image Inspection & Annotations:** Zoom, rotate, and adjust brightness, contrast, grayscale, and inversion for 2D images. Image controls are hidden for 3D scenes and filter settings are retained when returning to 2D. The Notes panel displays embedded or referenced annotation text and can focus on supported rectangular `xywh` regions.
* **Search & Navigation:** Browse thumbnails and nested ranges, or search through a supported IIIF Search API service with a local manifest search fallback. Manifest URLs or IIIF links can also be dropped onto the viewer.
* **Maps & Languages:** Display manifest and current-canvas `navPlace` features on a MapLibre map. Choose among available metadata languages in the sidebar or set a preferred language programmatically.
* **Configurable Proxy Routing:** Rewrite manifest, `info.json`, static image, model, thumbnail, annotation, search, and `navPlace` URLs through custom prefixes, regex rules, functions, or proxy endpoints via `proxyRoutes`, `proxyUrl`, and `assetProxyUrl`.
* **HTML Metadata Rendering:** Sanitizes HTML inside manifest metadata values, summaries, attributions, and annotations, retaining a limited set of formatting and links.
* **Fullscreen & Scoped Dark/Light Themes:** Built-in Fullscreen API support (with a fixed-viewport fallback for sandboxed iframes) and isolated `.dark` class theming.

### Current limitations

* Referenced annotation pages and `navPlace` collections are fetched when needed; inaccessible or unsupported references may not appear. Overlays support rectangular `xywh` regions, not arbitrary annotation selectors.
* Range navigation uses canvas references it can resolve in the manifest; not all IIIF structures or selectors are supported.
* Language maps prefer the selected language, then `none`, then the first available language. For Presentation 2 language-tagged arrays, the selected language is preferred; otherwise available values are combined.
* The local 3D file picker works best with self-contained `.glb` files; a `.gltf` file that refers to separate buffers or textures also needs those resources to be accessible.
* Draco-compressed models use decoders hosted by Google by default. Set `dracoDecoderPath` to a directory you host if external decoder requests are undesirable.

### Sidebar

* **Metadata:** View the manifest summary, metadata, attribution, rights, related links, and technical details. Long summaries can be expanded. The language selector is offered when multiple languages are found in the manifest label, summary, or metadata.
* **Index:** Navigate supported structural ranges and nested ranges by selecting an entry.
* **Notes:** Read annotations for the current canvas. Select **Zoom region** for supported `xywh` regions, or use **Hide Boxes** / **Show Boxes** to toggle their overlays. Referenced annotation pages are fetched when their canvas is opened.
* **Search:** Search through a detected IIIF Search API service when available. If no service is detected or its request fails, search locally through manifest and canvas labels, metadata, and loaded annotations. Local search matches text without HTML formatting and does not fetch annotation pages from unvisited canvases; an empty response from a working remote service does not trigger a local search.
* **Map:** View and select geographic locations from the manifest and current canvas.

### Maps

The Map tab displays embedded or referenced `navPlace` features from the manifest and current canvas, including supported points, lines, and polygons. Select a feature on the map or in the location list; canvas-linked locations can navigate to their canvas.

The default basemap is [OpenFreeMap Liberty](https://openfreemap.org/), a free OpenStreetMap-based style that requires no API key. MapLibre displays the required map attribution. Supply `mapStyle` to use another MapLibre-compatible style. The map worker is bundled with the viewer. Restrictive Content Security Policies may need to allow `blob:` workers and `data:` module imports, as well as requests to the map provider.

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

Instantiate the viewer in a browser with a DOM; 3D models and the map also require WebGL support. The stylesheet includes Tailwind preflight and utility rules, so check for interactions with styles on the host page.

Call `viewer.destroy()` when removing the viewer, such as when a framework component unmounts. Multiple viewers can be mounted in separate elements.

### Load a manifest without the URL bar

Set `manifestUrl` to load a manifest when the viewer is created, `showUrlInput: false` to hide the URL input and Load button, and `allowManifestDrop: false` to disable loading by dropping a manifest URL:

```html
<div id="iiif-viewer"></div>
```

```javascript
import { IIIFViewer } from '@micropasts/iiif-viewer';
import '@micropasts/iiif-viewer/style.css';

const viewer = new IIIFViewer('#iiif-viewer', {
  manifestUrl: 'https://iiif.io/api/cookbook/recipe/0009-book-1/manifest.json',
  showUrlInput: false,
  allowManifestDrop: false,
  theme: 'light',
  height: '680px',
  language: 'en',
  showSidebar: true,
  initialCanvas: 0,
});
```

The manifest and its resources must be accessible to the browser, including any required CORS permissions. See [Configuration Options](#configuration-options) for all available options.

Drag-and-drop is enabled by default, independently of the URL bar. Disabling it only prevents manifest drops; image and model drag controls still work, and your application can still call `viewer.loadManifest(url)`. These options are not access controls. The preset buttons in the demo are part of the demo page, not the viewer; omit them from your page if they are not needed.

For interactive examples, open [Configuration examples in the demo](https://micropasts.github.io/iiif-viewer/#configuration-examples). They show the URL bar hidden, manifest drops disabled, a combination with the sidebar initially closed, and external viewer links hidden. `showSidebar: false` does not remove the sidebar; the Info button can still open it. The examples use a [local copy of the supplied Caryatid manifest](./public/examples/caryatid-manifest.json); images are served by the British Museum and remain subject to the rights statement in the manifest.

### Configure external viewer links

The Metadata tab links to Universal Viewer and Tify by default. Add other services using URL templates containing `{manifest}`:

```js
const viewer = new IIIFViewer('#iiif-viewer', {
  manifestUrl: 'https://example.org/manifest.json',
  externalViewers: {
    mode: 'append', // use 'replace' to omit the default links
    viewers: [
      { label: 'My IIIF tool', url: 'https://example.org/viewer?manifest={manifest}' },
    ],
  },
});
```

Each `{manifest}` is replaced with the URL-encoded manifest ID, or the loaded URL when the manifest has no ID. Templates must be absolute HTTP or HTTPS URLs. `mode` defaults to `'append'`. To hide the entire section, set `externalViewers: false` (or use `'replace'` with an empty `viewers` array). The section is also hidden when neither a manifest ID nor a loaded URL is available.

### Language and selection callbacks

```javascript
const viewer = new IIIFViewer('#iiif-viewer', {
  manifestUrl: 'https://example.org/iiif/manifest.json',
  language: 'en',
  onManifestLoad(parsed, raw) {
    console.log('Parsed manifest:', parsed.label);
  },
  onCanvasChange(canvas, index) {
    console.log('Selected:', index, canvas.label);
  },
  onSelectLocation(feature, { canvasIndex }) {
    console.log('Location:', feature.properties, canvasIndex);
  },
});

viewer.setLanguage('fr');
```

`onManifestLoad` runs after parsing, not after every asset has finished loading. With an inline `manifest`, callbacks can run during construction, before the `viewer` variable is assigned.

### Using Custom Proxy Routes (Local Dev / CORS)

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

The first matching array or prefix-map rule wins. A resolver can return a falsy value to fall back to `proxyUrl` or `assetProxyUrl`. These options only rewrite URLs; the destination must actually serve or proxy the resource with appropriate CORS headers. `proxyUrl` and `assetProxyUrl` append the URL encoded with `encodeURIComponent`.

The viewer rewrites the manifest URL, image service `info.json` or static image URL, model URL, thumbnail URL, external annotation and `navPlace` URLs, and search endpoint URL. It does not rewrite subsequent image tile requests, external resources referenced by a `.gltf` file, or map style and tile requests; configure those hosts accordingly. `fetchOptions` applies to manifest and remote search requests, not image, model, annotation, or `navPlace` requests.

### Passing an Inline Manifest Object

```javascript
const viewer = new IIIFViewer('#iiif-viewer', {
  manifest: myManifestJsonObject,
  theme: 'light',
  showUrlInput: false,
});
```

If both `manifest` and `manifestUrl` are supplied, the inline manifest takes precedence.

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

Serve the UMD file and stylesheet over HTTP with a JavaScript-compatible MIME type for the `.cjs` file; opening the HTML directly via `file://` can prevent manifests and assets from loading.

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
    instanceRef.current = new IIIFViewer(containerRef.current);

    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    instanceRef.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    instanceRef.current?.setProxyRoutes(proxyRoutes);
  }, [proxyRoutes]);

  useEffect(() => {
    if (manifestUrl) instanceRef.current?.loadManifest(manifestUrl);
  }, [manifestUrl]);

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
watch(() => props.proxyRoutes, (routes) => viewer?.setProxyRoutes(routes));

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
| `proxyRoutes` | `object \| array \| function` | `null` | Rewrites URLs of type `'manifest'`, `'image'`, `'model'`, `'thumbnail'`, `'annotation'`, `'search'`, or `'navplace'`. Accepts `{ prefix: replacement }`, `[{ match, replace, types }]` with string or `RegExp` matches, or `(url, resourceType) => string`. Array rule `types` is optional. |
| `proxyUrl` | `string` | `''` | Prefix URL prepended to `encodeURIComponent(url)` when fetching manifests. |
| `assetProxyUrl` | `string` | `''` | Prefix URL prepended to `encodeURIComponent(url)` for downstream resources when no `proxyRoutes` rule matches. |
| `dracoDecoderPath` | `string` | Google CDN 1.5.7 | Path/URL to Draco WASM/JS decoders for Draco-compressed `.glb` models. |
| `mapStyle` | `string \| object` | OpenFreeMap Liberty | MapLibre style URL or style object for the `navPlace` map. |
| `theme` | `'dark' \| 'light'` | `'dark'` | Initial scoped theme for the viewer container. |
| `language` | `string` | `'en'` | Preferred language code for manifest labels and metadata. |
| `summaryCollapseLength` | `number` | `300` | Plain-text summary length above which a Show more control appears; set to `0` or a negative number to disable collapsing. |
| `physicalRuler` | `boolean` | `false` | Enable the physical scale and manual calibration controls for 2D images. |
| `layersCurtain` | `boolean` | `false` | Enable the image-layer curtain and comparison canvas controls for 2D images. |
| `height` | `string` | `'680px'` | CSS height of the viewer container when not in fullscreen; the viewer has a 540px minimum height. |
| `showUrlInput` | `boolean` | `true` | Shows or hides the manifest URL input bar in the top toolbar. |
| `allowManifestDrop` | `boolean` | `true` | Allows manifest URLs or IIIF links to be dropped onto the viewer for loading. |
| `showSidebar` | `boolean` | `true` at widths ≥ 768px; otherwise `false` | Initial visibility of the Metadata / Index / Notes / Search / Map sidebar. |
| `externalViewers` | `false \| object` | Universal Viewer and Tify | Hide, append to, or replace links in the Metadata tab. See [Configure external viewer links](#configure-external-viewer-links). |
| `initialCanvas` | `number` | `0` | Zero-based index of the initial canvas or 3D scene to display. |
| `fetchOptions` | `RequestInit` | `{}` | Optional manifest and search `fetch` options (such as `credentials` or custom `headers`); the viewer supplies its own abort signal. |
| `onSelectScene` | `function` | `null` | Optional callback `(container, sceneData, meta) => instance` for custom 3D scene rendering. |
| `onManifestLoad` | `function` | `null` | Called as `(parsedManifest, rawManifest)` after parsing, before all resources necessarily finish loading. |
| `onCanvasChange` | `function` | `null` | Called as `(canvas, index)` when a canvas or scene is selected. |
| `onSelectLocation` | `function` | `null` | Called as `(feature, { canvasIndex })` when a location is selected from the map or list. The index can be absent or `null` for a manifest-level location. Map clicks provide a MapLibre feature; list selections provide a normalized GeoJSON feature. |

`onSelectScene` receives the container element, normalized scene data (`modelUrl`, `format`, `transforms`, and `thumbnail`), and `{ theme, title }`. The `modelUrl` is already resolved through proxy routing. The returned instance may implement `destroy()`, `setTheme(theme)`, and `handleResize()`; the viewer calls these when available.

### Physical ruler and image curtain

Both tools are opt-in. Their buttons appear in the top toolbar for 2D images, not 3D scenes; the controls open over the image:

```js
const viewer = new IIIFViewer('#viewer', {
  manifestUrl: 'https://example.org/manifest.json',
  physicalRuler: true,
  layersCurtain: true,
});
```

**Ruler:** Open Ruler to show a physical scale bar. The viewer reads the canvas `physicalDimensions` extension with the IIIF physical-dimensions profile, a positive `physicalScale` in units per canvas pixel, and `physicalUnits` of `mm`, `cm`, or `in`. The image and canvas must have proportional dimensions for this automatic calibration. Otherwise, enter millimetres per **source image pixel**, or select **Draw calibration line**, drag across a known distance within the image, enter its length in millimetres, and select **Calibrate from line**. Escape cancels drawing. Manual calibration is kept per canvas until a new manifest is loaded; **Use manifest scale** resets it. Measurements are only as accurate as the metadata or the supplied calibration, and assume uniform scale across the image.

**Curtain:** Open Curtain to compare full-canvas painting images and IIIF `Choice` alternatives. Additional layers start hidden; select **Show** for the layer to compare. The slider reveals each visible layer from the left or top, according to the direction; layers can be hidden or moved up. A second canvas can also be selected as an overlay when both canvases declare identical dimensions. Source images must also have identical pixel dimensions. Only full-canvas images without selectors or transforms are supported; cropped or positioned painting regions are not compared. Image alignment is not automatic: matching dimensions do not guarantee that the subjects are registered. Layer settings reset when changing the comparison canvas or navigating between canvases. Image URLs use the normal image proxy routing and require appropriate CORS permissions.

---

## Instance Methods

| Method | Signature | Description |
| :--- | :--- | :--- |
| `loadManifest` | `async loadManifest(url)` | Fetches and renders a IIIF manifest from the given URL (applying `proxyRoutes` / `proxyUrl`). |
| `setManifest` | `async setManifest(jsonOrString)` | Parses and renders a manifest JSON object or string directly. |
| `goToCanvas` | `async goToCanvas(index)` | Navigates to the specified zero-based canvas or 3D scene index. |
| `setProxyRoutes` | `setProxyRoutes(routes)` | Updates `proxyRoutes` at runtime and reloads the active canvas/scene. |
| `setInspectionTools` | `setInspectionTools({ physicalRuler, layersCurtain })` | Enables or disables either 2D inspection tool at runtime; omitted options retain their current values. Changing the options resets manual calibration and layer controls. |
| `resolveUrl` | `resolveUrl(url, resourceType)` | Resolves a URL through configured `proxyRoutes`, `assetProxyUrl`, or `proxyUrl`. |
| `setTheme` | `setTheme('dark' \| 'light')` | Switches the viewer theme between dark and light mode. |
| `setLanguage` | `setLanguage(language)` | Updates manifest, canvas, and range labels and metadata for the selected language. |
| `toggleTheme` | `toggleTheme()` | Toggles between dark and light mode. |
| `toggleSidebar` | `toggleSidebar()` | Shows or hides the sidebar. |
| `enterFullscreen` | `async enterFullscreen()` | Expands the viewer to fullscreen (with fixed-viewport fallback). |
| `exitFullscreen` | `async exitFullscreen()` | Exits fullscreen mode. |
| `toggleFullscreen` | `toggleFullscreen()` | Toggles fullscreen mode. |
| `destroy` | `destroy()` | Aborts outstanding manifest/search requests and cleans up the map, OpenSeadragon, Three.js resources, event listeners, and DOM nodes. |

`loadManifest` and `setManifest` display fetch or parsing errors in the viewer instead of propagating them to the caller. Their completion does not guarantee that asynchronously loaded images, models, annotations, or maps have finished rendering. `goToCanvas` ignores indices outside the manifest's canvas range.

### Keyboard shortcuts

When the viewer container itself has keyboard focus, use the left/right arrows to change canvas, `I` to toggle the sidebar, and `F` to toggle fullscreen. For 2D images, `+` or `=` zooms in, `-` zooms out, and `0` resets the view. Escape exits the fullscreen fallback. These shortcuts do not override keyboard interaction with controls inside the viewer.

Use the arrow keys to navigate the sidebar tabs (Home and End select the first and last tab). With the 2D image focused, arrow keys pan and `+`/`-` zoom; the Filters panel also has pan buttons. With the 3D model focused, arrow keys pan, Shift plus arrow keys rotate, and `+`/`-` zoom. The 3D **Move view** menu provides buttons for these actions without dragging. The map has pan buttons, and locations can be selected from the list beneath it.

### Accessibility

The viewer includes labeled controls, visible keyboard focus, status announcements, and keyboard and non-drag alternatives for image, model, and map navigation. These measures do not by themselves establish WCAG conformance: integrators should provide meaningful descriptions of visual content, check contrast and responsive layouts in their host page, and test with keyboard and assistive technologies. External maps, custom 3D renderers, and manifest content may introduce additional accessibility issues.

---

## Local Development & GitHub Pages Build

Use Node.js 22 and npm for local development (the current project uses Vite 6). Vite 8 requires Node.js 20.19+ or 22.12+ and a change to the docs build's `manualChunks` configuration; it is not currently configured for this project.

```bash
# Install dependencies
npm install

# Start local dev server (includes /images and /finds proxy to http://localhost:8000)
npm run dev

# Build npm library bundle into dist/
npm run build

# Build static demo site into docs/ for GitHub Pages
npm run build:docs

# Run the unit and component tests
npm test

# Install Chromium once, then run browser tests
npx playwright install chromium
npm run test:e2e

# Optionally test the live Fitzwilliam miniature manifest and image service
IIIF_LIVE_TEST=1 npm run test:e2e -- e2e/miniature-live.e2e.js
```

Vitest covers the parser, components, and services. Playwright exercises navigation, annotations, maps, 3D controls, keyboard behavior, and selected contrast checks in Chromium. By default, browser tests use local fixtures and a mocked map style rather than external IIIF or map services; the optional live test requires network access. They do not replace manual accessibility or assistive-technology testing.

## Contributing, citation, and security

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development and pull request guidance, [CITATION.cff](./CITATION.cff) for citation metadata, and [SECURITY.md](./SECURITY.md) for private vulnerability reporting. These files are maintained in the [repository](https://github.com/MicroPasts/iiif-viewer).

## License

This project is licensed under the **Mozilla Public License Version 2.0 (MPL-2.0)** — see the [LICENSE.md](./LICENSE.md) file for details.