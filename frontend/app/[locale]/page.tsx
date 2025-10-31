import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/atlas/JsonLd';
import { PreviewMap } from '@/components/atlas/PreviewMap';
import { Link } from '@/i18n/navigation';
import { getServerBundle } from '@/lib/atlas/server';
import { alternates } from '@/lib/metadata';
import { ARTICLE_URL, AUTHOR, SITE_URL } from '@/lib/site';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: { absolute: t('homeTitle') },
    description: t('homeDescription'),
    alternates: alternates(locale, '/'),
    openGraph: { title: t('homeTitle'), description: t('homeDescription'), type: 'website', locale: locale === 'es' ? 'es_MX' : 'en_US' },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tm = await getTranslations('meta');
  const { atlas } = await getServerBundle();
  const cards = ['neighbors', 'variant', 'evidence'] as const;

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebApplication',
              '@id': `${SITE_URL}/#app`,
              name: tm('siteName'),
              url: SITE_URL,
              description: tm('homeDescription'),
              applicationCategory: 'EducationalApplication',
              operatingSystem: 'Any (web browser)',
              inLanguage: ['en', 'es'],
              isAccessibleForFree: true,
              author: { '@id': `${SITE_URL}/#author` },
              isBasedOn: ARTICLE_URL,
            },
            { '@type': 'Person', '@id': `${SITE_URL}/#author`, name: AUTHOR.name, url: AUTHOR.url },
          ],
        }}
      />
      <section className="grid items-center gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted">{t('eyebrow')}</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{t('title')}</h1>
          <p className="mt-4 max-w-prose text-lg text-muted">{t('lead')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/explore" className="rounded-md bg-accent px-4 py-2.5 font-medium text-accent-contrast hover:opacity-90">
              {t('cta')}
            </Link>
            <Link href="/methodology" className="rounded-md border border-border px-4 py-2.5 font-medium hover:bg-paper">
              {t('methodologyCta')}
            </Link>
          </div>
        </div>
        <figure className="overflow-hidden rounded-xl border border-border bg-surface">
          <PreviewMap atlas={atlas} selected="luke-skywalker" label={t('previewLabel', { selected: 'Luke Skywalker' })} />
          <figcaption className="border-t border-border px-4 py-3 text-sm text-muted">{t('previewCaption', { version: atlas.version })}</figcaption>
        </figure>
      </section>
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <article key={card} className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-lg font-semibold">{t(`cards.${card}Title`)}</h2>
            <p className="mt-2 text-muted">{t(`cards.${card}Body`)}</p>
          </article>
        ))}
      </section>
      <section className="mt-10">
        <a href={ARTICLE_URL} rel="noopener" className="group flex max-w-xl items-center gap-4 rounded-xl border border-border bg-surface p-3 hover:bg-paper">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative static SVG card */}
          <img src="/article-card.svg" alt="" width={112} height={63} className="rounded-md border border-border" />
          <span className="font-medium underline-offset-2 group-hover:underline">{t('articleLink')}</span>
        </a>
      </section>
    </>
  );
}
