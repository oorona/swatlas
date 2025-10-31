'use client';

import dynamic from 'next/dynamic';

// The interactive surface is client-only and lazy-loaded; the page shell,
// headings, and noscript fallback are server-rendered.
const Explorer = dynamic(() => import('./Explorer'), {
  ssr: false,
  loading: () => <p role="status" className="rounded-xl border border-border bg-surface p-6 text-muted" data-testid="explorer-loading">…</p>,
});

export function ExplorerLoader() {
  return <Explorer />;
}
