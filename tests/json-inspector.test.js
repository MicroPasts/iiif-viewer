// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JsonInspector } from '../src/json-inspector.js';

function setup() {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = '<button data-action="toggle-json-inspector"></button><aside data-el="json-inspector" hidden></aside>';
  document.body.append(wrapper);
  return { wrapper, inspector: new JsonInspector(wrapper) };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('JSON inspector', () => {
  it('updates v2 and v3 canvas selection and preserves manifest tree on navigation', () => {
    const { wrapper, inspector } = setup();
    const v3 = { type: 'Manifest', items: [{ id: 'one' }, { id: 'two' }] };
    const parsed = { isV3: true, canvases: [{ label: 'One' }, { label: 'Two' }] };
    inspector.setManifest(v3, parsed);
    inspector.toggle();
    const tree = wrapper.querySelector('[data-json-content] > div');
    inspector.setCanvas(1);
    expect(wrapper.querySelector('[data-json-content] > div')).toBe(tree);
    expect(wrapper.querySelector('[data-json-context]').textContent).toContain('Two');
    const scope = wrapper.querySelector('[data-json-scope]');
    scope.value = 'canvas';
    scope.dispatchEvent(new Event('change', { bubbles: true }));
    expect(inspector.selected()).toBe(v3.items[1]);
    inspector.setCanvas(0);
    expect(inspector.selected()).toBe(v3.items[0]);
    const v2 = { sequences: [{ canvases: [{ '@id': 'v2-one' }, { '@id': 'v2-two' }] }] };
    inspector.setManifest(v2, { ...parsed, isV3: false });
    inspector.setCanvas(1);
    expect(inspector.selected()).toBe(v2.sequences[0].canvases[1]);
    inspector.setManifest({ type: 'Manifest', items: ['https://example.test/canvas'] }, parsed);
    expect(wrapper.querySelector('[data-json-content]').textContent).toContain('https://example.test/canvas');
    inspector.setManifest({ type: 'AnnotationPage', items: [] }, parsed);
    expect(wrapper.querySelector('[data-json-status]').textContent).toContain('No original canvas');
    expect(wrapper.querySelector('[data-json-action="copy"]').disabled).toBe(true);
    inspector.destroy();
  });

  it('renders highlighted JSON as text, handles clipboard failures, and downloads selected JSON', async () => {
    const { wrapper, inspector } = setup();
    const raw = { label: '<img src=x onerror=alert(1)>', number: 5, flag: true };
    inspector.setManifest(raw, { isV3: true, canvases: [] });
    inspector.toggle();
    wrapper.querySelector('[data-json-view="raw"]').click();
    expect(wrapper.querySelector('[data-json-content] img')).toBeNull();
    expect(wrapper.querySelector('.iiif-json-string').textContent).toContain('<img');
    expect(wrapper.querySelector('.iiif-json-number').textContent).toBe('5');
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await inspector.copy();
    expect(writeText).toHaveBeenCalledWith(JSON.stringify(raw, null, 2));
    writeText.mockRejectedValue(new Error('permission denied'));
    await inspector.copy();
    expect(wrapper.querySelector('[data-json-status]').textContent).toContain('permission denied');
    const create = vi.fn().mockReturnValue('blob:test');
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.download).toBe('manifest.json');
    });
    vi.useFakeTimers();
    inspector.download();
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:test');
    vi.useRealTimers();
    inspector.destroy();
  });
});
