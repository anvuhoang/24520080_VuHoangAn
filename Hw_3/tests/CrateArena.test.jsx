// tests/CrateArena.test.jsx
import { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CRATES } from '../src/arena/arenaData.js';
import { ClaimError, createArenaServer } from '../src/arena/mockServer.js';
import { CrateArena } from '../src/components/CrateArena.jsx';

const GCOIN = 'G-Coin Contraband Crate + 2,500 G-Coin';
const GOLD = 'PVS Gold Contraband Crate';
const VIP = 'PVS Finals VIP Pass + 5,000 G-Coin';
const TICKET = 'PVS Grand Finals Ticket (Standard)';

const advance = (ms) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const card = (title) => screen.getByRole('article', { name: title });
const claimButton = (title) => within(card(title)).getByRole('button');
const notice = () => document.querySelector('output');
const stockOf = (title) => within(card(title)).getAllByRole('definition')[1].textContent;

beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] }));
afterEach(() => vi.useRealTimers());

describe('CrateArena markup', () => {
  it('is a named section with a heading, an empty polite notice and one card per crate', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<CrateArena />);
    expect(screen.getByRole('region', { name: 'Crate arena' }).tagName).toBe('SECTION');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Crate arena');
    expect(notice().tagName).toBe('OUTPUT');
    expect(notice()).toHaveAttribute('data-kind', 'idle');
    expect(notice().textContent).toBe('');
    expect(screen.getAllByRole('status').includes(notice())).toBe(true);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(CRATES.map((c) => c.title));
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
    expect(error).not.toHaveBeenCalled(); // no key warning
  });

  it('starts with the open crate claimable and the others saying why not', () => {
    render(<CrateArena />);
    expect(claimButton(GCOIN)).toHaveTextContent('Claim');
    expect(claimButton(GOLD)).toHaveTextContent('Opens soon');
    expect(claimButton(VIP)).toHaveTextContent('Opens soon');
    expect(claimButton(TICKET)).toHaveTextContent('Drop ended');
    expect(stockOf(GCOIN)).toBe('1');
  });

  it('renders one card per crate for a custom list and an empty list without crashing', () => {
    const list = [
      { id: 'x1', title: 'Alpha', priceVnd: 1000, remainingStock: 2, dropEpochMs: Date.now() - 1000 },
      { id: 'x2', title: 'Beta', priceVnd: 2000, remainingStock: 0, dropEpochMs: Date.now() - 1000 },
    ];
    const { unmount } = render(<CrateArena crates={list} server={createArenaServer({ crates: list })} />);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(claimButton('Alpha')).toHaveTextContent('Claim');
    expect(claimButton('Beta')).toHaveTextContent('Looted out');
    unmount();
    render(<CrateArena crates={[]} />);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });
});

describe('CrateArena claims', () => {
  it('a conflict shows the notice and the card goes to sold out (the screen shows 1, another player took it)', async () => {
    render(<CrateArena />);
    fireEvent.click(claimButton(GCOIN));
    expect(stockOf(GCOIN)).toBe('0'); // optimistic, before the server answered
    expect(claimButton(GCOIN)).toHaveTextContent('Claiming…');
    expect(notice().textContent).toBe('');
    await advance(599);
    expect(claimButton(GCOIN)).toHaveTextContent('Claiming…');
    await advance(1);
    expect(notice()).toHaveAttribute('data-kind', 'conflict');
    expect(notice().textContent).toBe(`Looted out: ${GCOIN} was taken by another player. Your claim was rolled back.`);
    expect(stockOf(GCOIN)).toBe('0');
    expect(claimButton(GCOIN)).toHaveTextContent('Looted out');
    expect(claimButton(GCOIN)).toHaveAttribute('aria-disabled', 'true');
    expect(within(card(GCOIN)).getByRole('status')).toHaveTextContent('Looted out');
    expect(card(GCOIN).dataset.phase).toBe('LOOTED_OUT');
    expect(claimButton(GOLD)).toHaveTextContent('Opens soon'); // the other cards are untouched
    expect(stockOf(VIP)).toBe('20');
    fireEvent.click(claimButton(GCOIN));
    await advance(2000);
    expect(notice()).toHaveAttribute('data-kind', 'conflict');
  });

  it('a successful claim takes one unit, says so, and the crate can be claimed again', async () => {
    render(<CrateArena />);
    await advance(21_000); // the gold crate opens after about 20 s
    expect(claimButton(GOLD)).toHaveTextContent('Claim');
    fireEvent.click(claimButton(GOLD));
    expect(stockOf(GOLD)).toBe('29');
    expect(claimButton(GOLD)).toHaveTextContent('Claiming…');
    await advance(600);
    expect(notice()).toHaveAttribute('data-kind', 'ok');
    expect(notice().textContent).toBe(`Claimed: ${GOLD}. 29 left.`);
    expect(claimButton(GOLD)).toHaveTextContent('Claim');
    fireEvent.click(claimButton(GOLD));
    await advance(600);
    expect(notice().textContent).toBe(`Claimed: ${GOLD}. 28 left.`); // a new text, so it is announced again
  });

  it('sends one request for several quick clicks (the real mock server loses one unit)', async () => {
    const server = createArenaServer({ crates: CRATES, latencyMs: 100 });
    render(<CrateArena server={server} />);
    for (let i = 0; i < 3; i += 1) fireEvent.click(claimButton(GCOIN));
    await advance(100);
    expect(server.stockOf('gcoin-crate-2500')).toBe(0);
    expect(notice()).toHaveAttribute('data-kind', 'ok'); // with its own server there is no rival
    expect(notice().textContent).toBe(`Claimed: ${GCOIN}. 0 left.`);
    expect(claimButton(GCOIN)).toHaveTextContent('Looted out');
  });

  it('after another error says that nothing was taken and gives the stock back', async () => {
    const server = { claim: vi.fn(() => Promise.reject(new ClaimError(500, 'boom'))) };
    render(<CrateArena server={server} />);
    fireEvent.click(claimButton(GCOIN));
    expect(stockOf(GCOIN)).toBe('0');
    await advance(0);
    expect(notice()).toHaveAttribute('data-kind', 'error');
    expect(notice().textContent).toBe(`Claim failed for ${GCOIN}. Nothing was taken. Please try again.`);
    expect(stockOf(GCOIN)).toBe('1');
    expect(claimButton(GCOIN)).toHaveTextContent('Claim');
  });
});

describe('CrateArena cleanup and rendering', () => {
  it('on unmount during a claim: no warning, the server stock is unchanged, no timer left', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const server = createArenaServer({ crates: CRATES, latencyMs: 400 });
    const { unmount } = render(<CrateArena server={server} />);
    fireEvent.click(claimButton(GCOIN));
    await advance(100);
    unmount();
    await advance(5000);
    expect(server.stockOf('gcoin-crate-2500')).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(error).not.toHaveBeenCalled();
  });

  it('survives StrictMode', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <StrictMode>
        <CrateArena />
      </StrictMode>
    );
    fireEvent.click(claimButton(GCOIN));
    await advance(600);
    expect(notice()).toHaveAttribute('data-kind', 'conflict');
    expect(error).not.toHaveBeenCalled();
  });

  it('does not re-render itself on the countdown ticks (only the cards do)', async () => {
    let renders = 0;
    function Probe() {
      renders += 1;
      return <CrateArena />;
    }
    render(<Probe />);
    const base = renders;
    await advance(5000);
    expect(renders - base).toBe(0);
  });
});

describe('CrateArena known defects (audit; each passes while the defect exists)', () => {
  // Audit #08: there is one notice for the whole arena, so when two claims end in the same moment the
  // second message replaces the first and a conflict is never announced.
  // Change `it.fails` to `it` once every outcome is announced (a list of messages, or a queue).
  it.fails('announces a conflict even when another claim ends right after it (known defect)', async () => {
    render(<CrateArena />);
    await advance(21_000); // both the G-Coin crate and the gold crate are open now
    fireEvent.click(claimButton(GCOIN)); // ends in a 409
    fireEvent.click(claimButton(GOLD)); // ends in OK, in the same moment
    await advance(600);
    expect(claimButton(GCOIN)).toHaveTextContent('Looted out'); // the card knows about the conflict...
    expect(notice().textContent).toMatch(/Looted out/); // ...but the notice only has the last message
  });
});
