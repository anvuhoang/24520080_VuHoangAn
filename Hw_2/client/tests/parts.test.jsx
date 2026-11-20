// client/tests/parts.test.jsx — SwipeCard and DeckControls on their own, so each one is held to its contract without the hook behind it.
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DeckControls from '../src/DeckControls.jsx';
import SwipeCard from '../src/SwipeCard.jsx';

const profile = { id: 'p1', name: 'Minh Anh', age: 26, bio: 'Bio' };
const down = { pointerId: 1, isPrimary: true, button: 0 };

describe('SwipeCard', () => {
  it('reports a clear drag as an action', () => {
    const onSwipe = vi.fn();
    render(<SwipeCard profile={profile} onSwipe={onSwipe} />);
    const card = screen.getByRole('article');
    fireEvent.pointerDown(card, { ...down, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(card, { ...down, clientX: 100, clientY: 0 });
    expect(onSwipe).toHaveBeenCalledWith('LIKE');
  });

  it('does not even start a drag while it is disabled (an action is in flight)', () => {
    const onSwipe = vi.fn();
    render(<SwipeCard profile={profile} onSwipe={onSwipe} disabled />);
    const card = screen.getByRole('article');
    fireEvent.pointerDown(card, { ...down, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(card, { ...down, clientX: 100, clientY: 0 });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('is named with the person and the age', () => {
    render(<SwipeCard profile={profile} onSwipe={() => {}} />);
    expect(screen.getByRole('article', { name: 'Minh Anh, 26' })).toBeInTheDocument();
  });
});

describe('DeckControls', () => {
  const setup = (props = {}) => {
    const handlers = { onSwipe: vi.fn(), onUndo: vi.fn(), onRestart: vi.fn() };
    render(<DeckControls hasCard canUndo busy={false} {...handlers} {...props} />);
    return handlers;
  };

  it('calls the handlers when the buttons are available', async () => {
    const user = userEvent.setup();
    const h = setup();
    await user.click(screen.getByRole('button', { name: /^Pass/ }));
    await user.click(screen.getByRole('button', { name: /^Like/ }));
    await user.click(screen.getByRole('button', { name: /^Super like/ }));
    await user.click(screen.getByRole('button', { name: /^Undo/ }));
    await user.click(screen.getByRole('button', { name: /^Start over/ }));
    expect(h.onSwipe.mock.calls.map((c) => c[0])).toEqual(['PASS', 'LIKE', 'SUPER']);
    expect(h.onUndo).toHaveBeenCalledTimes(1);
    expect(h.onRestart).toHaveBeenCalledTimes(1);
  });

  it('calls nothing when the buttons are aria-disabled, and they keep focus', async () => {
    const user = userEvent.setup();
    const h = setup({ hasCard: false, canUndo: false, busy: true });
    for (const name of [/^Pass/, /^Like/, /^Super like/, /^Undo/, /^Start over/]) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      await user.click(button);
      button.focus();
      expect(button).toHaveFocus();
    }
    expect(h.onSwipe).not.toHaveBeenCalled();
    expect(h.onUndo).not.toHaveBeenCalled();
    expect(h.onRestart).not.toHaveBeenCalled();
  });

  it('with a card but nothing to undo, only Undo is unavailable', () => {
    setup({ canUndo: false });
    expect(screen.getByRole('button', { name: /^Like/ })).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByRole('button', { name: /^Undo/ })).toHaveAttribute('aria-disabled', 'true');
  });
});
