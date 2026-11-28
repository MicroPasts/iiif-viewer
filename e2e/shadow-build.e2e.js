import { expect, test } from '@playwright/test';

test.skip(!process.env.RUN_BUILD_E2E, 'Run npm run build and set RUN_BUILD_E2E=1.');

for (const format of ['ES module', 'UMD']) {
  test(`${format} bundle isolates host styles and supports theming and cleanup`, async ({ page }) => {
    await page.goto('/e2e/shadow-fixture.html');
    const hostStyles = () => page.evaluate(() => ['h1', 'body > button'].map((selector) => {
      const style = getComputedStyle(document.querySelector(selector));
      return [style.fontSize, style.fontWeight, style.margin, style.padding, style.borderStyle];
    }));
    const before = await hostStyles();
    if (format === 'UMD') {
      await page.route('**/dist/iiif-viewer.umd.cjs', async (route) => {
        const response = await route.fetch();
        await route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'text/javascript' } });
      });
      await page.addScriptTag({ url: '/dist/iiif-viewer.umd.cjs' });
    }
    await page.evaluate(async (bundleFormat) => {
      const Viewer = bundleFormat === 'UMD'
        ? window.IIIFViewer.IIIFViewer
        : (await import('/dist/iiif-viewer.js')).IIIFViewer;
      window.viewer = new Viewer('#viewer', { themeVars: { '--iiif-accent': '#b45309' } });
    }, format);
    expect(await hostStyles()).toEqual(before);
    const host = page.locator('#viewer');
    const load = host.getByRole('button', { name: 'Load', exact: true });
    await expect(load).toHaveCSS('background-color', 'rgb(180, 83, 9)');
    await page.evaluate(() => window.viewer.setThemeVars({ '--iiif-accent': '#0f766e' }));
    await expect(load).toHaveCSS('background-color', 'rgb(15, 118, 110)');
    await expect(host.locator('[data-el="viewer-root"]')).not.toHaveCSS('box-shadow', 'none');
    const coverage = await host.evaluate((element) => {
      const registered = [];
      let defaults;
      const visit = (rules) => {
        for (const rule of rules) {
          if (rule.constructor.name === 'CSSPropertyRule' && rule.name.startsWith('--tw-')) registered.push(rule.name);
          if (rule.selectorText?.includes('.iiif-theme *') && rule.style?.getPropertyValue('--tw-border-style')) defaults = rule.style;
          if (rule.cssRules) visit(rule.cssRules);
        }
      };
      visit(element.shadowRoot.querySelector('style').sheet.cssRules);
      return { count: registered.length, missing: registered.filter((name) => !defaults?.getPropertyValue(name)) };
    });
    expect(coverage.count).toBeGreaterThan(0);
    expect(coverage.missing).toEqual([]);
    await page.evaluate(() => window.viewer.destroy());
    await expect(host.locator('[data-el="viewer-root"]')).toHaveCount(0);
    expect(await host.evaluate((element) => element.shadowRoot.childNodes.length)).toBe(0);
    expect(await hostStyles()).toEqual(before);
  });
}
