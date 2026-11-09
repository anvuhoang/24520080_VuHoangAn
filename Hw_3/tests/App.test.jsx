// tests/App.test.jsx
import { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';

beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] }));
afterEach(() => vi.useRealTimers());

const advance = (ms) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

describe('App landmarks and order', () => {
  it('has one main and one h1 (the first thing in it), then the arena, then the leaderboard', () => {
    const { container } = render(<App />);
    const main = screen.getByRole('main');
    const title = screen.getByRole('heading', { level: 1 });
    const arena = screen.getByRole('region', { name: 'Crate arena' });
    const board = screen.getByRole('region', { name: 'Squad leaderboard' });
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(title).toHaveTextContent('PUBG VN Arena');
    expect(main.firstElementChild.tagName).toBe('HEADER');
    expect(main.firstElementChild).toContainElement(title);
    expect([...main.children].map((child) => child.tagName)).toEqual(['HEADER', 'SECTION', 'SECTION']);
    expect(title.compareDocumentPosition(arena) & FOLLOWING).toBeTruthy();
    expect(arena.compareDocumentPosition(board) & FOLLOWING).toBeTruthy();
    expect(container.firstElementChild).toBe(main);
  });

  it('has a visible note, right under the title, that all numbers are sample data', () => {
    render(<App />);
    const note = screen.getByText(/^Sample data:/);
    expect(note.tagName).toBe('P');
    expect(note.textContent).toMatch(/invented/);
    expect(note.textContent).toMatch(/official/);
    expect(note).toBeVisible();
    expect(note).not.toHaveAttribute('aria-hidden');
    expect(note.previousElementSibling).toBe(screen.getByRole('heading', { level: 1 }));
  });

  it('keeps the heading levels in order and every heading text different', () => {
    render(<App />);
    const headings = screen.getAllByRole('heading');
    const levels = headings.map((heading) => Number(heading.tagName[1]));
    expect(levels).toEqual([1, 2, 3, 3, 3, 3, 2]);
    for (let i = 1; i < levels.length; i += 1) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    const texts = headings.map((heading) => heading.textContent);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('has no <div> or <span>, no inline style and no image', () => {
    const { container } = render(<App />);
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });
});

describe('App forms, ids and live regions', () => {
  it('has unique ids, every label pointing at a control, and only type="button" buttons', () => {
    const { container } = render(<App />);
    const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const label of container.querySelectorAll('label')) {
      const target = container.querySelector(`#${CSS.escape(label.getAttribute('for'))}`);
      expect(target).not.toBeNull();
      expect(['INPUT', 'SELECT']).toContain(target.tagName);
    }
    const controls = container.querySelectorAll('input, select');
    expect(controls).toHaveLength(3);
    expect([...controls].every((control) => control.labels.length === 1)).toBe(true);
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(4);
    for (const button of buttons) expect(button).toHaveAttribute('type', 'button');
  });

  it('has exactly six polite live regions and none that interrupts', () => {
    const { container } = render(<App />);
    expect(container.querySelectorAll('output, [role="status"], [aria-live]')).toHaveLength(1 + 4 + 1); // notice, 4 badges, count
    expect(container.querySelectorAll('[aria-live="assertive"], [role="alert"]')).toHaveLength(0);
    expect(screen.getByRole('search', { name: 'Filter squads' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});

describe('App as a whole', () => {
  it('ends the open crate in a conflict while the leaderboard filters, and the two do not interfere', async () => {
    render(<App />);
    fireEvent.click(within(screen.getByRole('article', { name: /G-Coin Contraband/ })).getByRole('button'));
    await advance(600);
    expect(document.querySelector('output[data-kind="conflict"]').textContent).toMatch(/Looted out: G-Coin/);
    fireEvent.change(screen.getByLabelText('Squad name'), { target: { value: 'roy' } });
    expect(screen.getByText('Showing 1 of 4 squads')).toBeInTheDocument();
    expect(document.querySelector('output[data-kind="conflict"]').textContent).toMatch(/Looted out: G-Coin/);
  });

  it('survives StrictMode and leaves no timer behind after unmount', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { unmount } = render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    await advance(3000);
    expect(vi.getTimerCount()).toBe(5); // the open card runs the closing clock, two cards run two clocks, the ended card none
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await advance(5000);
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('mounts with createRoot inside StrictMode, as main.jsx does', () => {
    const host = document.createElement('main');
    document.body.append(host);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = createRoot(host);
    act(() =>
      root.render(
        <StrictMode>
          <App />
        </StrictMode>
      )
    );
    expect(host.querySelectorAll('h1')).toHaveLength(1);
    act(() => root.unmount());
    host.remove();
    expect(error).not.toHaveBeenCalled();
  });
});
