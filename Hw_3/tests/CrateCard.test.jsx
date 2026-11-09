// tests/CrateCard.test.jsx
import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DROP_WINDOW_MS } from '../src/arena/arenaData.js';
import { CrateCard } from '../src/components/CrateCard.jsx';

const T0 = 1_700_000_000_000;
const crate = (over = {}) => ({
  id: 'pvs-gold-crate',
  title: 'PVS Gold Contraband Crate',
  priceVnd: 490000,
  remainingStock: 30,
  dropEpochMs: T0 + 3000,
  ...over,
});
const advance = (ms) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const button = () => screen.getByRole('button');
const unavailable = () => button().getAttribute('aria-disabled') === 'true';
const lastValue = (container) => container.querySelector('dd:last-child').textContent;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CrateCard markup', () => {
  it('is an article named by its heading, with the facts in a description list and one status', () => {
    const { container } = render(<CrateCard crate={crate()} />);
    expect(screen.getByRole('article', { name: 'PVS Gold Contraband Crate' }).tagName).toBe('ARTICLE');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('PVS Gold Contraband Crate');
    expect(container.querySelectorAll('dl')).toHaveLength(1);
    expect([...container.querySelectorAll('dt')].map((n) => n.textContent)).toEqual(['Price', 'Stock left', 'Opens in']);
    const values = [...container.querySelectorAll('dd')].map((n) => n.textContent.replace(/ /g, ' '));
    expect(values).toEqual(['490.000 ₫', '30', '00:00:03']);
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
    expect(container.querySelectorAll('[role="status"], [aria-live], output')).toHaveLength(1);
    expect(button()).toHaveAttribute('type', 'button');
  });

  it('describes each button by its own crate, so several "Claim" buttons can be told apart', () => {
    render(
      <>
        <CrateCard crate={crate()} />
        <CrateCard crate={crate({ id: 'x', title: 'Other crate' })} />
      </>
    );
    const [first, second] = screen.getAllByRole('button');
    expect(first).toHaveAccessibleDescription('PVS Gold Contraband Crate');
    expect(second).toHaveAccessibleDescription('Other crate');
  });

  it('renders a closed, harmless card when given no props at all', () => {
    const { container } = render(<CrateCard />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Unknown crate');
    expect(screen.getByRole('status')).toHaveTextContent('Opens soon');
    expect(unavailable()).toBe(true);
    expect(container.textContent).not.toMatch(/NaN|undefined|null/);
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(button());
  });
});

describe('CrateCard phases', () => {
  it('before the drop shows the countdown, and a button that says why it does not work', () => {
    const onClaim = vi.fn();
    render(<CrateCard crate={crate()} onClaim={onClaim} />);
    expect(screen.getByRole('status')).toHaveTextContent('Opens soon');
    expect(button()).toHaveTextContent('Opens soon');
    expect(unavailable()).toBe(true);
    fireEvent.click(button());
    expect(onClaim).not.toHaveBeenCalled();
    expect(button()).not.toBeDisabled(); // aria-disabled, not disabled: it keeps the focus
  });

  it('changes phase by itself at the drop and again at the end of the window', async () => {
    const onClaim = vi.fn();
    const { container } = render(<CrateCard crate={crate()} onClaim={onClaim} />);
    await advance(2800);
    expect(lastValue(container)).toBe('00:00:01');
    await advance(199); // 2999 ms: still closed
    expect(screen.getByRole('status')).toHaveTextContent('Opens soon');
    await advance(1); // exactly at the drop
    expect(screen.getByRole('status')).toHaveTextContent('Airdrop live');
    expect(button()).toHaveTextContent('Claim');
    expect(unavailable()).toBe(false);
    expect(container.querySelector('article').dataset.phase).toBe('AIRDROP_LIVE');
    expect([...container.querySelectorAll('dt')].map((n) => n.textContent)).toEqual(['Price', 'Stock left', 'Closes in']);
    expect(lastValue(container)).toBe('00:30:00');
    fireEvent.click(button());
    expect(onClaim).toHaveBeenCalledExactlyOnceWith('pvs-gold-crate');
    await advance(DROP_WINDOW_MS - 200);
    expect(button()).toHaveTextContent('Claim');
    expect(lastValue(container)).toBe('00:00:01');
    await advance(200); // the end of the window
    expect(screen.getByRole('status')).toHaveTextContent('Drop ended');
    expect(button()).toHaveTextContent('Drop ended');
    expect(unavailable()).toBe(true);
    expect(container.querySelectorAll('dt')).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('sold out wins over expired, also long after the window', () => {
    render(<CrateCard crate={crate({ dropEpochMs: T0 - 5 * DROP_WINDOW_MS })} stock={0} />);
    expect(screen.getByRole('status')).toHaveTextContent('Looted out');
    expect(button()).toHaveTextContent('Looted out');
    expect(unavailable()).toBe(true);
  });

  it('open but out of stock says Looted out; the stock prop overrides the crate and defaults to it', () => {
    const open = crate({ dropEpochMs: T0 - 1000 });
    const { rerender, container } = render(<CrateCard crate={open} />);
    expect(container.querySelectorAll('dd')[1].textContent).toBe('30');
    expect(button()).toHaveTextContent('Claim');
    rerender(<CrateCard crate={open} stock={0} />);
    expect(container.querySelectorAll('dd')[1].textContent).toBe('0');
    expect(button()).toHaveTextContent('Looted out');
    expect(unavailable()).toBe(true);
  });

  it('with stock left but the window over says Drop ended', () => {
    render(<CrateCard crate={crate({ dropEpochMs: T0 - 2 * 60 * 60 * 1000 })} />);
    expect(screen.getByRole('status')).toHaveTextContent('Drop ended');
    expect(unavailable()).toBe(true);
  });
});

describe('CrateCard claiming and announcements', () => {
  it('while claiming it says so, ignores clicks and keeps the focus', () => {
    const onClaim = vi.fn();
    const open = crate({ dropEpochMs: T0 - 1000 });
    const { rerender } = render(<CrateCard crate={open} onClaim={onClaim} />);
    button().focus();
    fireEvent.click(button());
    expect(onClaim).toHaveBeenCalledTimes(1);
    rerender(<CrateCard crate={open} stock={29} isClaiming onClaim={onClaim} />);
    expect(button()).toHaveTextContent('Claiming…');
    expect(unavailable()).toBe(true);
    expect(button()).toHaveFocus();
    fireEvent.click(button());
    expect(onClaim).toHaveBeenCalledTimes(1);
    rerender(<CrateCard crate={open} stock={29} onClaim={onClaim} />);
    expect(button()).toHaveTextContent('Claim');
    expect(button()).toHaveFocus();
  });

  it('does not announce the countdown every second: the status keeps its text node while it ticks', async () => {
    render(<CrateCard crate={crate({ dropEpochMs: T0 + 60_000 })} />);
    const status = screen.getByRole('status');
    const node = status.firstChild;
    const text = status.textContent;
    await advance(10_000);
    expect(status.textContent).toBe(text);
    expect(status.firstChild).toBe(node);
    expect(status.closest('dl')).toBeNull();
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(0);
    expect(lastValue(screen.getByRole('article'))).toBe('00:00:50');
  });
});

describe('CrateCard cleanup', () => {
  it('survives StrictMode and leaves no timer after unmount (two clocks while mounted)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(
      <StrictMode>
        <CrateCard crate={crate()} />
      </StrictMode>
    );
    expect(vi.getTimerCount()).toBe(2);
    await advance(1000);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await advance(5000);
    expect(error).not.toHaveBeenCalled();
  });
});
