// tests/PianoKey.test.jsx
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PianoKey from '../src/components/PianoKey.jsx';

// Count how often the key's own render function runs: wrap it before the first render
const renders = { count: 0 };
const innerRender = PianoKey.type;

beforeEach(() => {
  renders.count = 0;
  PianoKey.type = function PianoKey(props) {
    renders.count += 1;
    return innerRender(props);
  };
});

afterEach(() => {
  PianoKey.type = innerRender;
});

const setup = (props = {}) => {
  const onNoteOn = vi.fn();
  const onNoteOff = vi.fn();
  render(<PianoKey midi={69} noteName="A4" onNoteOn={onNoteOn} onNoteOff={onNoteOff} {...props} />);
  return { onNoteOn, onNoteOff, key: screen.getByRole('button') };
};

const pointerDown = (el, init = {}) => fireEvent.pointerDown(el, { button: 0, pointerId: 1, ...init });
const pointerUp = (el) => fireEvent.pointerUp(el, { button: 0, pointerId: 1 });

describe('PianoKey markup', () => {
  it('is a button named by its note, with a pressed state', () => {
    const { key } = setup();

    expect(key).toHaveAttribute('type', 'button');
    expect(key).toHaveTextContent('A4');
    expect(key).not.toHaveAttribute('aria-label');
    expect(screen.getByRole('button', { name: 'A4' })).toBe(key);
    expect(key).toHaveAttribute('aria-pressed', 'false');
  });

  it('exposes isPressed as aria-pressed', () => {
    setup({ isPressed: true });
    expect(screen.getByRole('button', { pressed: true })).toBeInTheDocument();
  });

  it('works for a black key', () => {
    const { key } = setup({ midi: 70, noteName: 'A#4', isBlack: true });
    expect(key).toHaveTextContent('A#4');
  });

  // Audit #05: the default for noteName is '', so a key rendered without a note name is a button
  // with no accessible name. Change `it.fails` to `it` once the name has a sensible default.
  it.fails('has an accessible name even when no noteName is given (known defect)', () => {
    render(<PianoKey midi={60} />);
    expect(screen.getByRole('button').textContent.trim()).not.toBe('');
  });
});

describe('PianoKey pointer', () => {
  it('plays on pointer down and stops on pointer up, once each', () => {
    const { key, onNoteOn, onNoteOff } = setup();

    pointerDown(key);
    expect(onNoteOn).toHaveBeenCalledExactlyOnceWith(69);
    expect(onNoteOff).not.toHaveBeenCalled();

    pointerUp(key);
    expect(onNoteOff).toHaveBeenCalledExactlyOnceWith(69);
  });

  it('does not leave a note stuck when the pointer leaves the key while pressed', () => {
    const { key, onNoteOn, onNoteOff } = setup();

    pointerDown(key);
    fireEvent.pointerLeave(key);
    expect(onNoteOff).toHaveBeenCalledExactlyOnceWith(69);

    pointerUp(key); // a later pointer up does not stop it a second time
    expect(onNoteOn).toHaveBeenCalledTimes(1);
    expect(onNoteOff).toHaveBeenCalledTimes(1);
  });

  it('does not leave a note stuck when the pointer is cancelled (touch)', () => {
    const { key, onNoteOff } = setup();

    pointerDown(key);
    fireEvent.pointerCancel(key);

    expect(onNoteOff).toHaveBeenCalledExactlyOnceWith(69);
  });

  it('does nothing when the pointer only moves over and off the key', () => {
    const { key, onNoteOn, onNoteOff } = setup();

    fireEvent.pointerEnter(key);
    fireEvent.pointerLeave(key);

    expect(onNoteOn).not.toHaveBeenCalled();
    expect(onNoteOff).not.toHaveBeenCalled();
  });

  it('plays only for the primary button', () => {
    const { key, onNoteOn } = setup();

    pointerDown(key, { button: 2 });
    pointerDown(key, { button: 1 });

    expect(onNoteOn).not.toHaveBeenCalled();
  });

  it('does not throw without callbacks', () => {
    render(<PianoKey midi={60} noteName="C4" />);
    const key = screen.getByRole('button');

    expect(() => {
      pointerDown(key);
      pointerUp(key);
    }).not.toThrow();
  });
});

describe('PianoKey keyboard', () => {
  it.each([['Enter'], ['Space'], ['NumpadEnter']])('%s plays on key down and stops on key up', (code) => {
    const { key, onNoteOn, onNoteOff } = setup();

    fireEvent.keyDown(key, { code });
    expect(onNoteOn).toHaveBeenCalledExactlyOnceWith(69);

    fireEvent.keyUp(key, { code });
    expect(onNoteOff).toHaveBeenCalledExactlyOnceWith(69);
  });

  it('plays once for a key that is held (auto-repeat is ignored)', () => {
    const { key, onNoteOn } = setup();

    fireEvent.keyDown(key, { code: 'Enter' });
    fireEvent.keyDown(key, { code: 'Enter', repeat: true });
    fireEvent.keyDown(key, { code: 'Enter', repeat: true });

    expect(onNoteOn).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const { key, onNoteOn, onNoteOff } = setup();

    fireEvent.keyDown(key, { code: 'KeyA' });
    fireEvent.keyDown(key, { code: 'Tab' });
    fireEvent.keyUp(key, { code: 'KeyA' });

    expect(onNoteOn).not.toHaveBeenCalled();
    expect(onNoteOff).not.toHaveBeenCalled();
  });

  it('does not stop a note on a key up that had no key down', () => {
    const { key, onNoteOff } = setup();

    fireEvent.keyUp(key, { code: 'Enter' });

    expect(onNoteOff).not.toHaveBeenCalled();
  });

  it('stops the note when the key loses focus while it is held', () => {
    const { key, onNoteOff } = setup();

    fireEvent.keyDown(key, { code: 'Space' });
    fireEvent.blur(key);

    expect(onNoteOff).toHaveBeenCalledExactlyOnceWith(69);
  });

  it('prevents the default action of the keys it uses (no extra click)', () => {
    const { key } = setup();

    const notPrevented = fireEvent.keyDown(key, { code: 'Enter' });

    expect(notPrevented).toBe(false);
  });
});

describe('PianoKey input sources', () => {
  it('does not start a second note from the keyboard while the pointer holds the note', () => {
    const { key, onNoteOn, onNoteOff } = setup();

    pointerDown(key);
    fireEvent.keyDown(key, { code: 'Enter' });
    fireEvent.keyUp(key, { code: 'Enter' });
    expect(onNoteOn).toHaveBeenCalledTimes(1);
    expect(onNoteOff).not.toHaveBeenCalled(); // the keyboard cannot end a note the pointer started

    pointerUp(key);
    expect(onNoteOff).toHaveBeenCalledTimes(1);
  });
});

describe('PianoKey memoization', () => {
  it('is a React.memo component', () => {
    expect(PianoKey.$$typeof).toBe(Symbol.for('react.memo'));
  });

  it('re-renders only when its own props change', () => {
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();
    let rerenderParent;
    let setPressed;

    function Parent() {
      const [, setTick] = useState(0);
      const [pressed, setPressedState] = useState(false);
      rerenderParent = () => setTick((tick) => tick + 1);
      setPressed = setPressedState;
      return <PianoKey midi={69} noteName="A4" isPressed={pressed} onNoteOn={onNoteOn} onNoteOff={onNoteOff} />;
    }

    render(<Parent />);
    renders.count = 0;

    act(() => {
      for (let i = 0; i < 5; i += 1) rerenderParent();
    });
    expect(renders.count).toBe(0);

    act(() => setPressed(true));
    expect(renders.count).toBe(1);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });
});
