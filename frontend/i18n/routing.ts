import { defineRouting } from 'next-intl/routing';
import { defaultLocale, locales } from './config';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  // Explicit locale switching only; crawlers hitting `/` are never redirected.
  localeDetection: false,
  // No cookies on public pages; the URL is the only locale state.
  localeCookie: false,
});
