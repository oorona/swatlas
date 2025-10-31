'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useDerived } from './derived';
import { useExplorer } from './store';

/** Debounced summary for assistive technology; avoids announcing every slider tick. */
export function StatusRegion() {
  const t = useTranslations('explorer');
  const state = useExplorer((s) => s.state);
  const derived = useDerived();
  const [message, setMessage] = useState('');

  const name = derived && state.selected ? derived.atlas.byId.get(state.selected)?.name : undefined;
  const visible = derived?.visible.size ?? 0;
  const total = derived?.atlas.ids.length ?? 0;
  const next = !derived
    ? ''
    : name
      ? t('status.summary', { name, view: t(`toolbar.views.${state.view}`), mode: t(`toolbar.modes.${state.mode}`), visible, total })
      : t('status.none', { visible, total });

  useEffect(() => {
    const timer = setTimeout(() => setMessage(next), 600);
    return () => clearTimeout(timer);
  }, [next]);

  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="status">
      {message}
    </p>
  );
}
