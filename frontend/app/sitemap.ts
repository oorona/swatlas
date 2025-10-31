import type { MetadataRoute } from 'next';
import { getServerBundle } from '@/lib/atlas/server';
import { localePath, SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // lastmod comes from the shipped bundle, not the request time.
  const { atlas } = await getServerBundle();
  const lastModified = new Date(atlas.manifest.created_at);
  return ['/', '/explore', '/methodology'].flatMap((path) =>
    (['en', 'es'] as const).map((locale) => ({
      url: `${SITE_URL}${localePath(locale, path)}`,
      lastModified,
      alternates: {
        languages: {
          en: `${SITE_URL}${localePath('en', path)}`,
          es: `${SITE_URL}${localePath('es', path)}`,
          'x-default': `${SITE_URL}${localePath('en', path)}`,
        },
      },
    })),
  );
}
