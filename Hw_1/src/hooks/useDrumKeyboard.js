// src/hooks/useDrumKeyboard.js
import { useEffect, useRef } from 'react';

const FORM_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

const isFormField = (target) =>
  target instanceof HTMLElement && (FORM_TAGS.has(target.tagName) || target.isContentEditable);

export function useDrumKeyboard(padMap, { onPress, onRelease } = {}, isEnabled = true) {
  // Always call the latest callbacks without re-subscribing the listeners on every render
  const handlers = useRef({ onPress, onRelease });
  useEffect(() => {
    handlers.current = { onPress, onRelease };
  });

  // Pads currently held down, so they can be released if the window loses focus
  const held = useRef(new Set());

  useEffect(() => {
    if (!isEnabled) return undefined;

    const heldNow = held.current;

    const release = (pad) => {
      if (!heldNow.delete(pad.id)) return;
      handlers.current.onRelease?.(pad.id);
    };

    const releaseAll = () => {
      for (const pad of padMap.values()) release(pad);
    };

    const handleKeyDown = (event) => {
      if (event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isFormField(event.target)) return;

      const pad = padMap.get(event.code);
      if (!pad) return;

      event.preventDefault();
      heldNow.add(pad.id);
      handlers.current.onPress?.(pad.id);
    };

    const handleKeyUp = (event) => {
      const pad = padMap.get(event.code);
      if (pad) release(pad);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', releaseAll);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', releaseAll);
      releaseAll();
    };
  }, [padMap, isEnabled]);
}
