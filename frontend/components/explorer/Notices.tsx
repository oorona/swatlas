'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useExplorer } from './store';

export function Notices() {
  const t = useTranslations('explorer');
  const issues = useExplorer((s) => s.issues);
  const notice = useExplorer((s) => s.notice);
  const unknown = useExplorer((s) => s.unknownCharacter);
  const atlas = useExplorer((s) => s.atlas);
  const dismiss = useExplorer((s) => s.dismissIssues);
  const select = useExplorer((s) => s.select);
  const setNotice = useExplorer((s) => s.setNotice);

  useEffect(() => {
    if (notice && notice.kind !== 'copy-fallback') {
      const timer = setTimeout(() => setNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice, setNotice]);

  return (
    <div className="space-y-2">
      {unknown && atlas && (
        <div role="alert" className="rounded-xl border-2 border-danger bg-surface p-4" data-testid="unknown-character">
          <h2 className="font-semibold">{t('unknownCharacter.title')}</h2>
          <p className="mt-1 text-sm">{t('unknownCharacter.body', { id: unknown.slice(0, 64), version: atlas.version })}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => select('luke-skywalker')} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast">
              {t('unknownCharacter.selectDefault')}
            </button>
            <a href="#character-list" className="rounded-md border border-border px-3 py-1.5 text-sm">
              {t('unknownCharacter.chooseList')}
            </a>
          </div>
        </div>
      )}
      {issues.length > 0 && (
        <div role="status" className="rounded-xl border border-border bg-surface p-4" data-testid="url-issues">
          <h2 className="font-semibold">{t('issues.heading')}</h2>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {issues.map((issue, i) => (
              <li key={i}>{t(`issues.${issue.code}`, { field: issue.field })}</li>
            ))}
          </ul>
          <button type="button" onClick={dismiss} className="mt-2 rounded-md border border-border px-3 py-1 text-sm hover:bg-paper">
            {t('issues.dismiss')}
          </button>
        </div>
      )}
      <div role="status" aria-live="polite" data-testid="notice">
        {notice?.kind === 'copied' && <p className="rounded-md bg-paper px-3 py-2 text-sm text-ok">{t('toolbar.copied')}</p>}
        {notice?.kind === 'reset' && <p className="rounded-md bg-paper px-3 py-2 text-sm">{t('toolbar.resetDone')}</p>}
        {notice?.kind === 'copy-fallback' && (
          <div className="rounded-md bg-paper px-3 py-2 text-sm">
            <label htmlFor="copy-fallback">{t('toolbar.copyFallback')}</label>
            <input id="copy-fallback" readOnly value={notice.url} onFocus={(e) => e.target.select()} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 font-mono text-xs" />
          </div>
        )}
      </div>
    </div>
  );
}
