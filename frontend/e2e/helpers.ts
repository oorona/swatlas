import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const BUNDLES = path.join(process.cwd(), 'public', 'bundles');

export function bundle() {
  const index = JSON.parse(readFileSync(path.join(BUNDLES, 'index.json'), 'utf-8'));
  const manifest = JSON.parse(readFileSync(path.join(BUNDLES, index.default_version, 'manifest.json'), 'utf-8'));
  const file = (key: string) => JSON.parse(readFileSync(path.join(BUNDLES, index.default_version, manifest.files.find((f: { key: string }) => f.key === key).path), 'utf-8'));
  return { index, manifest, file };
}

export async function openExplorer(page: Page, query = '') {
  await page.goto(`/explore${query}`);
  await expect(page.getByTestId('explorer').or(page.getByTestId('explorer-error'))).toBeVisible();
}

export async function neighborIds(page: Page): Promise<string[]> {
  return page.getByTestId('neighbors').locator('li').evaluateAll((els) => els.map((e) => e.getAttribute('data-id') ?? ''));
}

export function selectedName(page: Page) {
  return page.getByTestId('details-name');
}
