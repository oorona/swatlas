import type { Metadata } from 'next';
import { localePath, SITE_URL } from './site';

export function alternates(locale: string, pathname: string): Metadata['alternates'] {
  return {
    canonical: `${SITE_URL}${localePath(locale, pathname)}`,
    languages: {
      en: `${SITE_URL}${localePath('en', pathname)}`,
      es: `${SITE_URL}${localePath('es', pathname)}`,
      'x-default': `${SITE_URL}${localePath('en', pathname)}`,
    },
  };
}
