import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/explore', '/methodology', '/es', '/es/explore', '/es/methodology', '/explore?view=graph&rel=1', '/explore?view=matrix&d=variant', '/es/explore?view=graph&c=kylo-ren'];

for (const path of PAGES) {
  test(`@mobile ${path} has no horizontal scroll and no axe violations`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(path);
    if (path.includes('explore')) await expect(page.getByTestId('explorer')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('security headers and nonce CSP on pages', async ({ request }) => {
  const res = await request.get('/explore');
  const h = res.headers();
  expect(h['content-security-policy']).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(h['content-security-policy']).toContain("connect-src 'self'");
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(h['permissions-policy']).toContain('camera=()');
  expect(h['strict-transport-security']).toContain('max-age=31536000');
  expect(h['cache-control']).toContain('no-store');
  expect(h['set-cookie']).toBeUndefined();
});

test('robots, sitemap, llms.txt, health, and bundle caching', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Content-Signal: search=yes, ai-input=yes, ai-train=no');
  expect(robots).not.toMatch(/ClaudeBot|GPTBot/);
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/es/methodology');
  expect(sitemap).toContain('<lastmod>2026-09-24');
  expect(await (await request.get('/llms.txt')).text()).toContain('Methodology');
  expect((await request.get('/api/health')).status()).toBe(200);
  const index = await (await request.get('/bundles/index.json')).json();
  const manifestRes = await request.get(`/bundles/${index.default_version}/manifest.json`);
  expect(manifestRes.headers()['cache-control']).toContain('must-revalidate');
  const manifest = await manifestRes.json();
  const fileRes = await request.get(`/bundles/${manifest.version}/${manifest.files[0].path}`);
  expect(fileRes.headers()['cache-control']).toContain('immutable');
});

test('methodology lists claim outcomes and a versioned download', async ({ page }) => {
  await page.goto('/methodology');
  await expect(page.getByTestId('claims-table').locator('tbody tr')).toHaveCount(10);
  const href = await page.getByTestId('methodology-zip').getAttribute('href');
  expect(href).toMatch(/^\/bundles\/\d{4}-\d{2}-\d{2}\.\d+\/swatlas-[\d.-]+\.[0-9a-f]{12}\.zip$/);
});

test('social image renders from the bundle in both locales', async ({ page, request }) => {
  for (const path of ['/', '/es']) {
    await page.goto(path);
    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    const res = await request.get(new URL(og!).pathname + new URL(og!).search);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
  }
});
