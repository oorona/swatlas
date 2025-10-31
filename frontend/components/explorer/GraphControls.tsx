'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useExplorer } from './store';

export function GraphControls() {
  const t = useTranslations('explorer.graph');
  const threshold = useExplorer((s) => s.state.threshold);
  const curated = useExplorer((s) => s.state.curated);
  const setThreshold = useExplorer((s) => s.setThreshold);
  const setCurated = useExplorer((s) => s.setCurated);
  const [draft, setDraft] = useState(threshold.toFixed(2));

  useEffect(() => setDraft(threshold.toFixed(2)), [threshold]);

  const commit = (text: string) => {
    const value = Number(text);
    if (text.trim() !== '' && Number.isFinite(value) && value >= -1 && value <= 1) setThreshold(value);
    else setDraft(threshold.toFixed(2));
  };

  return (
    <div className="space-y-2 border-b border-border px-1 pb-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="threshold-range" className="text-sm font-medium">
          {t('threshold')}
        </label>
        <input
          id="threshold-range"
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          aria-describedby="threshold-hint"
          className="w-48 max-w-full accent-[var(--accent)]"
        />
        <input
          type="number"
          min={-1}
          max={1}
          step={0.01}
          value={draft}
          aria-label={t('threshold')}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
          className="w-20 rounded-md border border-border bg-surface px-2 py-1 font-mono text-sm"
          data-testid="threshold-input"
        />
      </div>
      <p id="threshold-hint" className="text-xs text-muted">
        {t('thresholdHint')}
      </p>
      <div className="flex items-center gap-2 text-sm">
        <input id="curated-toggle" type="checkbox" checked={curated} onChange={(e) => setCurated(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
        <label htmlFor="curated-toggle">{t('curated')}</label>
      </div>
      <ul className="space-y-1 text-xs text-muted">
        <li className="flex items-center gap-2">
          <svg aria-hidden="true" width="28" height="8">
            <line x1="0" y1="4" x2="28" y2="4" stroke="var(--edge)" strokeWidth="2.5" />
          </svg>
          {t('similarityLegend')}
        </li>
        {curated && (
          <li className="flex items-center gap-2">
            <svg aria-hidden="true" width="28" height="8">
              <line x1="0" y1="4" x2="24" y2="4" stroke="var(--curated)" strokeWidth="1.8" strokeDasharray="6 4" />
              <path d="M22 1L28 4L22 7Z" fill="var(--curated)" />
            </svg>
            {t('curatedLegend')}
          </li>
        )}
      </ul>
    </div>
  );
}
