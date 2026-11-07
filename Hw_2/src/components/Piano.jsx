// src/components/Piano.jsx
import { KEYS } from '../music/keys.js';
import PianoKey from './PianoKey.jsx';
import styles from './Piano.module.css';

const NO_NOTES = new Set();

// Each black key sits in the cell of the white key before it, so no inline style is needed to
// place it. Built once from the generated key data: 52 cells, 36 of them with a black key.
const CELLS = (() => {
  const cells = [];
  for (const key of KEYS) {
    if (!key.isBlack) {
      cells.push({ white: key, black: null });
    } else if (cells.length > 0) {
      cells.at(-1).black = key;
    }
  }
  return Object.freeze(cells.map((cell) => Object.freeze(cell)));
})();

export default function Piano({ pressedNotes = NO_NOTES, onNoteOn, onNoteOff }) {
  return (
    <section className={styles.region} aria-label="Piano keyboard, 88 keys" tabIndex={0}>
      <ul className={styles.keys}>
        {CELLS.map(({ white, black }) => (
          <li key={white.midi} className={styles.cell}>
            <PianoKey
              midi={white.midi}
              noteName={white.noteName}
              isPressed={pressedNotes.has(white.midi)}
              onNoteOn={onNoteOn}
              onNoteOff={onNoteOff}
            />
            {black && (
              <PianoKey
                midi={black.midi}
                noteName={black.noteName}
                isBlack
                isPressed={pressedNotes.has(black.midi)}
                onNoteOn={onNoteOn}
                onNoteOff={onNoteOff}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
