export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const ARTICLE_URL = process.env.NEXT_PUBLIC_ARTICLE_URL || 'https://thelatentsource.com/articles/mapping-star-wars-universe';
export const AUTHOR = { name: 'Oswaldo Orona', url: 'https://thelatentsource.com' };
export const SITE_NAME = 'Star Wars Semantic Atlas';

export function localePath(locale: string, pathname: string): string {
  const suffix = pathname === '/' ? '' : pathname;
  return locale === 'en' ? pathname : `/es${suffix}`;
}
