'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { MarkerLegendIcon } from '@/components/atlas/Marker';
import { useDerived, useScore } from './derived';
import { useExplorer } from './store';

/** Listbox: arrow keys preview (hover state), Enter/Space or click commits. Complete keyboard path. */
export function CharacterList() {
  const t = useTranslations('explorer.list');
  const derived = useDerived();
  const select = useExplorer((s) => s.select);
  const setHover = useExplorer((s) => s.setHover);
  const score = useScore();
  const [active, setActive] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const ids = derived?.visibleOrdered ?? [];
  const selected = derived?.selected ?? '';

  useEffect(() => {
    if (active && !ids.includes(active)) setActive(null);
  }, [active, ids]);

  if (!derived) return null;
  const { atlas, neighbors, neighborRank } = derived;
  const hidden = atlas.ids.length - ids.length;
  const current = active ?? (ids.includes(selected) ? selected : ids[0] ?? null);

  const move = (delta: number | 'start' | 'end') => {
    if (ids.length === 0) return;
    const index = current ? ids.indexOf(current) : -1;
    const next = delta === 'start' ? 0 : delta === 'end' ? ids.length - 1 : Math.min(ids.length - 1, Math.max(0, index + delta));
    const id = ids[next]!;
    setActive(id);
    setHover(id);
    document.getElementById(`option-${id}`)?.scrollIntoView?.({ block: 'nearest' });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      Home: () => move('start'),
      End: () => move('end'),
      Enter: () => current && select(current),
      ' ': () => current && select(current),
      Escape: () => {
        setActive(null);
        setHover(null);
      },
    };
    const action = keys[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  return (
    <section aria-labelledby="character-list-heading" id="character-list" className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 id="character-list-heading" className="font-semibold">
          {t('heading')}
        </h2>
        {hidden > 0 && <span className="text-sm text-muted">{t('hiddenCount', { count: hidden })}</span>}
      </div>
      <ul
        ref={listRef}
        role="listbox"
        tabIndex={0}
        aria-label={t('label')}
        aria-activedescendant={current ? `option-${current}` : undefined}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setActive(null);
          setHover(null);
        }}
        className="mt-2 max-h-[28rem] overflow-y-auto rounded-md focus-visible:outline-offset-0"
        data-testid="character-list"
      >
        {ids.map((id) => {
          const c = atlas.byId.get(id)!;
          const isSelected = id === selected;
          const rank = neighborRank.get(id);
          const isActive = id === active;
          return (
            <li
              key={id}
              id={`option-${id}`}
              role="option"
              aria-selected={isSelected}
              data-id={id}
              onClick={() => select(id)}
              onMouseEnter={() => setHover(id)}
              onMouseLeave={() => setHover(null)}
              className={[
                'flex cursor-pointer items-center gap-2 rounded-md border-l-4 px-2 py-1.5 text-sm',
                isSelected ? 'border-foreground bg-paper font-semibold' : 'border-transparent hover:bg-paper',
                isActive ? 'outline outline-2 outline-offset-[-2px] outline-[var(--focus)]' : '',
              ].join(' ')}
            >
              <MarkerLegendIcon status={c.force_status} />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              {isSelected && <span aria-hidden="true">✓</span>}
              {rank !== undefined && (
                <span className="shrink-0 rounded bg-paper px-1.5 font-mono text-xs text-muted">
                  <span className="sr-only">{t('neighborRank', { rank })} </span>
                  <span aria-hidden="true">#{rank}</span> {score(neighbors[rank - 1]!.score)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
