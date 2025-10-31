import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ExplorerLoader } from '@/components/explorer/ExplorerLoader';
import { getServerBundle } from '@/lib/atlas/server';
import { alternates } from '@/lib/metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: t('exploreTitle'),
    description: t('exploreDescription'),
    alternates: alternates(locale, '/explore'),
    openGraph: { title: t('exploreTitle'), description: t('exploreDescription'), type: 'website' },
  };
}

export default async function ExplorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('explore');
  const { atlas } = await getServerBundle();
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('heading')}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t('intro', { version: atlas.version })}</p>
      </header>
      <noscript>
        <p className="rounded-xl border border-border bg-surface p-4">{t('noscript')}</p>
      </noscript>
      {/* Reserve the viewport so the footer does not shift when the client explorer mounts. */}
      <div className="min-h-[100svh]">
        <ExplorerLoader />
      </div>
    </div>
  );
}
