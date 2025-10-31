import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <section className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="mt-3 text-muted">{t('body')}</p>
      <Link href="/" className="mt-6 inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast">
        {t('home')}
      </Link>
    </section>
  );
}
