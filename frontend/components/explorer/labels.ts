type Translator = (key: string, values?: Record<string, string | number>) => string;

export function projectionLabel(t: Translator, id: string): string {
  if (id === 'pca') return t('projections.pca');
  const seed = id.startsWith('umap-') ? id.slice(5) : id;
  return t('projections.umap', { seed });
}
