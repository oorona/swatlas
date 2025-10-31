'use client';

import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import { usePathname } from '@/i18n/navigation';

// Switches language while keeping the explorer's shareable query string.
export function LocaleSwitch({ label, text }: { label: string; text: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const target = locale === 'en' ? 'es' : 'en';
  const base = target === 'en' ? pathname : `/es${pathname === '/' ? '' : pathname}`;
  const [href, setHref] = useState(base);

  useEffect(() => {
    const sync = () => setHref(`${base}${window.location.search}`);
    sync();
    window.addEventListener('swatlas:urlchange', sync);
    return () => window.removeEventListener('swatlas:urlchange', sync);
  }, [base]);

  return (
    <a href={href} hrefLang={target} lang={target} aria-label={`${label}: ${text}`} className="rounded border border-border px-2 py-1 hover:bg-paper">
      {text}
    </a>
  );
}
