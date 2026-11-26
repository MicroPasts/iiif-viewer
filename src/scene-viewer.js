import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { escapeHtml } from './sanitize.js';

export class BuiltInSceneViewer {
  constructor(container, sceneData, options = {}) {
    this.container = container;
    this.sceneData = sceneData;
    this.theme = options.theme || 'dark';
    this.title = options.title || '3D Scene';
    this.resolvedModelUrl = options.resolvedModelUrl || sceneData.modelUrl;
    this.dracoDecoderPath =
      options.dracoDecoderPath || 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
    this.onModelLoaded = options.onModelLoaded || null;

    this.state = {
      autoRotate: false,
      wireframe: false,
      warmLight: false,
    };

    this.rafId = null;
    this.wrapperGroup = null;
    this.dracoLoader = null;
    this.objectUrls = [];
    this.loadGeneration = 0;
    this.destroyed = false;
    this.modelStats = null;
    this.defaultCameraDistance = 2.35;
    this.defaultCameraPos = new THREE.Vector3(0, 0.25, 2.35);

    this.mount();
  }

  mount() {
    this.container.innerHTML = `
      <div class="relative w-full h-full flex flex-col select-none">
        <div data-el="three-canvas-host" class="w-full h-full cursor-grab active:cursor-grabbing"></div>
        <div data-el="three-error-announcement" role="alert" class="sr-only"></div>

        <!-- 3D Loading Indicator -->
        <div data-el="three-loading" role="status" class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-100/85 dark:bg-slate-950/85 backdrop-blur-xs text-xs font-medium text-slate-700 dark:text-slate-300 gap-2">
          <span>Loading 3D Model (.glb)...</span>
          <span data-el="three-progress" aria-hidden="true" class="font-mono text-[11px] text-purple-600 dark:text-purple-400">0%</span>
        </div>

        <!-- 3D Error Overlay with Local File Fallback -->
        <div data-el="three-error" class="hidden absolute top-14 left-4 right-4 z-20 p-4 rounded-lg bg-red-50 dark:bg-red-950/95 border border-red-300 dark:border-red-800 text-xs text-red-800 dark:text-red-200 space-y-2.5">
          <p data-el="three-error-msg" class="break-all"></p>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" data-three-action="open-error-file" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white font-medium cursor-pointer transition">Select Local .GLB File</button>
            <input type="file" data-el="three-file-input" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" class="hidden" />
          </div>
        </div>

        <!-- Interactive 3D Controls Bar -->
        <div class="absolute top-3 left-1/2 -translate-x-1/2 z-10 inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow-md backdrop-blur-xs text-[11px] font-medium">
          <button type="button" data-three-action="reset" title="Reset Camera" class="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Reset
          </button>
          <div class="inline-flex rounded border border-slate-200 dark:border-slate-700 divide-x divide-slate-200 dark:divide-slate-700">
            <button type="button" data-three-view="front" title="Front View" class="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Front</button>
            <button type="button" data-three-view="top" title="Top View" class="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Top</button>
            <button type="button" data-three-view="side" title="Side View" class="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Side</button>
          </div>
          <button type="button" data-three-action="autorotate" title="Toggle Auto-Rotate" aria-pressed="false" class="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Rotate
          </button>
          <button type="button" data-three-action="wireframe" title="Toggle Wireframe" aria-pressed="false" class="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Wireframe
          </button>
          <button type="button" data-three-action="lighting" title="Toggle Raking / Warm Light" aria-pressed="false" class="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Raking Light
          </button>
          <details class="relative">
            <summary class="px-2 py-1 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">Move view</summary>
            <div class="absolute top-full left-0 mt-1 p-2 w-52 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-lg space-y-2">
              <div role="group" aria-label="Rotate 3D view" class="flex items-center gap-1">
                <span>Rotate</span>
                <button type="button" data-three-action="rotate-left" aria-label="Rotate 3D view left" class="px-1 border rounded">&larr;</button>
                <button type="button" data-three-action="rotate-up" aria-label="Rotate 3D view up" class="px-1 border rounded">&uarr;</button>
                <button type="button" data-three-action="rotate-down" aria-label="Rotate 3D view down" class="px-1 border rounded">&darr;</button>
                <button type="button" data-three-action="rotate-right" aria-label="Rotate 3D view right" class="px-1 border rounded">&rarr;</button>
              </div>
              <div role="group" aria-label="Pan 3D view" class="flex items-center gap-1">
                <span>Pan</span>
                <button type="button" data-three-action="pan-left" aria-label="Pan 3D view left" class="px-1 border rounded">&larr;</button>
                <button type="button" data-three-action="pan-up" aria-label="Pan 3D view up" class="px-1 border rounded">&uarr;</button>
                <button type="button" data-three-action="pan-down" aria-label="Pan 3D view down" class="px-1 border rounded">&darr;</button>
                <button type="button" data-three-action="pan-right" aria-label="Pan 3D view right" class="px-1 border rounded">&rarr;</button>
              </div>
              <div role="group" aria-label="Zoom 3D view" class="flex items-center gap-1">
                <span>Zoom</span>
                <button type="button" data-three-action="zoom-in" aria-label="Zoom 3D view in" class="px-2 border rounded">+</button>
                <button type="button" data-three-action="zoom-out" aria-label="Zoom 3D view out" class="px-2 border rounded">&minus;</button>
              </div>
            </div>
          </details>
          <button type="button" data-three-action="open-toolbar-file" title="Open Local .GLB File" class="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition">Open .GLB</button>
          <input type="file" data-el="three-toolbar-file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" class="hidden" />
          <a href="${escapeHtml(this.resolvedModelUrl)}" download title="Download GLB" class="px-2 py-1 rounded text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 transition">
            &darr; GLB
          </a>
        </div>

        <!-- Model Stats & Controls Hint -->
        <div class="hidden sm:flex items-center justify-between gap-3 absolute bottom-3 left-3 right-3 z-10 pointer-events-none text-[10px] text-slate-500 dark:text-slate-400">
          <span data-el="three-stats" class="hidden px-2.5 py-1 rounded bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 font-mono"></span>
          <span class="ml-auto px-2.5 py-1 rounded bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
            Left-drag: Rotate &bull; Right-drag: Pan &bull; Scroll: Zoom
          </span>
        </div>
      </div>
    `;

    this.initThree();
    this.bindControls();
    this.loadModel(this.resolvedModelUrl);
  }

  initThree() {
    const host = this.container.querySelector('[data-el="three-canvas-host"]');
    const width = host.clientWidth || 640;
    const height = host.clientHeight || 480;

    this.scene = new THREE.Scene();
    this.updateSceneBackground();

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
    this.camera.position.copy(this.defaultCameraPos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute('role', 'group');
    this.renderer.domElement.setAttribute('aria-label', `3D model: ${this.title}. Use arrow keys to pan, Shift and arrow keys to rotate, and plus or minus to zoom.`);
    host.appendChild(this.renderer.domElement);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    this.keyLight.position.set(2.5, 3.5, 3);
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0xdbeafe, 0.65);
    this.fillLight.position.set(-3, -1, 2);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
    this.rimLight.position.set(0, 2, -3);
    this.scene.add(this.rimLight);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 0.2;
    this.controls.maxDistance = 25;
    this.controls.listenToKeyEvents(this.renderer.domElement);
    this.renderer.domElement.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        this.controls.dollyIn(0.8);
      } else if (event.key === '-') {
        event.preventDefault();
        this.controls.dollyOut(0.8);
      }
    });

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(host);

    const animate = () => {
      this.rafId = requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  clearCurrentModel() {
    if (!this.wrapperGroup) return;
    this.scene.remove(this.wrapperGroup);
    this.disposeObject(this.wrapperGroup);
    this.wrapperGroup = null;
    this.modelStats = null;
  }

  disposeObject(object) {
    const disposedTextures = new Set();
    object.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.geometry?.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((material) => {
        if (!material) return;
        Object.values(material).forEach((value) => {
          if (value?.isTexture && !disposedTextures.has(value)) {
            disposedTextures.add(value);
            value.dispose();
          }
        });
        material.dispose();
      });
    });
  }

  computeModelStats(root) {
    let meshes = 0;
    let triangles = 0;
    let hasDraco = false;

    root.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry) return;
      meshes += 1;
      const geo = obj.geometry;
      if (geo.index) {
        triangles += Math.round(geo.index.count / 3);
      } else if (geo.attributes?.position) {
        triangles += Math.round(geo.attributes.position.count / 3);
      }
    });

    if (this.dracoLoader) hasDraco = true;
    return { meshes, triangles, hasDraco };
  }

  loadModel(url) {
    const announcement = this.container.querySelector('[data-el="three-error-announcement"]');
    if (announcement) announcement.textContent = '';
    if (!url) {
      this.showLoadError('No 3D model URL was provided.');
      return;
    }

    const generation = ++this.loadGeneration;
    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');

    if (this.dracoDecoderPath) {
      if (!this.dracoLoader) {
        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath(this.dracoDecoderPath);
      }
      loader.setDRACOLoader(this.dracoLoader);
    }

    const loadingEl = this.container.querySelector('[data-el="three-loading"]');
    const progressEl = this.container.querySelector('[data-el="three-progress"]');
    const errorEl = this.container.querySelector('[data-el="three-error"]');

    loadingEl?.classList.remove('hidden');
    errorEl?.classList.add('hidden');
    if (progressEl) progressEl.textContent = '0%';

    loader.load(
      url,
      (gltf) => {
        if (this.destroyed || generation !== this.loadGeneration) {
          this.disposeObject(gltf.scene);
          return;
        }
        loadingEl?.classList.add('hidden');
        this.clearCurrentModel();

        const root = gltf.scene;

        for (const t of this.sceneData.transforms || []) {
          if (t.type === 'RotateTransform') {
            root.rotation.x += THREE.MathUtils.degToRad(Number(t.x) || 0);
            root.rotation.y += THREE.MathUtils.degToRad(Number(t.y) || 0);
            root.rotation.z += THREE.MathUtils.degToRad(Number(t.z) || 0);
          } else if (t.type === 'ScaleTransform') {
            root.scale.multiply(
              new THREE.Vector3(Number(t.x) || 1, Number(t.y) || 1, Number(t.z) || 1)
            );
          } else if (t.type === 'TranslateTransform') {
            root.position.add(
              new THREE.Vector3(Number(t.x) || 0, Number(t.y) || 0, Number(t.z) || 0)
            );
          }
        }

        const box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 1.6 / maxDim;

        root.position.sub(center);
        this.wrapperGroup = new THREE.Group();
        this.wrapperGroup.add(root);
        this.wrapperGroup.scale.setScalar(scale);

        this.applyWireframeState();

        this.scene.add(this.wrapperGroup);
        this.fitCameraToObject();

        this.modelStats = this.computeModelStats(this.wrapperGroup);
        const statsEl = this.container.querySelector('[data-el="three-stats"]');
        if (statsEl && this.modelStats.meshes > 0) {
          statsEl.textContent = `${this.modelStats.meshes} mesh${this.modelStats.meshes === 1 ? '' : 'es'} • ${this.modelStats.triangles.toLocaleString()} tris`;
          statsEl.classList.remove('hidden');
        }
        this.onModelLoaded?.(this.modelStats);
      },
      (xhr) => {
        if (generation !== this.loadGeneration) return;
        if (xhr.lengthComputable && progressEl) {
          const pct = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
          progressEl.textContent = `${pct}%`;
        }
      },
      () => {
        if (this.destroyed || generation !== this.loadGeneration) return;
        loadingEl?.classList.add('hidden');
        this.showLoadError(url);
      }
    );
  }

  showLoadError(url) {
    const loadingEl = this.container.querySelector('[data-el="three-loading"]');
    const errorEl = this.container.querySelector('[data-el="three-error"]');
    const errorMsgEl = this.container.querySelector('[data-el="three-error-msg"]');
    loadingEl?.classList.add('hidden');
    if (!errorEl || !errorMsgEl) return;

    const protocolHint =
      window.location.protocol === 'file:'
        ? ' You are viewing over file:// — run "npm run dev" or select the local .glb file below.'
        : ' Ensure the server sends Access-Control-Allow-Origin headers or configure proxyRoutes / assetProxyUrl, or select the .glb file directly:';
    errorMsgEl.textContent =
      url === 'No 3D model URL was provided.'
        ? url
        : `Could not fetch 3D model from ${url}.${protocolHint}`;
    errorEl.classList.remove('hidden');
    const announcement = this.container.querySelector('[data-el="three-error-announcement"]');
    if (announcement) announcement.textContent = 'Could not load the 3D model. See the error message for details.';
  }

  fitCameraToObject() {
    if (this.wrapperGroup) {
      const box = new THREE.Box3().setFromObject(this.wrapperGroup);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const fovRad = THREE.MathUtils.degToRad(this.camera.fov);
      const dist = sphere.radius > 0 ? (sphere.radius / Math.sin(fovRad / 2)) * 1.15 : 2.35;
      this.defaultCameraDistance = Math.max(1.2, Math.min(dist, 6));
    } else {
      this.defaultCameraDistance = 2.35;
    }

    this.defaultCameraPos.set(0, this.defaultCameraDistance * 0.11, this.defaultCameraDistance);
    this.camera.position.copy(this.defaultCameraPos);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  setCameraPreset(preset) {
    const d = this.defaultCameraDistance;
    this.controls.target.set(0, 0, 0);
    if (preset === 'front') {
      this.camera.position.set(0, 0, d);
    } else if (preset === 'top') {
      this.camera.position.set(0, d, 0.001);
    } else if (preset === 'side') {
      this.camera.position.set(d, 0, 0);
    }
    this.controls.update();
  }

  applyWireframeState() {
    if (!this.wrapperGroup) return;
    this.wrapperGroup.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          m.wireframe = this.state.wireframe;
        });
      }
    });
  }

  syncControlButtons() {
    const map = {
      autorotate: this.state.autoRotate,
      wireframe: this.state.wireframe,
      lighting: this.state.warmLight,
    };
    Object.entries(map).forEach(([action, active]) => {
      const btn = this.container.querySelector(`[data-three-action="${action}"]`);
      if (!btn) return;
      btn.classList.toggle('bg-purple-600', active);
      btn.classList.toggle('text-white', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  bindControls() {
    this.container.addEventListener('change', (e) => {
      if (
        e.target.matches('[data-el="three-file-input"]') ||
        e.target.matches('[data-el="three-toolbar-file"]')
      ) {
        const file = e.target.files?.[0];
        if (!file) return;
        const blobUrl = URL.createObjectURL(file);
        this.objectUrls.push(blobUrl);
        this.loadModel(blobUrl);
        e.target.value = '';
      }
    });

    this.container.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('[data-three-view]');
      if (viewBtn) {
        this.setCameraPreset(viewBtn.dataset.threeView);
        return;
      }

      const btn = e.target.closest('[data-three-action]');
      if (!btn) return;

      const action = btn.dataset.threeAction;
      if (action === 'open-toolbar-file' || action === 'open-error-file') {
        const input = action === 'open-toolbar-file' ? 'three-toolbar-file' : 'three-file-input';
        this.container.querySelector(`[data-el="${input}"]`)?.click();
      } else if (action === 'reset') {
        this.fitCameraToObject();
      } else if (action === 'rotate-left') {
        this.controls.rotateLeft(0.2);
      } else if (action === 'rotate-right') {
        this.controls.rotateLeft(-0.2);
      } else if (action === 'rotate-up') {
        this.controls.rotateUp(0.2);
      } else if (action === 'rotate-down') {
        this.controls.rotateUp(-0.2);
      } else if (action === 'pan-left') {
        this.controls.pan(40, 0);
      } else if (action === 'pan-right') {
        this.controls.pan(-40, 0);
      } else if (action === 'pan-up') {
        this.controls.pan(0, 40);
      } else if (action === 'pan-down') {
        this.controls.pan(0, -40);
      } else if (action === 'zoom-in') {
        this.controls.dollyIn(0.8);
      } else if (action === 'zoom-out') {
        this.controls.dollyOut(0.8);
      } else if (action === 'autorotate') {
        this.state.autoRotate = !this.state.autoRotate;
        this.controls.autoRotate = this.state.autoRotate;
        this.controls.autoRotateSpeed = 2.0;
        this.syncControlButtons();
      } else if (action === 'wireframe') {
        this.state.wireframe = !this.state.wireframe;
        this.applyWireframeState();
        this.syncControlButtons();
      } else if (action === 'lighting') {
        this.state.warmLight = !this.state.warmLight;
        if (this.state.warmLight) {
          this.ambientLight.intensity = 0.35;
          this.keyLight.color.setHex(0xfff1d6);
          this.keyLight.intensity = 2.1;
          this.keyLight.position.set(4, 0.6, 1.2);
        } else {
          this.ambientLight.intensity = 0.85;
          this.keyLight.color.setHex(0xffffff);
          this.keyLight.intensity = 1.4;
          this.keyLight.position.set(2.5, 3.5, 3);
        }
        this.syncControlButtons();
      }
    });
  }

  setTheme(theme) {
    this.theme = theme;
    this.updateSceneBackground();
  }

  updateSceneBackground() {
    if (!this.scene) return;
    this.scene.background = new THREE.Color(this.theme === 'dark' ? 0x020617 : 0xf1f5f9);
  }

  handleResize() {
    const host = this.container.querySelector('[data-el="three-canvas-host"]');
    if (!host || !this.renderer || !this.camera) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  destroy() {
    this.destroyed = true;
    this.loadGeneration++;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.dracoLoader?.dispose();
    this.clearCurrentModel();
    this.objectUrls.forEach((u) => URL.revokeObjectURL(u));
    this.renderer?.dispose();
    this.container.innerHTML = '';
  }
}