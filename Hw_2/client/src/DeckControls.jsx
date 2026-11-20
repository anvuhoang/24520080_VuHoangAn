// client/src/DeckControls.jsx — buttons for everything the keys and the pointer do (a gesture alone fails WCAG 2.5.1).
// The key hints are aria-hidden (an arrow glyph is read as "rightwards arrow"); aria-keyshortcuts says the same in a way assistive technology understands.
// aria-disabled, not disabled: a disabled button drops keyboard focus, which would throw the user out of the deck.
import { LIKE, PASS, SUPER } from './deck.js';
import styles from './DeckControls.module.css';

export default function DeckControls({ hasCard, canUndo, busy, onSwipe, onUndo, onRestart }) {
  const block = (blocked, handler) => (blocked ? undefined : handler);
  const cardBlocked = !hasCard || busy;
  const undoBlocked = !canUndo || busy;
  return (
    <nav className={styles.controls} aria-label="Deck controls">
      <button type="button" className={styles.button} aria-keyshortcuts="ArrowLeft" aria-disabled={cardBlocked} onClick={block(cardBlocked, () => onSwipe(PASS))}>
        Pass <kbd className={styles.key} aria-hidden="true">←</kbd>
      </button>
      <button type="button" className={styles.buttonLike} aria-keyshortcuts="ArrowRight" aria-disabled={cardBlocked} onClick={block(cardBlocked, () => onSwipe(LIKE))}>
        Like <kbd className={styles.key} aria-hidden="true">→</kbd>
      </button>
      <button type="button" className={styles.button} aria-keyshortcuts="ArrowUp" aria-disabled={cardBlocked} onClick={block(cardBlocked, () => onSwipe(SUPER))}>
        Super like <kbd className={styles.key} aria-hidden="true">↑</kbd>
      </button>
      <button type="button" className={styles.button} aria-keyshortcuts="Backspace" aria-disabled={undoBlocked} onClick={block(undoBlocked, onUndo)}>
        Undo <kbd className={styles.key} aria-hidden="true">Backspace</kbd>
      </button>
      <button type="button" className={styles.restart} aria-disabled={busy} onClick={block(busy, onRestart)}>
        Start over
      </button>
    </nav>
  );
}
