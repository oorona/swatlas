'use client';

import { useTranslations } from 'next-intl';
import { FILTER_FIELDS, hasActiveFilters, valueCounts } from '@/lib/atlas/filters';
import { useDerived } from './derived';
import { useExplorer } from './store';

export function FiltersPanel() {
  const t = useTranslations('explorer.filters');
  const td = useTranslations('explorer.details');
  const tv = useTranslations('vocab');
  const filters = useExplorer((s) => s.state.filters);
  const toggle = useExplorer((s) => s.toggleFilter);
  const clear = useExplorer((s) => s.clearFilters);
  const derived = useDerived();
  if (!derived) return null;
  const { atlas, visible } = derived;

  return (
    <section aria-labelledby="filters-heading" className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="filters-heading" className="font-semibold">
          {t('heading')}
        </h2>
        <p className="text-sm" data-testid="visible-count" data-visible={visible.size} data-total={atlas.ids.length}>
          {t('count', { visible: visible.size, total: atlas.ids.length })}
        </p>
      </div>
      <p className="mt-1 text-xs text-muted">{t('note')}</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {FILTER_FIELDS.map((field) => {
          const counts = valueCounts(atlas.characters, field);
          const values = atlas.vocabularies[field].filter((v) => counts.has(v));
          return (
            <fieldset key={field}>
              <legend className="text-sm font-medium">{td(field)}</legend>
              <div className="mt-1 space-y-0.5">
                {values.map((value) => {
                  const inputId = `filter-${field}-${value}`;
                  return (
                    <div key={value} className="flex min-h-7 items-center gap-2 text-sm">
                      <input id={inputId} type="checkbox" checked={filters[field].includes(value)} onChange={() => toggle(field, value)} className="h-5 w-5 shrink-0 accent-[var(--accent)]" data-filter={`${field}:${value}`} />
                      <label htmlFor={inputId} className="flex-1 py-1">
                        {tv(`${field}.${value}`)} <span className="text-muted">({counts.get(value)})</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
      {hasActiveFilters(filters) && (
        <button type="button" onClick={clear} className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-paper">
          {t('clear')}
        </button>
      )}
    </section>
  );
}
