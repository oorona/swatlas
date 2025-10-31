import { getTranslations } from 'next-intl/server';
import { ARTICLE_URL } from '@/lib/site';

export async function SiteFooter() {
  const t = await getTranslations('footer');
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-7xl space-y-2 px-4 py-6 text-sm text-muted sm:px-6">
        <p>{t('built')}</p>
        <p>
          <a href={ARTICLE_URL} rel="noopener" className="underline underline-offset-2">
            {t('article')}
          </a>
        </p>
        <p>{t('fanNote')}</p>
      </div>
    </footer>
  );
}
