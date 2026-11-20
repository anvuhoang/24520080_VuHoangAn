// client/tests/SwipeDeck.test.jsx — the whole page against a fake API that follows the server's rules.
import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import { controlledFetch, jsonResponse } from './fetchMock.js';
import { fakeApi, PROFILES } from './fakeApi.js';

let api;

function setup(options) {
  api = fakeApi(options);
  vi.stubGlobal('fetch', api.fetchMock);
  return render(<App />);
}

const deck = () => screen.getByRole('region', { name: 'Swipe deck' });
const card = () => screen.getByRole('article');
const score = () => screen.getByText('Score').nextElementSibling.textContent;
const left = () => screen.getByText('Cards left').nextElementSibling.textContent;
const status = () => screen.getAllByRole('status').at(-1).textContent;
const ready = async () => screen.findByRole('article');
const press = (key, init = {}) => fireEvent.keyDown(deck(), { key, ...init });
const lastPost = () => api.posts().at(-1)?.body;

// A drag on the card as the browser sends it: pointerdown, then pointerup elsewhere
function drag(from, to, ids = {}) {
  const pointerId = ids.pointerId ?? 1;
  const base = { pointerId, isPrimary: ids.isPrimary ?? true, button: ids.button ?? 0 };
  fireEvent.pointerDown(card(), { ...base, clientX: from[0], clientY: from[1] });
  fireEvent.pointerUp(card(), { ...base, clientX: to[0], clientY: to[1] });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loading', () => {
  it('shows a busy status first, then the first card', async () => {
    setup();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('heading', { level: 1, name: 'Swipe Deck' })).toBeInTheDocument();
    await ready();
    expect(within(card()).getByRole('heading', { level: 2 })).toHaveTextContent('Minh Anh, 26');
    expect(score()).toBe('0');
    expect(left()).toBe('4');
  });

  it('restores the saved history: the next card is shown and the score is back', async () => {
    setup({ swipes: [{ id: 's0', profileId: 'p1', action: 'LIKE' }, { id: 's1', profileId: 'p2', action: 'PASS' }] });
    await ready();
    expect(within(card()).getByRole('heading', { level: 2 })).toHaveTextContent('Thu Trang');
    expect(score()).toBe('5');
    expect(left()).toBe('2');
  });

  it('shows the error and retries when asked', async () => {
    const user = userEvent.setup();
    api = fakeApi();
    let failing = true;
    api.state.override = (method, url) => (failing && url === '/api/profiles' ? jsonResponse({ error: 'Database is down.' }, 500) : null);
    vi.stubGlobal('fetch', api.fetchMock);
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Database is down.');
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await ready();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reports a network failure in words, not as an exception', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The server could not be reached.');
  });

  it('aborts its requests when the page is left, and shows nothing afterwards', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = render(<App />);
    expect(calls).toHaveLength(2);
    unmount();
    expect(calls.every((c) => c.signal.aborted)).toBe(true);
  });

  it('works under Strict Mode (the effect runs twice; the first run is aborted)', async () => {
    api = fakeApi();
    vi.stubGlobal('fetch', api.fetchMock);
    render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    await ready();
    expect(left()).toBe('4');
  });
});

describe('keyboard', () => {
  it('ArrowRight likes the top card, saves it, and shows the next one', async () => {
    setup();
    await ready();
    press('ArrowRight');
    await waitFor(() => expect(within(card()).getByRole('heading', { level: 2 })).toHaveTextContent('Quang Huy'));
    expect(lastPost()).toEqual({ profileId: 'p1', action: 'LIKE' });
    expect(score()).toBe('10');
    expect(left()).toBe('3');
    expect(status()).toBe('Liked Minh Anh. Score 10.');
  });

  it('ArrowLeft passes (-5) and ArrowUp super likes (+25)', async () => {
    setup();
    await ready();
    press('ArrowLeft');
    await waitFor(() => expect(score()).toBe('-5'));
    expect(lastPost()).toEqual({ profileId: 'p1', action: 'PASS' });
    press('ArrowUp');
    await waitFor(() => expect(score()).toBe('20'));
    expect(lastPost()).toEqual({ profileId: 'p2', action: 'SUPER' });
  });

  it('the score is asymmetric: a like then a pass gives 5, not 0', async () => {
    setup();
    await ready();
    press('ArrowRight');
    await waitFor(() => expect(left()).toBe('3'));
    press('ArrowLeft');
    await waitFor(() => expect(left()).toBe('2'));
    expect(score()).toBe('5');
  });

  it('Backspace undoes the last swipe: the card comes back and the score goes back', async () => {
    setup();
    await ready();
    press('ArrowRight');
    await waitFor(() => expect(score()).toBe('10'));
    press('Backspace');
    await waitFor(() => expect(score()).toBe('0'));
    expect(within(card()).getByRole('heading', { level: 2 })).toHaveTextContent('Minh Anh');
    expect(api.deletes()).toHaveLength(1);
    expect(api.state.swipes).toHaveLength(0);
    expect(status()).toBe('Undid liked Minh Anh. Score 0.');
  });

  it('undo is last in, first out: three swipes come back in reverse order', async () => {
    setup();
    await ready();
    for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp']) {
      press(key);
      await waitFor(() => expect(api.state.swipes.length).toBe(['ArrowRight', 'ArrowLeft', 'ArrowUp'].indexOf(key) + 1));
      await waitFor(() => expect(deck()).toBeInTheDocument());
      await act(async () => {});
    }
    const names = [];
    for (let i = 0; i < 3; i++) {
      press('Backspace');
      await waitFor(() => expect(api.state.swipes.length).toBe(2 - i));
      await act(async () => {});
      names.push(within(card()).getByRole('heading', { level: 2 }).textContent);
    }
    expect(names).toEqual(['Thu Trang, 27', 'Quang Huy, 29', 'Minh Anh, 26']);
    expect(score()).toBe('0');
  });

  it('undo with nothing to undo sends nothing', async () => {
    setup();
    await ready();
    press('Backspace');
    await act(async () => {});
    expect(api.deletes()).toHaveLength(0);
  });

  it('a held key is one swipe: repeat events are ignored', async () => {
    setup();
    await ready();
    press('ArrowRight');
    press('ArrowRight', { repeat: true });
    press('ArrowRight', { repeat: true });
    await waitFor(() => expect(score()).toBe('10'));
    expect(api.posts()).toHaveLength(1);
  });

  it('handled keys stop the page from scrolling or going back (default prevented), other keys are left alone', async () => {
    setup();
    await ready();
    expect(fireEvent.keyDown(deck(), { key: 'ArrowRight' })).toBe(false);
    expect(fireEvent.keyDown(deck(), { key: 'Backspace' })).toBe(false);
    expect(fireEvent.keyDown(deck(), { key: 'ArrowDown' })).toBe(true);
    expect(fireEvent.keyDown(deck(), { key: 'a' })).toBe(true);
    expect(fireEvent.keyDown(deck(), { key: 'Tab' })).toBe(true);
    await act(async () => {});
  });

  it('browser chords are not swipes: Alt+Left (Back), Ctrl+Left, Cmd+Left', async () => {
    setup();
    await ready();
    for (const mod of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      expect(fireEvent.keyDown(deck(), { key: 'ArrowLeft', ...mod })).toBe(true);
    }
    await act(async () => {});
    expect(api.posts()).toHaveLength(0);
  });

  it('the deck can take focus (tabIndex 0)', async () => {
    setup();
    await ready();
    expect(deck()).toHaveAttribute('tabindex', '0');
    deck().focus();
    expect(deck()).toHaveFocus();
  });
});

describe('one action at a time', () => {
  it('three quick keys while the first is on its way send one request; the next works after the answer', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    calls[0].resolve(PROFILES);
    calls[1].resolve([]);
    await ready();

    press('ArrowRight');
    press('ArrowLeft');
    press('ArrowUp');
    await act(async () => {});
    expect(calls).toHaveLength(3); // two loads and one POST
    expect(JSON.parse(calls[2].init.body)).toEqual({ profileId: 'p1', action: 'LIKE' });
    expect(screen.getByRole('button', { name: /^Like/ })).toHaveAttribute('aria-disabled', 'true');

    calls[2].resolve({ id: 's0', profileId: 'p1', action: 'LIKE' }, 201);
    await waitFor(() => expect(score()).toBe('10'));
    expect(screen.getByRole('button', { name: /^Like/ })).toHaveAttribute('aria-disabled', 'false');
    press('ArrowLeft');
    await act(async () => {});
    expect(calls).toHaveLength(4);
  });

  it('a pointer swipe is ignored while an action is in flight', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    calls[0].resolve(PROFILES);
    calls[1].resolve([]);
    await ready();
    press('ArrowRight');
    await act(async () => {});
    drag([100, 100], [250, 100]);
    expect(calls).toHaveLength(3);
  });
});

describe('failures', () => {
  it('a save that fails keeps the card and the score, and says so', async () => {
    setup();
    await ready();
    api.state.override = (method) => (method === 'POST' ? jsonResponse({ error: 'Database is down.' }, 500) : null);
    press('ArrowRight');
    await waitFor(() => expect(status()).toBe('Not saved: Database is down.'));
    expect(within(card()).getByRole('heading', { level: 2 })).toHaveTextContent('Minh Anh');
    expect(score()).toBe('0');
    expect(screen.getByRole('button', { name: /^Like/ })).toHaveAttribute('aria-disabled', 'false'); // unlocked again
  });

  it('a network failure on save is reported without a crash', async () => {
    setup();
    await ready();
    api.state.override = () => {
      throw new TypeError('Failed to fetch');
    };
    press('ArrowRight');
    await waitFor(() => expect(status()).toBe('Not saved: The server could not be reached.'));
    expect(score()).toBe('0');
  });

  it('when the server says the history is different (409), it takes the server history', async () => {
    setup();
    await ready();
    press('ArrowRight');
    await waitFor(() => expect(score()).toBe('10'));
    // another tab undid and swiped: the server now has two swipes, this tab thinks it has one
    api.state.swipes = [{ id: 'x1', profileId: 'p1', action: 'PASS' }, { id: 'x2', profileId: 'p2', action: 'PASS' }];
    press('Backspace'); // asks to delete s1, which the server no longer has: 404
    await waitFor(() => expect(status()).toMatch(/^Not saved: Unknown swipe\./));
    await waitFor(() => expect(score()).toBe('-10'));
    expect(left()).toBe('2');
  });
});

describe('pointer', () => {
  it.each([
    ['right', [100, 100], [200, 100], { profileId: 'p1', action: 'LIKE' }],
    ['left', [200, 100], [100, 100], { profileId: 'p1', action: 'PASS' }],
    ['up', [100, 200], [100, 100], { profileId: 'p1', action: 'SUPER' }],
  ])('a drag %s saves the matching action', async (_name, from, to, expected) => {
    setup();
    await ready();
    drag(from, to);
    await waitFor(() => expect(api.posts()).toHaveLength(1));
    expect(lastPost()).toEqual(expected);
  });

  it.each([
    ['a tap', [100, 100], [100, 100]],
    ['a 20 px jitter', [100, 100], [120, 105]],
    ['a downward drag', [100, 100], [100, 250]],
    ['exactly 50 px', [100, 100], [150, 100]],
  ])('%s is not a swipe', async (_name, from, to) => {
    setup();
    await ready();
    drag(from, to);
    await act(async () => {});
    expect(api.posts()).toHaveLength(0);
  });

  it('a pointerup that never had a pointerdown is nothing, and does not throw', async () => {
    setup();
    await ready();
    expect(() => fireEvent.pointerUp(card(), { pointerId: 1, isPrimary: true, button: 0, clientX: 500, clientY: 0 })).not.toThrow();
    await act(async () => {});
    expect(api.posts()).toHaveLength(0);
  });

  it('a cancelled gesture (the browser took it) is forgotten', async () => {
    setup();
    await ready();
    fireEvent.pointerDown(card(), { pointerId: 1, isPrimary: true, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerCancel(card(), { pointerId: 1 });
    fireEvent.pointerUp(card(), { pointerId: 1, isPrimary: true, button: 0, clientX: 300, clientY: 0 });
    await act(async () => {});
    expect(api.posts()).toHaveLength(0);
  });

  it('ignores a second finger and the right mouse button', async () => {
    setup();
    await ready();
    drag([100, 100], [250, 100], { isPrimary: false, pointerId: 2 });
    drag([100, 100], [250, 100], { button: 2 });
    await act(async () => {});
    expect(api.posts()).toHaveLength(0);
  });

  it('a pointerup from a different pointer than the one that went down is not a swipe', async () => {
    setup();
    await ready();
    fireEvent.pointerDown(card(), { pointerId: 1, isPrimary: true, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(card(), { pointerId: 9, isPrimary: true, button: 0, clientX: 300, clientY: 0 });
    await act(async () => {});
    expect(api.posts()).toHaveLength(0);
  });

  it('captures the pointer so the drag still ends on the card when it leaves it', async () => {
    setup();
    await ready();
    const capture = vi.fn();
    card().setPointerCapture = capture;
    fireEvent.pointerDown(card(), { pointerId: 4, isPrimary: true, button: 0, clientX: 0, clientY: 0 });
    expect(capture).toHaveBeenCalledWith(4);
  });
});

describe('buttons', () => {
  it('each action has a labelled button with its key written next to it', async () => {
    setup();
    await ready();
    for (const name of [/^Pass/, /^Like/, /^Super like/, /^Undo/, /^Start over/]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /^Undo/ })).toHaveTextContent('Backspace');
  });

  it('Like, Pass and Super like save the same actions as the keys', async () => {
    const user = userEvent.setup();
    setup();
    await ready();
    await user.click(screen.getByRole('button', { name: /^Like/ }));
    await waitFor(() => expect(api.posts()).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Pass/ })).toHaveAttribute('aria-disabled', 'false'));
    await user.click(screen.getByRole('button', { name: /^Pass/ }));
    await waitFor(() => expect(api.posts()).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Super like/ })).toHaveAttribute('aria-disabled', 'false'));
    await user.click(screen.getByRole('button', { name: /^Super like/ }));
    await waitFor(() => expect(api.posts()).toHaveLength(3));
    expect(api.posts().map((c) => c.body.action)).toEqual(['LIKE', 'PASS', 'SUPER']);
  });

  it('Undo is unavailable (aria-disabled, still focusable) until there is something to undo, and does nothing when clicked', async () => {
    const user = userEvent.setup();
    setup();
    await ready();
    const undo = screen.getByRole('button', { name: /^Undo/ });
    expect(undo).toHaveAttribute('aria-disabled', 'true');
    expect(undo).not.toBeDisabled();
    await user.click(undo);
    expect(api.deletes()).toHaveLength(0);
  });
});

describe('end of the deck', () => {
  async function finish() {
    setup();
    await ready();
    for (let i = 0; i < 4; i++) {
      press('ArrowRight');
      await waitFor(() => expect(api.state.swipes).toHaveLength(i + 1));
      await act(async () => {});
    }
  }

  it('says there are no more cards and shows the final score', async () => {
    await finish();
    expect(screen.queryByRole('article', { name: /,/ })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'No more cards' })).toBeInTheDocument();
    expect(screen.getByText(/Final score: 40\./)).toBeInTheDocument();
    expect(left()).toBe('0');
    expect(screen.getByRole('button', { name: /^Like/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('keys do nothing when there is no card', async () => {
    await finish();
    press('ArrowRight');
    await act(async () => {});
    expect(api.posts()).toHaveLength(4);
  });

  it('undo brings the last card back from the end', async () => {
    await finish();
    press('Backspace');
    await waitFor(() => expect(left()).toBe('1'));
    expect(within(card()).getByRole('heading', { level: 2 })).toHaveTextContent('Duc Long');
    expect(score()).toBe('30');
  });

  it('Start over clears the saved history and returns to the first card with score 0', async () => {
    const user = userEvent.setup();
    await finish();
    await user.click(screen.getByRole('button', { name: /^Start over/ }));
    await waitFor(() => expect(left()).toBe('4'));
    expect(score()).toBe('0');
    expect(api.state.swipes).toHaveLength(0);
    expect(within(card()).getByRole('heading', { level: 2 })).toHaveTextContent('Minh Anh');
    expect(status()).toBe('Deck restarted. Score 0.');
  });
});

describe('structure', () => {
  it('has one main, one h1, a named region, and a live status', async () => {
    setup();
    await ready();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(deck()).toBeInTheDocument();
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('the decorative initials are hidden from screen readers', async () => {
    setup();
    await ready();
    expect(within(card()).getByText('MA')).toHaveAttribute('aria-hidden', 'true');
  });
});
