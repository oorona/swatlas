import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LocaleSwitch } from './LocaleSwitch';

export async function SiteHeader() {
  const t = await getTranslations('nav');
  return (
    <header className="border-b border-border bg-surface/80">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="var(--ink)" />
            <circle cx="10" cy="20" r="3.2" fill="var(--sky)" />
            <circle cx="21" cy="10" r="3.2" fill="var(--sky)" />
            <circle cx="23" cy="22" r="2.4" fill="var(--paper)" />
            <path d="M10 20 21 10M21 10 23 22" stroke="var(--sky)" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>swatlas</span>
        </Link>
        <nav aria-label={t('primary')} className="flex items-center gap-1 text-sm">
          <Link href="/explore" className="rounded px-2 py-1.5 hover:bg-paper">
            {t('explore')}
          </Link>
          <Link href="/methodology" className="rounded px-2 py-1.5 hover:bg-paper">
            {t('methodology')}
          </Link>
          <LocaleSwitch label={t('language')} text={t('switchTo')} />
        </nav>
      </div>
    </header>
  );
}
