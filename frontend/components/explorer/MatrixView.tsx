'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type KeyboardEvent } from 'react';
import { useDerived, useScore } from './derived';
import { useExplorer } from './store';

// Six quantized steps between fixed paper and ink (theme-independent). The
// ramp skips the middle band so every step keeps text contrast >= 4.5:1.
const STEPS = [4, 16, 28, 70, 80, 92];

function cellColor(value: number, lo: number, hi: number): { bg: string; fg: string } {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo || 1)));
  const pct = STEPS[Math.min(STEPS.length - 1, Math.floor(t * STEPS.length))]!;
  return { bg: `color-mix(in srgb, #172d46 ${pct}%, #f2f0e9)`, fg: pct >= 50 ? '#ffffff' : '#172d46' };
}

/** Heatmap grid with roving tabindex (arrow keys, Home/End, Enter selects the row), plus a plain table. */
export function MatrixView({ asTable }: { asTable: boolean }) {
  const t = useTranslations('explorer.matrix');
  const tm = useTranslations('explorer.toolbar.modes');
  const tc = useTranslations('explorer.chart');
  const mode = useExplorer((s) => s.state.mode);
  const select = useExplorer((s) => s.select);
  const setHover = useExplorer((s) => s.setHover);
  const derived = useDerived();
  const score = useScore();
  const [focus, setFocus] = useState<[number, number]>([0, 0]);
  const gridRef = useRef<HTMLTableElement>(null);
  if (!derived) return null;

  const { atlas, visibleOrdered: ids, selected } = derived;
  const data = atlas.modes[mode];
  const index = new Map(data.ids.map((id, i) => [id, i]));
  const value = (a: string, b: string) => data.matrix[index.get(a)!]![index.get(b)!]!;
  const off: number[] = [];
  ids.forEach((a, i) => ids.forEach((b, j) => i !== j && off.push(value(a, b))));
  const lo = off.length ? Math.min(...off) : 0;
  const hi = off.length ? Math.max(...off) : 1;
  const name = (id: string) => atlas.byId.get(id)!.name;
  const caption = t('caption', { mode: tm(mode) });
  const [fr, fc] = [Math.min(focus[0], ids.length - 1), Math.min(focus[1], ids.length - 1)];

  if (ids.length === 0) return null;

  if (asTable) {
    return (
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption} data-testid="matrix-table-wrap">
        <table className="text-xs" data-testid="matrix-table">
          <caption className="px-1 pb-2 text-left text-sm text-muted">{caption}</caption>
          <thead>
            <tr>
              <td />
              {ids.map((id) => (
                <th key={id} scope="col" className="px-1 py-1 text-left font-medium">
                  {name(id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ids.map((row) => (
              <tr key={row} className="border-t border-border/60">
                <th scope="row" className={`whitespace-nowrap py-1 pr-2 text-left ${row === selected ? 'font-bold' : 'font-medium'}`}>
                  {name(row)}
                  {row === selected ? ` (${tc('selectedBadge')})` : ''}
                </th>
                {ids.map((col) => (
                  <td key={col} className="px-1 py-1 text-right font-mono">
                    {score(value(row, col))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const moveTo = (r: number, c: number) => {
    const nr = Math.max(0, Math.min(ids.length - 1, r));
    const nc = Math.max(0, Math.min(ids.length - 1, c));
    setFocus([nr, nc]);
    setHover(ids[nc] !== ids[nr] ? ids[nc]! : null);
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${nr}-${nc}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const last = ids.length - 1;
    const actions: Record<string, () => void> = {
      ArrowRight: () => moveTo(fr, fc + 1),
      ArrowLeft: () => moveTo(fr, fc - 1),
      ArrowDown: () => moveTo(fr + 1, fc),
      ArrowUp: () => moveTo(fr - 1, fc),
      Home: () => moveTo(event.ctrlKey ? 0 : fr, 0),
      End: () => moveTo(event.ctrlKey ? last : fr, last),
      Enter: () => select(ids[fr]!),
      ' ': () => select(ids[fr]!),
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  const selIndex = ids.indexOf(selected);
  return (
    <div className="overflow-x-auto" data-testid="matrix-wrap">
      <table ref={gridRef} role="grid" aria-label={t('label')} aria-rowcount={ids.length + 1} onKeyDown={onKeyDown} className="border-separate border-spacing-0 text-[10px]" data-testid="matrix-grid">
        <caption className="px-1 pb-2 text-left text-sm text-muted">{caption}</caption>
        <thead>
          <tr role="row">
            <td role="columnheader" aria-hidden="true" />
            {ids.map((id, j) => (
              <th key={id} role="columnheader" scope="col" className={`h-28 w-8 align-bottom ${j === selIndex ? 'font-bold' : 'font-normal'}`}>
                <span className="inline-block origin-bottom-left translate-x-4 -rotate-60 whitespace-nowrap text-left text-[11px]">{name(id)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ids.map((row, i) => (
            <tr key={row} role="row">
              <th role="rowheader" scope="row" className={`whitespace-nowrap pr-2 text-right text-[11px] ${i === selIndex ? 'font-bold' : 'font-normal'}`}>
                {i === selIndex && <span aria-hidden="true">▸ </span>}
                {name(row)}
              </th>
              {ids.map((col, j) => {
                const v = value(row, col);
                const { bg, fg } = cellColor(v, lo, hi);
                const isFocus = i === fr && j === fc;
                const inSel = i === selIndex || j === selIndex;
                return (
                  <td
                    key={col}
                    role="gridcell"
                    tabIndex={isFocus ? 0 : -1}
                    data-cell={`${i}-${j}`}
                    aria-label={t('cell', { row: name(row), col: name(col), score: score(v) })}
                    onFocus={() => setFocus([i, j])}
                    onClick={() => {
                      setFocus([i, j]);
                      select(row);
                    }}
                    onMouseEnter={() => setHover(col !== row ? col : null)}
                    onMouseLeave={() => setHover(null)}
                    style={{ background: bg, color: fg, boxShadow: inSel ? 'inset 0 0 0 1.5px var(--foreground)' : undefined }}
                    className="h-8 w-8 min-w-8 cursor-pointer text-center font-mono"
                  >
                    {v.toFixed(2).replace(/^0/, '').replace(/^-0/, '-')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 px-1 text-sm text-muted" aria-live="off" data-testid="matrix-focus">
        {t('focusHint', { row: name(ids[fr]!), col: name(ids[fc]!), score: score(value(ids[fr]!, ids[fc]!)) })}
      </p>
    </div>
  );
}
