import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { JsonLd } from '@/components/atlas/JsonLd';
import { getServerBundle } from '@/lib/atlas/server';
import { alternates } from '@/lib/metadata';
import { AUTHOR, SITE_URL, localePath } from '@/lib/site';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: t('methodologyTitle'),
    description: t('methodologyDescription'),
    alternates: alternates(locale, '/methodology'),
    openGraph: { title: t('methodologyTitle'), description: t('methodologyDescription'), type: 'article' },
  };
}

const SECTIONS = ['inputs', 'model', 'computation', 'projections', 'editorial', 'variant', 'claims', 'limitations', 'reproduce', 'downloads', 'version'] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-6 border-t border-border pt-6">
      <h2 id={`${id}-h`} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[14rem_minmax(0,1fr)]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="break-all font-mono text-[13px]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const OUTCOME_STYLE: Record<string, string> = {
  supported: 'border-ok text-ok',
  partial: 'border-muted text-muted',
  contradicted: 'border-danger text-danger',
};

export default async function MethodologyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('methodology');
  const tv = await getTranslations('vocab.outcome');
  const tm = await getTranslations('meta');
  const format = await getFormatter();
  const { atlas, claims } = await getServerBundle();
  const m = atlas.manifest;
  const pca = atlas.modes.authored.projections.find((p) => p.id === 'pca');
  const variance = (pca?.diagnostics.explained_variance_ratio as number[] | undefined) ?? [];
  const pct = (v: number | undefined) => (v === undefined ? '—' : format.number(v, { style: 'percent', maximumFractionDigits: 1 }));
  const kib = (bytes: number) => `${format.number(bytes / 1024, { maximumFractionDigits: 1 })} KiB`;
  const zipHref = `/bundles/${m.version}/${m.download.path}`;

  return (
    <article className="mx-auto max-w-4xl space-y-8">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'TechArticle',
          headline: tm('methodologyTitle'),
          description: tm('methodologyDescription'),
          inLanguage: locale,
          url: `${SITE_URL}${localePath(locale, '/methodology')}`,
          dateModified: m.created_at,
          author: { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.url },
          isPartOf: { '@id': `${SITE_URL}/#app` },
        }}
      />
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t('heading')}</h1>
        <p className="mt-2 text-lg text-muted">{t('lead')}</p>
        <nav aria-label={t('toc')} className="mt-4">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s}>
                <a href={`#${s}`} className="underline underline-offset-2">
                  {t(`${s}.heading`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <Section id="inputs" title={t('inputs.heading')}>
        <p>{t('inputs.body', { section: m.source.section, title: m.source.article_title, start: m.source.line_start, end: m.source.line_end })}</p>
        <KeyValue
          rows={[
            [t('inputs.articleHash'), m.source.article_sha256],
            [t('inputs.descriptionsHash'), m.source.descriptions_sha256],
            [t('inputs.editorialHash'), m.source.editorial_sha256],
          ]}
        />
      </Section>

      <Section id="model" title={t('model.heading')}>
        <p>{t('model.body', { model: m.model.id })}</p>
        <KeyValue
          rows={[
            ['Model', m.model.id],
            [t('model.revision'), m.model.revision],
            [t('model.license'), `${m.license.model ?? ''}. ${m.license.model_reuse_terms ?? ''}`],
            [t('model.dimensions'), String(m.model.dimensions)],
          ]}
        />
      </Section>

      <Section id="computation" title={t('computation.heading')}>
        <p>{t('computation.cosine')}</p>
        <p>{t('computation.neighbors')}</p>
        <p>{t('computation.graph')}</p>
        <KeyValue
          rows={[
            ['authored input_hash', m.modes.authored.input_hash],
            ['relationships_removed input_hash', m.modes.relationships_removed.input_hash],
          ]}
        />
      </Section>

      <Section id="projections" title={t('projections.heading')}>
        <p>{t('projections.body')}</p>
        <p>{t('projections.pcaVariance', { pc1: pct(variance[0]), pc2: pct(variance[1]) })}</p>
        <p>
          <a href={m.projections.reference} rel="noopener" className="underline underline-offset-2">
            {t('projections.reference')}
          </a>
        </p>
        <KeyValue rows={Object.entries(m.projections.umap_parameters).map(([k, v]) => [k, String(v)] as [string, string])} />
      </Section>

      <Section id="editorial" title={t('editorial.heading')}>
        <p>{t('editorial.body')}</p>
      </Section>

      <Section id="variant" title={t('variant.heading')}>
        <p>{t('variant.body')}</p>
      </Section>

      <Section id="claims" title={t('claims.heading')}>
        <p>{t('claims.body')}</p>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t('claims.heading')}>
          <table className="w-full min-w-[40rem] text-sm" data-testid="claims-table">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-2 pr-3">{t('claims.claim')}</th>
                <th scope="col" className="py-2 pr-3">{t('claims.test')}</th>
                <th scope="col" className="py-2 pr-3">{t('claims.authored')}</th>
                <th scope="col" className="py-2">{t('claims.variant')}</th>
              </tr>
            </thead>
            <tbody>
              {claims.claims.map((c) => (
                <tr key={c.id} className="border-b border-border/60 align-top" data-claim={c.id}>
                  <td className="py-2 pr-3" lang="en">
                    “{c.quote}”
                  </td>
                  <td className="py-2 pr-3 text-muted" lang="en">
                    {c.test}
                  </td>
                  {(['authored', 'relationships_removed'] as const).map((mode) => (
                    <td key={mode} className="py-2 pr-3">
                      <span className={`inline-block rounded border px-1.5 py-0.5 text-xs font-semibold ${OUTCOME_STYLE[c.by_mode[mode].outcome]}`}>{tv(c.by_mode[mode].outcome)}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="limitations" title={t('limitations.heading')}>
        <ul className="list-disc space-y-1 pl-5" lang="en">
          {m.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section id="reproduce" title={t('reproduce.heading')}>
        <p>{t('reproduce.body')}</p>
        <pre tabIndex={0} aria-label={t('reproduce.heading')} className="overflow-x-auto rounded-lg bg-ink p-3 text-sm text-paper">
          <code>{m.preparation_command}</code>
        </pre>
        <h3 className="font-semibold">{t('reproduce.packages')}</h3>
        <KeyValue rows={Object.entries(m.packages).map(([k, v]) => [k, v] as [string, string])} />
        <h3 className="font-semibold">{t('reproduce.execution')}</h3>
        <KeyValue rows={Object.entries(m.execution).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)] as [string, string])} />
      </Section>

      <Section id="downloads" title={t('downloads.heading')}>
        <p>{t('downloads.body')}</p>
        <ul className="space-y-1">
          <li>
            <a href={zipHref} download className="underline underline-offset-2" data-testid="methodology-zip">
              {t('downloads.zip', { version: m.version, size: kib(m.download.bytes) })}
            </a>
            <span className="ml-2 break-all font-mono text-xs text-muted">sha256 {m.download.sha256}</span>
          </li>
          <li>
            <a href={`/bundles/${m.version}/manifest.json`} className="underline underline-offset-2">
              {t('downloads.manifest')}
            </a>
          </li>
        </ul>
      </Section>

      <Section id="version" title={t('version.heading')}>
        <p>
          {t('version.body', {
            version: m.version,
            schema: m.schema_version,
            created: format.dateTime(new Date(m.created_at), { dateStyle: 'long', timeZone: 'UTC' }),
            size: kib(m.bundle_gzip_bytes),
          })}
        </p>
      </Section>
    </article>
  );
}
