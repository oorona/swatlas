import { act, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CharacterList } from '@/components/explorer/CharacterList';
import { DetailsPanel } from '@/components/explorer/DetailsPanel';
import { MatrixView } from '@/components/explorer/MatrixView';
import { useExplorer } from '@/components/explorer/store';
import { DEFAULT_STATE } from '@/lib/atlas/urlState';
import messages from '@/messages/en.json';
import { loadFixtureAtlas } from './fixtures';

const atlas = loadFixtureAtlas();
const wrap = (ui: ReactNode) => render(<NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>);

beforeEach(() => {
  act(() => useExplorer.getState().init(atlas, { ...DEFAULT_STATE, version: atlas.version, filters: { allegiances: [], roles: [], eras: [], force_status: [] } }, [], null));
});

describe('CharacterList', () => {
  it('previews with arrows and commits with Enter', () => {
    wrap(<CharacterList />);
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(useExplorer.getState().hover).not.toBeNull();
    expect(useExplorer.getState().state.selected).toBe('luke-skywalker');
    fireEvent.keyDown(list, { key: 'Home' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(useExplorer.getState().state.selected).toBe(atlas.ids[0]);
    expect(screen.getByRole('option', { selected: true })).toHaveAttribute('data-id', atlas.ids[0]);
  });
});

describe('MatrixView', () => {
  it('moves with arrow keys and selects the row character', () => {
    wrap(<MatrixView asTable={false} />);
    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    expect(document.activeElement).toHaveAttribute('data-cell', '2-1');
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(useExplorer.getState().state.selected).toBe(atlas.ids[2]);
  });
});

describe('DetailsPanel', () => {
  it('renders imported text as inert text, not markup', () => {
    const hostile = { ...atlas, byId: new Map(atlas.byId), characters: [...atlas.characters] };
    const luke = { ...hostile.byId.get('luke-skywalker')!, description: '<img src=x onerror="alert(1)"><script>alert(1)</script>' };
    hostile.byId.set('luke-skywalker', luke);
    act(() => useExplorer.getState().init(hostile, { ...DEFAULT_STATE, version: atlas.version }, [], null));
    wrap(<DetailsPanel />);
    expect(screen.getByTestId('description').textContent).toContain('<script>');
    expect(document.querySelector('[data-testid="description"] script, [data-testid="description"] img')).toBeNull();
  });

  it('shows five neighbors with scores and the draft badge', () => {
    wrap(<DetailsPanel />);
    expect(screen.getByTestId('neighbors').querySelectorAll('li')).toHaveLength(5);
    expect(screen.getByTestId('draft-badge')).toBeInTheDocument();
  });
});
