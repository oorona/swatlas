'use client';

import { useTranslations } from 'next-intl';
import { wordDiff } from '@/lib/atlas/diff';
import { FILTER_FIELDS } from '@/lib/atlas/filters';
import { rankOf, scoreBetween } from '@/lib/atlas/neighbors';
import { MODES, type Mode } from '@/lib/atlas/schema';
import { useDerived, useScore } from './derived';
import { useExplorer } from './store';

export function DetailsPanel() {
  const t = useTranslations('explorer.details');
  const tm = useTranslations('explorer.toolbar.modes');
  const tv = useTranslations('vocab');
  const mode = useExplorer((s) => s.state.mode);
  const select = useExplorer((s) => s.select);
  const derived = useDerived();
  const score = useScore();
  if (!derived) return null;
  const { atlas, selected, neighbors, visible } = derived;
  const c = selected ? atlas.byId.get(selected) : undefined;

  if (!c) {
    return (
      <section aria-labelledby="details-heading" className="rounded-xl border border-border bg-surface p-4" data-testid="details">
        <h2 id="details-heading" className="font-semibold">
          {t('heading')}
        </h2>
        <p className="mt-2 text-muted">{t('none')}</p>
      </section>
    );
  }

  const otherMode: Mode = MODES.find((m) => m !== mode)!;
  const other = atlas.modes[otherMode];
  const text = mode === 'authored' ? c.description : c.description_variant;
  const segments = mode === 'relationships_removed' ? wordDiff(c.description, c.description_variant) : [];
  const unchanged = c.description === c.description_variant;
  const rels = atlas.relationships.filter((r) => r.from === c.id || r.to === c.id);
  const name = (id: string) => atlas.byId.get(id)!.name;

  return (
    <section aria-labelledby="details-heading" className="space-y-5 rounded-xl border border-border bg-surface p-4" data-testid="details" data-selected={c.id}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{t('heading')}</p>
        <h2 id="details-heading" className="text-2xl font-semibold tracking-tight" data-testid="details-name">
          {c.name}
        </h2>
        {!visible.has(c.id) && (
          <p className="mt-2 rounded-md border border-border bg-paper p-2 text-sm" role="note">
            {t('hiddenByFilters')}
          </p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold">{mode === 'authored' ? t('descriptionAuthored') : t('descriptionVariant')}</h3>
        <blockquote lang="en" className="mt-1 border-l-4 border-sky pl-3 text-[15px] leading-relaxed" data-testid="description">
          {text}
        </blockquote>
        <p className="mt-1 text-xs text-muted">
          {t('sourceLanguage')} {t('source', { ref: c.source_ref })}
        </p>
      </div>

      {mode === 'relationships_removed' && (
        <div data-testid="diff">
          <h3 className="text-sm font-semibold">{t('diffHeading')}</h3>
          {unchanged ? (
            <p className="mt-1 text-sm text-muted">{t('noChange')}</p>
          ) : (
            <p lang="en" className="mt-1 text-sm leading-relaxed">
              {segments.map((s, i) =>
                s.type === 'same' ? (
                  <span key={i}>{s.text} </span>
                ) : s.type === 'removed' ? (
                  <del key={i} className="rounded bg-paper px-0.5 text-muted decoration-2">
                    <span className="sr-only">[{t('removed')}: </span>
                    {s.text}
                    <span className="sr-only">]</span>{' '}
                  </del>
                ) : (
                  <ins key={i} className="rounded bg-sky/40 px-0.5 no-underline">
                    <span className="sr-only">[{t('added')}: </span>
                    {s.text}
                    <span className="sr-only">]</span>{' '}
                  </ins>
                ),
              )}
            </p>
          )}
          <p className="mt-2 text-sm text-muted" lang="en">
            {c.variant_note}
          </p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold">{t('neighborsHeading', { count: neighbors.length, visible: [...visible].filter((id) => id !== c.id).length })}</h3>
        {neighbors.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{t('neighborsEmpty')}</p>
        ) : (
          <ol className="mt-2 space-y-2" data-testid="neighbors">
            {neighbors.map((n, i) => {
              const otherRank = rankOf(other.ids, other.matrix, c.id, n.id, visible);
              const otherScore = scoreBetween(other.ids, other.matrix, c.id, n.id);
              return (
                <li key={n.id} data-id={n.id} data-score={n.score} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-sm text-muted">{i + 1}.</span>
                  <button type="button" onClick={() => select(n.id)} className="truncate text-left font-medium underline decoration-border underline-offset-2 hover:decoration-foreground">
                    <span className="sr-only">{t('select', { name: name(n.id) })}: </span>
                    <span aria-hidden="true">{name(n.id)}</span>
                  </button>
                  <span className="font-mono text-sm" data-testid="neighbor-score">
                    {score(n.score)}
                  </span>
                  <span aria-hidden="true" className="col-start-2 h-1.5 rounded bg-paper">
                    <span className="block h-1.5 rounded bg-[var(--edge)]" style={{ width: `${Math.max(0, n.score) * 100}%` }} />
                  </span>
                  <span className="col-span-2 col-start-2 text-xs text-muted">
                    {otherRank !== null && otherScore !== null
                      ? t('otherMode', { mode: tm(otherMode), rank: otherRank, score: score(otherScore) })
                      : t('otherModeHidden', { mode: tm(otherMode) })}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-2 text-xs text-muted">{t('neighborsNote')}</p>
        {mode === 'relationships_removed' && <p className="mt-2 rounded-md bg-paper p-2 text-sm">{t('variantCaveat')}</p>}
        <p className="mt-2 break-all font-mono text-[11px] text-muted" data-testid="input-hash">
          {t('inputHash', { mode: tm(mode), hash: atlas.modes[mode].inputHash })}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold">{t('editorialHeading')}</h3>
        <p className="mt-1 inline-block rounded border border-dashed border-foreground/40 px-2 py-0.5 text-xs font-medium" data-testid="draft-badge">
          {t('draft')}
        </p>
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
          {FILTER_FIELDS.map((field) => (
            <div key={field} className="contents">
              <dt className="text-muted">{t(field)}</dt>
              <dd>{(field === 'force_status' ? [c.force_status] : c[field]).map((v) => tv(`${field}.${v}`)).join(', ')}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-sm text-muted" lang="en">
          {c.classification_note}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold">{t('relationshipsHeading')}</h3>
        <p className="text-xs text-muted">{t('relationshipsNote')}</p>
        {rels.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{t('relationshipsNone')}</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {rels.map((r) => (
              <li key={`${r.from}|${r.type}|${r.to}`}>
                <span className={r.from === c.id ? 'font-semibold' : ''}>{name(r.from)}</span> <span className="text-muted">→ {tv(`relationship.${r.type}`)} →</span>{' '}
                <span className={r.to === c.id ? 'font-semibold' : ''}>{name(r.to)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
