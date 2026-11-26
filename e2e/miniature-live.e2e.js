import { expect, test } from '@playwright/test';

test('loads the Fitzwilliam miniature ruler and image choices', async ({ page }) => {
  test.skip(process.env.IIIF_LIVE_TEST !== '1', 'Set IIIF_LIVE_TEST=1 to test the external service.');
  test.setTimeout(120000);
  const imageRequests = [];
  const imageResponses = [];
  page.on('request', (request) => {
    if (request.url().includes('iiif.fitz.ms/iiif/3/')) imageRequests.push(request.url());
  });
  page.on('response', (response) => {
    if (response.url().includes('iiif.fitz.ms/iiif/3/')) imageResponses.push({ url: response.url(), status: response.status() });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Miniature (v3)' }).click();
  await expect(page.locator('[data-el="manifest-title"]')).toHaveText('A lady, said to be Lucy, Countess of Carlisle');
  await page.locator('[data-inspect="ruler"]').click();
  await expect(page.locator('[data-inspect="scale-status"]')).toContainText('0.0171 mm per image pixel');
  await page.locator('[data-inspect="curtain"]').click();
  await expect(page.locator('[data-inspect="layers"]')).toContainText('Raking Light', { timeout: 90000 });
  await expect(page.locator('[data-inspect="layers"]')).toContainText('MA-XRF Zinc (Zn)');
  await expect(page.locator('[data-layer-visibility]')).toHaveCount(16);
  await expect(page.locator('[data-layer-visibility="0"]')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => imageRequests.some((url) => /\/full\/|\/\d+,\d+,\d+,\d+\//.test(url))).toBe(true);
  expect(imageRequests.filter((url) => url.startsWith('http:'))).toEqual([]);
  await page.locator('[data-layer-visibility="0"]').click();
  await expect(page.locator('[data-layer-visibility="0"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => imageResponses.some(({ url, status }) =>
    url.startsWith('https://iiif.fitz.ms/iiif/3/0f45b367-270a-4c2d-a7ed-db4d62976b02.jpg/') &&
    !url.endsWith('info.json') && status === 200), { timeout: 30000 }).toBe(true);
  expect(imageRequests.filter((url) => url.startsWith('http:'))).toEqual([]);
});
