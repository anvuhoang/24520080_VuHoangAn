// tests/HitLog.test.jsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HitLog from '../src/components/HitLog.jsx';

const makeHits = (labels) => labels.map((label, i) => ({ id: `hit-${i}`, label }));
const rows = () => within(screen.getByRole('list')).queryAllByRole('listitem').map((li) => li.textContent);

describe('HitLog', () => {
  it('tells the user which keys to press when it is empty', () => {
    render(<HitLog />);

    expect(screen.getByRole('status')).toHaveTextContent('No hits yet. Press W A S D J K L.');
    expect(rows()).toEqual([]);
  });

  it('announces the latest hit politely', () => {
    render(<HitLog hits={makeHits(['Snare', 'Kick'])} />);

    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('Last hit: Kick');
  });

  it('lists the history newest first', () => {
    render(<HitLog hits={makeHits(['Snare', 'Kick', 'Crash'])} />);
    expect(rows()).toEqual(['Crash', 'Kick', 'Snare']);
  });

  it('shows only the most recent `limit` hits (8 by default)', () => {
    const labels = Array.from({ length: 12 }, (_, i) => `Hit ${i + 1}`);
    const { rerender } = render(<HitLog hits={makeHits(labels)} />);

    expect(rows()).toHaveLength(8);
    expect(rows()[0]).toBe('Hit 12');
    expect(rows().at(-1)).toBe('Hit 5');

    rerender(<HitLog hits={makeHits(labels)} limit={3} />);
    expect(rows()).toEqual(['Hit 12', 'Hit 11', 'Hit 10']);
  });

  it.each([[0], [-3], [Number.NaN], [Number.POSITIVE_INFINITY], [undefined]])(
    'copes with an unusual limit (%s) without throwing',
    (limit) => {
      expect(() => render(<HitLog hits={makeHits(['A', 'B'])} limit={limit} />)).not.toThrow();
    }
  );

  it('shows an empty history for a limit of 0, a negative limit or NaN, and rounds 2.9 down', () => {
    const hits = makeHits(['A', 'B', 'C']);
    const { rerender } = render(<HitLog hits={hits} limit={0} />);
    expect(rows()).toEqual([]);

    rerender(<HitLog hits={hits} limit={-3} />);
    expect(rows()).toEqual([]);

    rerender(<HitLog hits={hits} limit={Number.NaN} />);
    expect(rows()).toEqual([]);

    rerender(<HitLog hits={hits} limit={2.9} />);
    expect(rows()).toEqual(['C', 'B']);
  });

  it('keeps the live region and the history in separate elements', () => {
    render(<HitLog hits={makeHits(['Snare'])} />);

    const live = screen.getByRole('status');
    const history = screen.getByRole('list');
    expect(live).not.toContainElement(history);
    expect(history).not.toContainElement(live);
    expect(history.closest('[aria-live]')).toBeNull();
  });

  it('is a labelled region named by its heading', () => {
    render(<HitLog />);
    const region = screen.getByRole('region', { name: 'Hit log' });
    expect(within(region).getByRole('heading', { name: 'Hit log', level: 2 })).toBeInTheDocument();
  });

  it('reuses the DOM nodes of existing rows when a hit is added (stable ids as keys)', () => {
    const hits = makeHits(['A', 'B']);
    const { rerender } = render(<HitLog hits={hits} />);
    const before = screen.getAllByRole('listitem');

    rerender(<HitLog hits={[...hits, { id: 'hit-new', label: 'C' }]} />);

    const after = screen.getAllByRole('listitem');
    expect(after).toHaveLength(3);
    expect(after.slice(1)).toEqual(before); // the old rows are the same elements, only shifted
  });

  it('replaces the announced node on every hit, so the same pad twice is announced again', () => {
    const { rerender } = render(<HitLog hits={[{ id: 'one', label: 'Snare' }]} />);
    const first = screen.getByText('Last hit: Snare');

    rerender(
      <HitLog
        hits={[
          { id: 'one', label: 'Snare' },
          { id: 'two', label: 'Snare' },
        ]}
      />
    );

    const second = screen.getByText('Last hit: Snare');
    expect(second).not.toBe(first);
  });

  it('does not throw for missing labels or a hits value that is not an array', () => {
    expect(() =>
      render(
        <HitLog
          hits={[
            { id: 'x', label: null },
            { id: 'y', label: undefined },
          ]}
        />
      )
    ).not.toThrow();
    expect(() => render(<HitLog hits={null} />)).not.toThrow();
  });
});
