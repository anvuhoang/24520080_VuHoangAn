// src/components/PianoKey.jsx
import { memo, useRef } from 'react';
import styles from './PianoKey.module.css';

const PRESS_CODES = new Set(['Enter', 'NumpadEnter', 'Space']);

const PianoKey = memo(function PianoKey({
  midi,
  noteName = '',
  isBlack = false,
  isPressed = false,
  onNoteOn,
  onNoteOff,
}) {
  // Which input started the note: 'pointer', 'keyboard' or null. Only that input may end it.
  const heldBy = useRef(null);

  const press = (source) => {
    if (heldBy.current) return;
    heldBy.current = source;
    onNoteOn?.(midi);
  };

  const release = (source) => {
    if (heldBy.current !== source) return;
    heldBy.current = null;
    onNoteOff?.(midi);
  };

  return (
    <button
      type="button"
      className={`${styles.key} ${isBlack ? styles.black : styles.white}`}
      aria-pressed={isPressed}
      onPointerDown={(event) => {
        if (event.button === 0) press('pointer');
      }}
      onPointerUp={() => release('pointer')}
      onPointerLeave={() => release('pointer')}
      onPointerCancel={() => release('pointer')}
      onKeyDown={(event) => {
        if (event.repeat || !PRESS_CODES.has(event.code)) return;
        event.preventDefault();
        press('keyboard');
      }}
      onKeyUp={(event) => {
        if (!PRESS_CODES.has(event.code)) return;
        event.preventDefault();
        release('keyboard');
      }}
      onBlur={() => release('keyboard')}
    >
      {noteName}
    </button>
  );
});

export default PianoKey;
