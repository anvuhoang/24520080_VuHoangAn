// client/tests/deckReference.test.js — the slide 31 code, copied as written, to show where it fails.
// The snippets are put into small functions only so that they can be called; their bodies are the slide's lines.
import { describe, expect, it, vi } from 'vitest';

// --- slide 31, "Pointer Event Gesture Tracking", as written ---
function makePointerHandlers(startPos, swipe) {
  const handlePointerUp = (e) => {
    const dx = e.clientX - startPos.x;
    if (dx > 50) swipe('right');
    if (dx < -50) swipe('left');
  };
  return { handlePointerUp };
}

// --- slide 31, "Keyboard Navigation Mapping", as written ---
function makeKeyHandler(swipe, undoLastSwipe) {
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') swipe('left');
    if (e.key === 'ArrowRight') swipe('right');
    if (e.key === 'ArrowUp') swipe('up');
    if (e.key === 'Backspace') undoLastSwipe();
  };
  return { handleKeyDown };
}

// --- slide 31, "Asymmetric Score Derived State", as written ---
const slideScore = (history) =>
  history.reduce((acc, action) => {
    if (action.type === 'LIKE') {
      return acc + 10;
    } else {
      return acc - 5;
    }
  }, 0);

// --- slide 31, "LIFO Undo Stack Implementation", as written ---
const slideUndo = (history) => history.slice(0, -1);

describe('slide 31 pointer handling', () => {
  it('throws a TypeError when a pointerup arrives without a pointerdown (startPos is null)', () => {
    const { handlePointerUp } = makePointerHandlers(null, vi.fn());
    expect(() => handlePointerUp({ clientX: 100, clientY: 0 })).toThrow(TypeError);
  });

  it('has no upward swipe at all: a drag up does nothing, so "up" can only be reached with the keyboard', () => {
    const swipe = vi.fn();
    const { handlePointerUp } = makePointerHandlers({ x: 100, y: 300 }, swipe);
    handlePointerUp({ clientX: 100, clientY: 100 });
    expect(swipe).not.toHaveBeenCalled();
  });

  it('a long diagonal drag that is mostly vertical still counts as a sideways swipe (only dx is looked at)', () => {
    const swipe = vi.fn();
    const { handlePointerUp } = makePointerHandlers({ x: 0, y: 0 }, swipe);
    handlePointerUp({ clientX: 60, clientY: -300 });
    expect(swipe).toHaveBeenCalledWith('right');
  });
});

describe('slide 31 keyboard handling', () => {
  it('swipes on Alt+ArrowLeft, which is the browser\'s Back chord', () => {
    const swipe = vi.fn();
    makeKeyHandler(swipe, vi.fn()).handleKeyDown({ key: 'ArrowLeft', altKey: true });
    expect(swipe).toHaveBeenCalledWith('left');
  });

  it('swipes again for every repeat event of a held key (a held arrow throws the whole deck)', () => {
    const swipe = vi.fn();
    const { handleKeyDown } = makeKeyHandler(swipe, vi.fn());
    for (let i = 0; i < 20; i++) handleKeyDown({ key: 'ArrowRight', repeat: i > 0 });
    expect(swipe).toHaveBeenCalledTimes(20);
  });

  it('has no preventDefault: the page scrolls with the arrows and Backspace may leave the page', () => {
    const preventDefault = vi.fn();
    makeKeyHandler(vi.fn(), vi.fn()).handleKeyDown({ key: 'ArrowUp', preventDefault });
    makeKeyHandler(vi.fn(), vi.fn()).handleKeyDown({ key: 'Backspace', preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

describe('slide 31 score and undo', () => {
  it('scores a super like (type SUPER, the third action) as -5, like a pass: the else branch takes everything that is not LIKE', () => {
    expect(slideScore([{ type: 'SUPER' }])).toBe(-5);
  });

  it('scores an action that is not even an action as -5', () => {
    expect(slideScore([{ type: 'left' }, { type: undefined }])).toBe(-10);
  });

  it('uses "left"/"right"/"up" for the swipe and "LIKE" for the score: nothing in the slide turns one into the other', () => {
    // swipe('right') receives a direction; the reduce compares against 'LIKE'. A history of directions scores every swipe as -5.
    expect(slideScore([{ type: 'right' }, { type: 'right' }])).toBe(-10);
  });

  it('undo removes the last entry of the history and nothing else: it neither restores the card nor tells the server', () => {
    const history = [{ type: 'LIKE' }, { type: 'LIKE' }];
    const after = slideUndo(history);
    expect(after).toHaveLength(1);
    expect(history).toHaveLength(2); // the original is untouched, so the removal is only in the new array the caller must store
  });
});
