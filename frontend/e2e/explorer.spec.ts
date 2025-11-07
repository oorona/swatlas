import { expect, test } from '@playwright/test';
import { bundle, neighborIds, openExplorer, selectedName } from './helpers';

const { manifest, file } = bundle();

test('default view: all 15, PCA, authored, Luke selected with five scored neighbors', async ({ page }) => {
  await openExplorer(page);
  await expect(selectedName(page)).toHaveText('Luke Skywalker');
  await expect(page.getByTestId('visible-count')).toHaveAttribute('data-visible', '15');
  await expect(page.locator('#projection-select')).toHaveValue('pca');
  await expect(page.locator('[data-mode="authored"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('neighbors').locator('li')).toHaveCount(5);
  await expect(page.getByRole('listbox').getByRole('option', { selected: true })).toContainText('Luke Skywalker');
  await expect(page.getByTestId('draft-badge')).toBeVisible();
});

test('rankings come from the shipped matrix, including contradictions of the article', async ({ page }) => {
  await openExplorer(page);
  const sim = file(manifest.modes.authored.files.similarity);
  const i = sim.ids.indexOf('luke-skywalker');
  const expected = sim.ids
    .map((id: string, j: number) => ({ id, s: sim.matrix[i][j] }))
    .filter((x: { id: string }) => x.id !== 'luke-skywalker')
    .sort((a: { id: string; s: number }, b: { id: string; s: number }) => b.s - a.s || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map((x: { id: string }) => x.id);
  expect(await neighborIds(page)).toEqual(expected);
});

test('switching PCA/UMAP moves points but leaves neighbors unchanged', async ({ page }) => {
  await openExplorer(page);
  const before = await neighborIds(page);
  const pcaX = await page.locator('[data-testid="map-svg"] g[data-id="yoda"]').getAttribute('data-x');
  await page.locator('#projection-select').selectOption('umap-42');
  await expect(page.getByTestId('map-svg')).toHaveAttribute('data-projection', 'umap-42');
  const umapX = await page.locator('[data-testid="map-svg"] g[data-id="yoda"]').getAttribute('data-x');
  expect(umapX).not.toBe(pcaX);
  expect(await neighborIds(page)).toEqual(before);
});

test('changing view keeps the selection', async ({ page }) => {
  await openExplorer(page, '?c=yoda');
  await expect(selectedName(page)).toHaveText('Yoda');
  for (const view of ['graph', 'matrix', 'map']) {
    await page.locator(`[data-view="${view}"]`).click();
    await expect(selectedName(page)).toHaveText('Yoda');
    await expect(page).toHaveURL(new RegExp(`view=${view}`));
  }
});

test('threshold 1 yields exactly the matrix-eligible pairs', async ({ page }) => {
  const sim = file(manifest.modes.authored.files.similarity);
  const count = (t: number) => {
    let n = 0;
    for (let i = 0; i < 15; i++) for (let j = i + 1; j < 15; j++) if (sim.matrix[i][j] >= t) n++;
    return n;
  };
  await openExplorer(page, '?view=graph&t=1.00');
  await expect(page.getByTestId('edge-count')).toHaveAttribute('data-edges', String(count(1)));
  if (count(1) === 0) await expect(page.getByTestId('no-edges')).toBeVisible();
  await page.getByTestId('threshold-input').fill('0.45');
  await page.getByTestId('threshold-input').press('Enter');
  await expect(page.getByTestId('edge-count')).toHaveAttribute('data-edges', String(count(0.45)));
  await expect(page.locator('[data-testid="similarity-edges"] line')).toHaveCount(count(0.45));
});

test('description variant uses its own vectors, hash, and neighbors, with a diff', async ({ page }) => {
  await openExplorer(page, '?c=kylo-ren');
  const before = await neighborIds(page);
  const hashBefore = await page.getByTestId('input-hash').textContent();
  await page.locator('[data-mode="relationships_removed"]').click();
  await expect(page.getByTestId('diff')).toContainText('son of Han Solo');
  await expect(page.getByTestId('input-hash')).not.toHaveText(hashBefore!);
  await expect(page.getByTestId('input-hash')).toContainText(manifest.modes.relationships_removed.input_hash);
  expect(await neighborIds(page)).not.toEqual(before);
});

test('filters hide characters and recompute visible neighbors from the same matrix', async ({ page }) => {
  await openExplorer(page);
  await page.locator('[data-filter="force_status:not_sensitive"]').check();
  await expect(page.getByTestId('visible-count')).toHaveAttribute('data-visible', '3');
  const ids = await neighborIds(page);
  expect(ids.sort()).toEqual(['boba-fett', 'din-djarin', 'han-solo']);
  await expect(page.getByText(/hidden by the current filters/)).toBeVisible();
  await expect(page).toHaveURL(/fs=not_sensitive/);
});

test('shared URL reproduces state after reload', async ({ page }) => {
  await openExplorer(page);
  await page.getByRole('option', { name: /Darth Vader/ }).click();
  await page.locator('[data-view="graph"]').click();
  await page.locator('#projection-select').selectOption('umap-21');
  await page.locator('[data-mode="relationships_removed"]').click();
  await page.getByTestId('threshold-input').fill('0.6');
  await page.getByTestId('threshold-input').press('Enter');
  await page.locator('[data-filter="eras:prequel"]').check();
  await page.locator('#curated-toggle').check();
  const url = page.url();
  await page.goto(url);
  await expect(selectedName(page)).toHaveText('Darth Vader');
  await expect(page.locator('#projection-select')).toHaveValue('umap-21');
  await expect(page.locator('[data-mode="relationships_removed"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('threshold-input')).toHaveValue('0.60');
  await expect(page.locator('[data-filter="eras:prequel"]')).toBeChecked();
  await expect(page.locator('#curated-toggle')).toBeChecked();
  expect(url).toContain(`v=${manifest.version}`);
});

test('copy link confirms in-page and reset restores defaults', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openExplorer(page, '?c=rey&view=matrix');
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('notice')).toContainText(/copied|Select and copy/);
  await page.getByTestId('reset').click();
  await expect(selectedName(page)).toHaveText('Luke Skywalker');
  await expect(page.locator('[data-view="map"]')).toHaveAttribute('aria-pressed', 'true');
});

test('unknown character shows a recoverable error and selects no one', async ({ page }) => {
  await openExplorer(page, '?c=jar-jar-binks');
  await expect(page.getByTestId('unknown-character')).toBeVisible();
  await expect(page.getByTestId('details')).not.toHaveAttribute('data-selected');
  await page.getByRole('button', { name: 'Select Luke Skywalker' }).click();
  await expect(selectedName(page)).toHaveText('Luke Skywalker');
  await expect(page.getByTestId('unknown-character')).toBeHidden();
});

test('unknown version shows an unavailable-version state with a way back', async ({ page }) => {
  await openExplorer(page, '?v=2001-01-01.1&c=yoda');
  await expect(page.getByTestId('explorer-error')).toHaveAttribute('data-code', 'unavailable-version');
  await page.getByRole('link', { name: /Open the current version/ }).click();
  await expect(selectedName(page)).toHaveText('Luke Skywalker');
});

test('malformed URL fields are reset with an explanation', async ({ page }) => {
  await openExplorer(page, '?view=cube&t=9');
  await expect(page.getByTestId('url-issues')).toContainText('Unknown view');
  await expect(page.getByTestId('url-issues')).toContainText('Threshold');
});

test('keyboard-only: list selection, mode switch, and matrix navigation', async ({ page }) => {
  await openExplorer(page);
  const list = page.getByTestId('character-list');
  await list.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(selectedName(page)).toHaveText('Boba Fett');
  await page.locator('[data-mode="relationships_removed"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('diff')).toBeVisible();
  await page.locator('[data-view="matrix"]').focus();
  await page.keyboard.press('Space');
  await page.locator('[data-cell="0-0"]').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(selectedName(page)).toHaveText('Chewbacca');
});

test('table equivalents exist for map, graph, and matrix', async ({ page }) => {
  await openExplorer(page);
  await page.getByTestId('table-toggle').click();
  await expect(page.getByTestId('map-table').locator('tbody tr')).toHaveCount(15);
  await page.locator('[data-view="graph"]').click();
  await expect(page.getByTestId('graph-table')).toBeVisible();
  await page.locator('[data-view="matrix"]').click();
  await expect(page.getByTestId('matrix-table').locator('tbody tr')).toHaveCount(15);
});

test('works with every non-same-origin request blocked, and makes none', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    external.push(url);
    return route.abort();
  });
  await openExplorer(page);
  await expect(page.getByTestId('neighbors').locator('li')).toHaveCount(5);
  await page.locator('[data-view="graph"]').click();
  await page.locator('[data-mode="relationships_removed"]').click();
  await expect(page.getByTestId('neighbors').locator('li')).toHaveCount(5);
  expect(external).toEqual([]);
});

test('dragging a point moves it and its links, without selecting it or changing scores', async ({ page }) => {
  await openExplorer(page, '?c=luke-skywalker');
  const before = await neighborIds(page);
  const svg = page.getByTestId('map-svg');
  const target = before[0]!;
  const hit = svg.locator(`g[data-id="${target}"] > circle`).first();
  const lineEnd = () => svg.locator('line').first().evaluate((l) => [Number(l.getAttribute('x2')), Number(l.getAttribute('y2'))]);
  await expect(page.getByTestId('reset-layout')).toBeDisabled();
  // Let the entrance animation come to rest before measuring.
  const settle = async () => {
    await expect
      .poll(async () => {
        const a = await lineEnd();
        await page.waitForTimeout(150);
        const b = await lineEnd();
        return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);
      })
      .toBeLessThan(0.01);
    return lineEnd();
  };
  await hit.scrollIntoViewIfNeeded();
  const start = await settle();
  const box = (await hit.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy + 40, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Math.hypot(...(await lineEnd()).map((v, i) => v - start[i]!))).toBeGreaterThan(20);
  await expect(selectedName(page)).toHaveText('Luke Skywalker');
  expect(await neighborIds(page)).toEqual(before);
  await expect(page.getByTestId('reset-layout')).toBeEnabled();
  await page.getByTestId('reset-layout').click();
  await expect.poll(async () => Math.hypot(...(await lineEnd()).map((v, i) => v - start[i]!))).toBeLessThan(2);
});

test('an older data version uses its own default threshold and says it is older', async ({ page }) => {
  const { index } = bundle();
  const older = index.versions.map((v: { version: string }) => v.version).find((v: string) => v !== index.default_version);
  test.skip(!older, 'only one bundle version shipped');
  await openExplorer(page, `?v=${older}&view=graph`);
  await expect(page.getByTestId('older-version')).toBeVisible();
  const olderManifest = await (await page.request.get(`/bundles/${older}/manifest.json`)).json();
  await expect(page.getByTestId('threshold-input')).toHaveValue(olderManifest.computation.default_threshold.toFixed(2));
  expect(Number(await page.getByTestId('edge-count').getAttribute('data-edges'))).toBeGreaterThan(0);
  await page.getByTestId('older-version').getByRole('link').click();
  await expect(page.getByTestId('explorer')).toHaveAttribute('data-version', index.default_version);
  await expect(page.getByTestId('older-version')).toHaveCount(0);
});
