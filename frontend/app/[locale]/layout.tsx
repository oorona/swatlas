import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/site';
import '../globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' });

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f6f1' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1c2c' },
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t('homeTitle'), template: `%s · ${t('siteName')}` },
    description: t('homeDescription'),
    applicationName: t('siteName'),
    icons: { icon: '/icon.svg' },
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  // Per-request rendering is required: proxy.ts issues a CSP nonce per request,
  // and Next attaches it to framework scripts only in dynamic renders.
  await connection();
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getTranslations('nav');
  const clientMessages = { explorer: messages.explorer, vocab: messages.vocab, explore: messages.explore, nav: messages.nav };

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen antialiased">
        <a href="#main" className="sr-only-focusable absolute left-3 top-3 z-50 rounded bg-surface px-3 py-2 text-sm font-medium shadow">
          {t('skip')}
        </a>
        <NextIntlClientProvider locale={locale} messages={clientMessages}>
          <SiteHeader />
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6">
            {children}
          </main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
