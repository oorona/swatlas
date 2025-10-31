'use client';

import { useTranslations } from 'next-intl';
import { rankOf, scoreBetween } from '@/lib/atlas/neighbors';
import { useDerived, useScore } from './derived';
import { useExplorer } from './store';

export function HoverPreview() {
  const t = useTranslations('explorer.chart');
  const hover = useExplorer((s) => s.hover);
  const mode = useExplorer((s) => s.state.mode);
  const derived = useDerived();
  const score = useScore();
  if (!derived) return null;
  const { atlas, selected, visible } = derived;
  const data = atlas.modes[mode];
  let text = ' ';
  if (hover && atlas.byId.has(hover)) {
    const name = atlas.byId.get(hover)!.name;
    if (!selected || hover === selected) {
      text = `${t('preview', { name })}${hover === selected ? ` · ${t('previewSelf')}` : ''}`;
    } else {
      const s = scoreBetween(data.ids, data.matrix, selected, hover)!;
      const rank = rankOf(data.ids, data.matrix, selected, hover, visible);
      text = `${t('preview', { name })} · ${t('previewScore', { selected: atlas.byId.get(selected)!.name, score: score(s), rank: rank ?? '–' })}`;
    }
  }
  return (
    <p className="min-h-6 px-1 text-sm text-muted" data-testid="hover-preview">
      {text}
    </p>
  );
}
