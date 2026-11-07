// tests/useDrumKeyboard.test.jsx
import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PAD_BY_CODE } from '../src/data/pads.js';
import { useDrumKeyboard } from '../src/hooks/useDrumKeyboard.js';

const setup = (initial = {}) => {
  const onPress = vi.fn();
  const onRelease = vi.fn();
  const view = renderHook(
    (props) => useDrumKeyboard(PAD_BY_CODE, props.handlers, props.isEnabled),
    { initialProps: { handlers: { onPress, onRelease }, isEnabled: true, ...initial } }
  );
  return { onPress, onRelease, ...view };
};

const keyDown = (code, init = {}, target = window) => fireEvent.keyDown(target, { code, ...init });
const keyUp = (code, target = window) => fireEvent.keyUp(target, { code });

describe('useDrumKeyboard', () => {
  it('reports the press and the release of a mapped key', () => {
    const { onPress, onRelease } = setup();

    keyDown('KeyA');
    expect(onPress).toHaveBeenCalledExactlyOnceWith('snare');

    keyUp('KeyA');
    expect(onRelease).toHaveBeenCalledExactlyOnceWith('snare');
  });

  it('uses the physical key code, so an IME that changes `key` cannot break it', () => {
    const { onPress } = setup();

    keyDown('KeyA', { key: 'ă' }); // Vietnamese IME (UniKey) composing a different character
    expect(onPress).toHaveBeenCalledWith('snare');

    onPress.mockClear();
    keyDown('KeyZ', { key: 'a' }); // right character, unmapped physical key
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not fire again while the key is held (auto-repeat)', () => {
    const { onPress } = setup();

    keyDown('KeyA');
    keyDown('KeyA', { repeat: true });
    keyDown('KeyA', { repeat: true });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('stays out of the way while the user types in a form field', () => {
    const { onPress } = setup();
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    document.body.append(input, textarea, select);

    for (const field of [input, textarea, select]) keyDown('KeyW', {}, field);

    expect(onPress).not.toHaveBeenCalled();
    input.remove();
    textarea.remove();
    select.remove();
  });

  it.each([['ctrlKey'], ['metaKey'], ['altKey']])('leaves browser shortcuts alone (%s)', (modifier) => {
    const { onPress } = setup();

    const notPrevented = keyDown('KeyW', { [modifier]: true });

    expect(onPress).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true); // true = default action was not prevented
  });

  it('prevents the default action only for a mapped key', () => {
    setup();

    expect(keyDown('KeyW')).toBe(false); // prevented
    expect(keyDown('KeyQ')).toBe(true);
    expect(keyDown('Space')).toBe(true);
  });

  it('can be switched off, and releases a pad that is still held at that moment', () => {
    const { onPress, onRelease, rerender } = setup();

    keyDown('KeyS');
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender({ handlers: { onPress, onRelease }, isEnabled: false });
    expect(onRelease).toHaveBeenCalledExactlyOnceWith('kick');

    keyDown('KeyS');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('releases held pads when the window loses focus, so none stays stuck', () => {
    const { onRelease } = setup();

    keyDown('KeyD');
    keyDown('KeyJ');
    fireEvent.blur(window);

    expect(onRelease.mock.calls.map(([id]) => id).sort()).toEqual(['hatClosed', 'tomLow']);
  });

  it('removes every listener it added when it unmounts', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount, onPress } = setup();

    const added = add.mock.calls.map(([type]) => type).filter((t) => ['keydown', 'keyup', 'blur'].includes(t));
    expect(added.sort()).toEqual(['blur', 'keydown', 'keyup']);

    unmount();
    const removed = remove.mock.calls.map(([type]) => type).filter((t) => ['keydown', 'keyup', 'blur'].includes(t));
    expect(removed.sort()).toEqual(['blur', 'keydown', 'keyup']);

    keyDown('KeyW');
    expect(onPress).not.toHaveBeenCalled();
  });

  it('calls the latest callbacks without re-attaching the listeners on every render', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = setup({ handlers: { onPress: first, onRelease: vi.fn() } });
    const keydownBefore = add.mock.calls.filter(([type]) => type === 'keydown').length;

    rerender({ handlers: { onPress: second, onRelease: vi.fn() }, isEnabled: true });
    keyDown('KeyK');

    expect(second).toHaveBeenCalledExactlyOnceWith('hatOpen');
    expect(first).not.toHaveBeenCalled();
    expect(add.mock.calls.filter(([type]) => type === 'keydown').length).toBe(keydownBefore);
  });

  // Audit #01: the hook ignores every <input>, so a checkbox that has focus swallows the pad keys.
  // Only fields where text is typed should block them. Change `it.fails` to `it` once this is fixed.
  it.fails('still plays while a checkbox has focus (known defect)', () => {
    const { onPress } = setup();
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    document.body.append(checkbox);

    keyDown('KeyW', {}, checkbox);

    expect(onPress).toHaveBeenCalledWith('tomHigh');
    checkbox.remove();
  });
});
