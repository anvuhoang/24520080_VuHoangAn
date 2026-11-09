// tests/Leaderboard.test.jsx
import { Profiler, StrictMode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { STANDINGS } from '../src/arena/arenaData.js';
import { Leaderboard } from '../src/components/Leaderboard.jsx';

const EMPTY_MESSAGE = 'No squad matches these filters.';
const names = () =>
  within(screen.getAllByRole('rowgroup')[1])
    .queryAllByRole('row')
    .map((row) => within(row).queryAllByRole('rowheader')[0]?.textContent ?? row.textContent);
const search = () => screen.getByLabelText('Squad name');
const minimum = () => screen.getByLabelText('Minimum total points');
const sort = () => screen.getByLabelText('Sort by');
const count = () => document.querySelector('output');
const sortedHeaders = () =>
  screen
    .getAllByRole('columnheader')
    .filter((header) => header.getAttribute('aria-sort'))
    .map((header) => `${header.textContent}:${header.getAttribute('aria-sort')}`);

describe('Leaderboard markup', () => {
  it('is a named section with a search form, three labelled controls and a real table', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<Leaderboard />);
    expect(screen.getByRole('region', { name: 'Squad leaderboard' }).tagName).toBe('SECTION');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Squad leaderboard');
    expect(screen.getByRole('search', { name: 'Filter squads' })).toBeInTheDocument();
    expect(search()).toHaveAttribute('type', 'search');
    expect(minimum()).toHaveAttribute('type', 'number');
    expect(sort().tagName).toBe('SELECT');
    const ids = [search().id, minimum().id, sort().id];
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => id.length > 0)).toBe(true);
    for (const [text, control] of [['Squad name', search()], ['Minimum total points', minimum()], ['Sort by', sort()]]) {
      expect(screen.getByText(text).tagName).toBe('LABEL');
      expect(screen.getByText(text)).toHaveAttribute('for', control.id);
    }
    expect(screen.getByRole('table', { name: 'PVS squad standings (sample data), highest first' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Squad', 'WWCD', 'Placement', 'Kills', 'Total']);
    expect(container.querySelectorAll('tbody th[scope="row"]')).toHaveLength(4);
    expect(screen.getByRole('figure', { name: 'Squad standings table' })).toHaveAttribute('tabindex', '0');
    expect([...sort().options].map((o) => `${o.value}=${o.textContent}`)).toEqual(['total=Total points', 'wwcd=Wins (WWCD)', 'placement=Placement points', 'kills=Kill points']);
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
    expect(container.querySelectorAll('output, [aria-live], [role="status"]')).toHaveLength(1);
    expect(count()).toHaveAttribute('aria-live', 'polite');
    expect(error).not.toHaveBeenCalled();
  });

  it('gives two leaderboards on one page different ids, and a submit of the form is prevented', () => {
    render(
      <>
        <Leaderboard />
        <Leaderboard />
      </>
    );
    const [first, second] = screen.getAllByLabelText('Squad name');
    expect(first.id).not.toBe(second.id);
    expect(fireEvent.submit(screen.getAllByRole('search')[0])).toBe(false);
  });

  it('survives StrictMode', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <StrictMode>
        <Leaderboard />
      </StrictMode>
    );
    await userEvent.type(search(), 'a');
    expect(error).not.toHaveBeenCalled();
  });
});

describe('Leaderboard data', () => {
  it('starts by total, highest first, with the count and the sorted column marked', () => {
    render(<Leaderboard />);
    expect(names()).toEqual(['The Expendables', 'Cerberus Esports', 'Roy Esports', 'AGG']);
    expect(count()).toHaveTextContent('Showing 4 of 4 squads');
    expect(sortedHeaders()).toEqual(['Total:descending']);
    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells).toEqual(['5', '142', '188', '330']); // total = placement + kills
  });

  it('reorders the rows by the sort choice and moves aria-sort to its column', async () => {
    render(<Leaderboard />);
    const user = userEvent.setup();
    await user.selectOptions(sort(), 'wwcd');
    expect(names()).toEqual(['The Expendables', 'Roy Esports', 'Cerberus Esports', 'AGG']);
    expect(sortedHeaders()).toEqual(['WWCD:descending']);
    await user.selectOptions(sort(), 'placement');
    expect(names()).toEqual(['The Expendables', 'AGG', 'Cerberus Esports', 'Roy Esports']);
    expect(sortedHeaders()).toEqual(['Placement:descending']);
    await user.selectOptions(sort(), 'kills');
    expect(names()).toEqual(['Cerberus Esports', 'The Expendables', 'Roy Esports', 'AGG']);
    expect(sortedHeaders()).toEqual(['Kills:descending']);
    await user.selectOptions(sort(), 'total');
    expect(names()).toEqual(['The Expendables', 'Cerberus Esports', 'Roy Esports', 'AGG']);
  });

  it('searches without caring about case or the spaces around the text', async () => {
    render(<Leaderboard />);
    await userEvent.type(search(), '  CERB ');
    expect(names()).toEqual(['Cerberus Esports']);
  });

  it('reads the minimum with valueAsNumber; an invalid number means no minimum and the field can be cleared', () => {
    render(<Leaderboard />);
    fireEvent.change(minimum(), { target: { value: '300' } });
    expect(names()).toEqual(['The Expendables', 'Cerberus Esports']);
    expect(minimum()).toHaveValue(300);
    fireEvent.change(minimum(), { target: { value: '321' } });
    expect(names()).toEqual(['The Expendables']);
    fireEvent.change(minimum(), { target: { value: '' } });
    expect(names()).toHaveLength(4);
    expect(minimum()).toHaveValue(null); // empty again: the state is null, not 0
    fireEvent.change(minimum(), { target: { value: '300' } });
    fireEvent.change(minimum(), { target: { value: 'abc' } }); // a number box sanitises this to ''
    expect(names()).toHaveLength(4);
    fireEvent.change(minimum(), { target: { value: '-50' } });
    expect(names()).toHaveLength(4);
  });

  it('shows a message, keeps the table head and the count when no squad matches', () => {
    render(<Leaderboard />);
    fireEvent.change(minimum(), { target: { value: '1e3' } }); // read as 1000
    expect(names()).toEqual([EMPTY_MESSAGE]);
    expect(screen.queryAllByRole('rowheader')).toHaveLength(0);
    expect(count()).toHaveTextContent('Showing 0 of 4 squads');
    expect(screen.getByText(EMPTY_MESSAGE)).toHaveAttribute('colspan', '5');
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
  });

  it('combines the filters with the sort and never changes its props', async () => {
    const data = Object.freeze([...STANDINGS].reverse());
    const before = data.map((s) => s.squadId).join();
    render(<Leaderboard standings={data} />);
    const user = userEvent.setup();
    await user.type(search(), 'esports');
    fireEvent.change(minimum(), { target: { value: '240' } });
    await user.selectOptions(sort(), 'kills');
    expect(names()).toEqual(['Cerberus Esports', 'Roy Esports']);
    expect(count()).toHaveTextContent('Showing 2 of 4 squads');
    expect(data.map((s) => s.squadId).join()).toBe(before);
  });

  it('works with a custom list and with an empty one', () => {
    const { unmount } = render(<Leaderboard standings={[{ squadId: 'x', squadName: 'Xeno', wwcdCount: 1, placementPts: 2, killPts: 3 }]} />);
    expect(names()).toEqual(['Xeno']);
    expect(count()).toHaveTextContent('Showing 1 of 1 squads');
    unmount();
    render(<Leaderboard standings={[]} />);
    expect(count()).toHaveTextContent('Showing 0 of 0 squads');
    expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument();
  });
});

describe('Leaderboard rendering', () => {
  it('typing a letter renders once, and focusing the box renders nothing', async () => {
    const onRender = vi.fn();
    render(
      <Profiler id="leaderboard" onRender={onRender}>
        <Leaderboard />
      </Profiler>
    );
    const base = onRender.mock.calls.length;
    const user = userEvent.setup();
    await user.click(search());
    expect(onRender.mock.calls.length - base).toBe(0);
    await user.type(search(), 'r');
    expect(onRender.mock.calls.length - base).toBe(1);
    expect(names()).toEqual(['Cerberus Esports', 'Roy Esports']);
    await user.type(search(), 'o');
    expect(onRender.mock.calls.length - base).toBe(2);
    await user.type(search(), 'y');
    expect(onRender.mock.calls.length - base).toBe(3);
    expect(names()).toEqual(['Roy Esports']);
    expect(count()).toHaveTextContent('Showing 1 of 4 squads');
    await user.clear(search());
    expect(names()).toHaveLength(4);
  });
});
