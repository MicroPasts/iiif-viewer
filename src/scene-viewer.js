import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { escapeHtml } from './template.js';

export class BuiltInSceneViewer {
  constructor(container, sceneData, options = {}) {
    this.container = container;
    this.sceneData = sceneData;
    this.theme = options.theme || 'dark';
    this.title = options.title || '3D Scene';
    this.resolvedModelUrl = options.resolvedModelUrl || sceneData.modelUrl;
    this.dracoDecoderPath =
      options.dracoDecoderPath || 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

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
    this.defaultCameraPos = new THREE.Vector3(0, 0.25, 2.35);

    this.mount();
  }

  mount() {
    this.container.innerHTML = `
      <div class="relative w-full h-full flex flex-col select-none">
        <div data-el="three-canvas-host" class="w-full h-full cursor-grab active:cursor-grabbing"></div>

        <!-- 3D Loading Indicator -->
        <div data-el="three-loading" class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-100/85 dark:bg-slate-950/85 backdrop-blur-xs text-xs font-medium text-slate-700 dark:text-slate-300 gap-2">
          <span>Loading 3D Model (.glb)...</span>
          <span data-el="three-progress" class="font-mono text-[11px] text-purple-600 dark:text-purple-400">0%</span>
        </div>

        <!-- 3D Error Overlay with Local File Fallback -->
        <div data-el="three-error" class="hidden absolute top-14 left-4 right-4 z-20 p-4 rounded-lg bg-red-50 dark:bg-red-950/95 border border-red-300 dark:border-red-800 text-xs text-red-800 dark:text-red-200 space-y-2.5">
          <p data-el="three-error-msg" class="break-all"></p>
          <div class="flex flex-wrap items-center gap-2">
            <label class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium cursor-pointer transition">
              <span>Select Local .GLB File</span>
              <input type="file" data-el="three-file-input" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" class="hidden" />
            </label>
          </div>
        </div>

        <!-- Interactive 3D Controls Bar -->
        <div class="absolute top-3 left-1/2 -translate-x-1/2 z-10 inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow-md backdrop-blur-xs text-[11px] font-medium">
          <button type="button" data-three-action="reset" title="Reset Camera" class="px-2.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Reset View
          </button>
          <button type="button" data-three-action="autorotate" title="Toggle Auto-Rotate" aria-pressed="false" class="px-2.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Auto-Rotate
          </button>
          <button type="button" data-three-action="wireframe" title="Toggle Wireframe" aria-pressed="false" class="px-2.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Wireframe
          </button>
          <button type="button" data-three-action="lighting" title="Toggle Raking / Warm Light" aria-pressed="false" class="px-2.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Raking Light
          </button>
          <label title="Open Local .GLB File" class="px-2.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition">
            Open .GLB
            <input type="file" data-el="three-toolbar-file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" class="hidden" />
          </label>
          <a href="${escapeHtml(this.resolvedModelUrl)}" download title="Download GLB" class="px-2.5 py-1 rounded text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 transition">
            &darr; GLB
          </a>
        </div>

        <!-- Controls Hint -->
        <div class="hidden sm:block absolute bottom-3 right-3 z-10 px-2.5 py-1 rounded bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 pointer-events-none">
          Left-drag: Rotate &bull; Right-drag: Pan &bull; Scroll: Zoom
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

  loadModel(url) {
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
    const errorMsgEl = this.container.querySelector('[data-el="three-error-msg"]');

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

        if (this.state.wireframe) {
          this.wrapperGroup.traverse((obj) => {
            if (obj.isMesh && obj.material) {
              const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
              materials.forEach((material) => {
                material.wireframe = true;
              });
            }
          });
        }

        this.scene.add(this.wrapperGroup);
        this.fitCameraToObject();
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
  }

  fitCameraToObject() {
    this.defaultCameraPos.set(0, 0.25, 2.35);
    this.camera.position.copy(this.defaultCameraPos);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
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
      const btn = e.target.closest('[data-three-action]');
      if (!btn) return;

      const action = btn.dataset.threeAction;
      if (action === 'reset') {
        this.fitCameraToObject();
      } else if (action === 'autorotate') {
        this.state.autoRotate = !this.state.autoRotate;
        this.controls.autoRotate = this.state.autoRotate;
        this.controls.autoRotateSpeed = 2.0;
        btn.classList.toggle('bg-purple-600', this.state.autoRotate);
        btn.classList.toggle('text-white', this.state.autoRotate);
        btn.setAttribute('aria-pressed', String(this.state.autoRotate));
      } else if (action === 'wireframe') {
        this.state.wireframe = !this.state.wireframe;
        this.scene.traverse((obj) => {
          if (obj.isMesh && obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => {
              m.wireframe = this.state.wireframe;
            });
          }
        });
        btn.classList.toggle('bg-purple-600', this.state.wireframe);
        btn.classList.toggle('text-white', this.state.wireframe);
        btn.setAttribute('aria-pressed', String(this.state.wireframe));
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
        btn.classList.toggle('bg-purple-600', this.state.warmLight);
        btn.classList.toggle('text-white', this.state.warmLight);
        btn.setAttribute('aria-pressed', String(this.state.warmLight));
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