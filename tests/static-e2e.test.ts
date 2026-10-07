import { expect, test } from '@playwright/test';

test('the published page loads React, CSS, fonts and local assets', async ({ page, request, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const failures: string[] = [];
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', (networkRequest) => requests.push(networkRequest.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (new URL(response.url()).origin === origin && response.status() >= 400) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (networkRequest) => {
    if (new URL(networkRequest.url()).origin === origin && networkRequest.failure()?.errorText !== 'net::ERR_ABORTED') {
      failures.push(networkRequest.url());
    }
  });

  const response = await request.get('/');
  const html = await response.text();
  expect(response.ok()).toBeTruthy();
  expect(html).not.toContain('/src/main.tsx');
  expect(html).not.toContain('/fonts/fonts.css');
  expect(html).toMatch(/\/assets\/[^"']+-[\w-]+\.js/);
  expect(html).toMatch(/\/assets\/[^"']+-[\w-]+\.css/);

  await page.goto('/');
  await expect(page.locator('#root nav')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shoppable discoveries', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lookbooks', exact: true })).toBeVisible();
  await expect(page.locator('main > section img').first()).toBeVisible();
  await expect.poll(() => page.locator('main > section img').first().evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);

  await page.evaluate(async () => {
    await document.fonts.load('16px "DM Sans"');
    await document.fonts.load('16px "Libre Caslon Text"');
    await document.fonts.ready;
  });
  const loadedStyles = await page.evaluate(() => ({
    display: getComputedStyle(document.querySelector('#root nav > div > div')!).display,
    font: getComputedStyle(document.body).fontFamily,
    fonts: [...document.fonts].filter((font) => font.status === 'loaded').map((font) => font.family),
  }));
  expect(loadedStyles.display).toBe('flex');
  expect(loadedStyles.font).toContain('DM Sans');
  expect(loadedStyles.fonts.join(' ')).toContain('DM Sans');
  expect(loadedStyles.fonts.join(' ')).toContain('Libre Caslon Text');
  expect(requests.some((url) => /\/assets\/.*\.woff2/.test(url))).toBeTruthy();
  expect(requests.filter((url) => /\/src\/main\.tsx|\/fonts\/fonts\.css/.test(url))).toEqual([]);
  expect(failures).toEqual([]);
  expect(errors).toEqual([]);
});
