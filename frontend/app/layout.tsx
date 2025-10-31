import type { ReactNode } from 'react';

// The html/body shell lives in app/[locale]/layout.tsx (next-intl pattern).
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
