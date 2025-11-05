'use client';

import { useTranslations } from 'next-intl';
import { MarkerLegendIcon } from '@/components/atlas/Marker';
import { FACTION_FILL, FACTIONS } from '@/lib/atlas/faction';
import { useExplorer } from './store';

const STATUSES = ['sensitive', 'not_sensitive', 'unknown', 'disputed'] as const;

/** Legend for the map and graph marks: color follows the "Color by" choice, shape is always Force status. */
export function ColorLegend() {
  const t = useTranslations('explorer.chart');
  const tf = useTranslations('vocab.force_status');
  const colorBy = useExplorer((s) => s.state.colorBy);
  return (
    <div className="space-y-1 px-1 pt-2 text-xs text-muted" data-testid="color-legend" data-color-by={colorBy}>
      {colorBy === 'faction' && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-foreground">
          {FACTIONS.map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
                <rect x="1" y="1" width="10" height="10" rx="2" fill={FACTION_FILL[f]} />
              </svg>
              {t(`factions.${f}`)}
            </li>
          ))}
        </ul>
      )}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-foreground">
        {STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <MarkerLegendIcon status={s} fill={colorBy === 'faction' ? 'var(--muted)' : undefined} />
            {tf(s)}
          </li>
        ))}
      </ul>
      <p>{colorBy === 'faction' ? t('legendFaction') : t('legendShape')}</p>
    </div>
  );
}
