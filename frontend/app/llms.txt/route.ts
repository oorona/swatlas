import { getServerBundle } from '@/lib/atlas/server';
import { ARTICLE_URL, SITE_URL } from '@/lib/site';

export async function GET() {
  const { atlas, claims } = await getServerBundle();
  const m = atlas.manifest;
  const lines = [
    '# Star Wars Semantic Atlas',
    '',
    `> An explorable look at why the ${m.model.id} embedding model finds two of 15 Star Wars character descriptions similar. All scores are precomputed offline and shipped as a versioned, checksummed bundle.`,
    '',
    '## Pages',
    `- [Explorer](${SITE_URL}/explore): PCA/UMAP map, similarity graph, cosine matrix, filters, and a description variant with named relationships removed.`,
    `- [Methodology](${SITE_URL}/methodology): inputs, model revision, computation rules, article claim checks, limitations, reproduction.`,
    `- [Metodología (es)](${SITE_URL}/es/methodology)`,
    '',
    '## Data',
    `- [Bundle manifest ${m.version}](${SITE_URL}/bundles/${m.version}/manifest.json)`,
    `- [Download bundle (zip)](${SITE_URL}/bundles/${m.version}/${m.download.path}): descriptions, normalized embeddings, cosine matrices, projections, README.`,
    `- Model: ${m.model.id} at revision ${m.model.revision} (${m.license.model}).`,
    `- Source article: [${m.source.article_title}](${ARTICLE_URL})`,
    '',
    '## Article claim checks (authored descriptions)',
    ...claims.claims.map((c) => `- ${c.by_mode.authored.outcome}: "${c.quote}"`),
    '',
    '## Limitations',
    ...m.limitations.map((l) => `- ${l}`),
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
