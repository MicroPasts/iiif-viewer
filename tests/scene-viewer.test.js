// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

const mocks = vi.hoisted(() => ({ loads: [], renderer: null, draco: null }));
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    WebGLRenderer: class {
      constructor() {
        this.domElement = document.createElement('canvas');
        this.setSize = vi.fn(); this.setPixelRatio = vi.fn(); this.render = vi.fn(); this.dispose = vi.fn();
        mocks.renderer = this;
      }
    },
  };
});
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    constructor() {
      this.target = { set: vi.fn() }; this.update = vi.fn(); this.dispose = vi.fn();
      this.listenToKeyEvents = vi.fn(); this.dollyIn = vi.fn(); this.dollyOut = vi.fn();
      this.pan = vi.fn(); this.rotateLeft = vi.fn(); this.rotateUp = vi.fn();
    }
  },
}));
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    setCrossOrigin() {}
    setDRACOLoader() {}
    load(url, success, progress, error) { mocks.loads.push({ url, success, progress, error }); }
  },
}));
vi.mock('three/examples/jsm/loaders/DRACOLoader.js', () => ({
  DRACOLoader: class {
    constructor() { this.dispose = vi.fn(); mocks.draco = this; }
    setDecoderPath() {}
  },
}));

import { BuiltInSceneViewer } from '../src/scene-viewer.js';

function model() {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  root.add(mesh);
  return { root, mesh };
}

beforeEach(() => {
  mocks.loads.length = 0;
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe('3D scene viewer', () => {
  it('loads a model, keeps wireframe enabled across replacements and updates controls', () => {
    const container = document.createElement('div');
    const onModelLoaded = vi.fn();
    const viewer = new BuiltInSceneViewer(container, { modelUrl: 'first.glb' }, { onModelLoaded });
    const first = model();
    mocks.loads[0].success({ scene: first.root });
    expect(onModelLoaded).toHaveBeenCalledWith(expect.objectContaining({ meshes: 1, triangles: 12 }));
    const wireframe = container.querySelector('[data-three-action="wireframe"]');
    wireframe.click();
    expect(wireframe.getAttribute('aria-pressed')).toBe('true');
    expect(first.mesh.material.wireframe).toBe(true);

    viewer.loadModel('second.glb');
    const second = model();
    mocks.loads[1].success({ scene: second.root });
    expect(second.mesh.material.wireframe).toBe(true);
    container.querySelector('[data-three-view="top"]').click();
    expect(viewer.camera.position.y).toBeGreaterThan(0);
    viewer.destroy();
    expect(mocks.renderer.dispose).toHaveBeenCalled();
    expect(mocks.draco.dispose).toHaveBeenCalled();
  });

  it('ignores stale loads and disposes their geometry', () => {
    const viewer = new BuiltInSceneViewer(document.createElement('div'), { modelUrl: 'first.glb' });
    viewer.loadModel('second.glb');
    const old = model();
    const dispose = vi.spyOn(old.mesh.geometry, 'dispose');
    mocks.loads[0].success({ scene: old.root });
    expect(dispose).toHaveBeenCalled();
    expect(viewer.wrapperGroup).toBeNull();
    const current = model();
    mocks.loads[1].success({ scene: current.root });
    expect(viewer.wrapperGroup.children).toContain(current.root);
    viewer.destroy();
  });

  it('shows loading errors and ignores callbacks after destruction', () => {
    const container = document.createElement('div');
    const viewer = new BuiltInSceneViewer(container, { modelUrl: 'bad.glb' });
    mocks.loads[0].error();
    expect(container.querySelector('[data-el="three-error"]').classList.contains('hidden')).toBe(false);
    expect(container.querySelector('[data-el="three-error-msg"]').textContent).toContain('bad.glb');
    expect(container.querySelector('[role="alert"]').textContent).toContain('Could not load the 3D model');
    viewer.destroy();
    const late = model();
    const dispose = vi.spyOn(late.mesh.geometry, 'dispose');
    mocks.loads[0].success({ scene: late.root });
    expect(dispose).toHaveBeenCalled();
  });

  it('provides keyboard and single-pointer alternatives for model controls', () => {
    const container = document.createElement('div');
    const viewer = new BuiltInSceneViewer(container, { modelUrl: 'model.glb' });
    const canvas = container.querySelector('canvas');
    expect(canvas.tabIndex).toBe(0);
    expect(canvas.getAttribute('aria-label')).toContain('Shift and arrow keys');
    expect(viewer.controls.listenToKeyEvents).toHaveBeenCalledWith(canvas);
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    expect(viewer.controls.dollyIn).toHaveBeenCalledWith(0.8);
    container.querySelector('[data-three-action="rotate-left"]').click();
    container.querySelector('[data-three-action="pan-up"]').click();
    expect(viewer.controls.rotateLeft).toHaveBeenCalledWith(0.2);
    expect(viewer.controls.pan).toHaveBeenCalledWith(0, 40);
    const fileInput = container.querySelector('[data-el="three-toolbar-file"]');
    const openFile = vi.spyOn(fileInput, 'click');
    container.querySelector('[data-three-action="open-toolbar-file"]').click();
    expect(openFile).toHaveBeenCalledOnce();
    viewer.destroy();
  });
});
