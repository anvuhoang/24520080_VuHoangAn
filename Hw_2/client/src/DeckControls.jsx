// client/src/DeckControls.jsx — buttons for everything the keys and the pointer do (a gesture alone fails WCAG 2.5.1).
// aria-disabled, not disabled: a disabled button drops keyboard focus, which would throw the user out of the deck.
import { LIKE, PASS, SUPER } from './deck.js';
import styles from './DeckControls.module.css';

export default function DeckControls({ hasCard, canUndo, busy, onSwipe, onUndo, onRestart }) {
  const block = (blocked, handler) => (blocked ? undefined : handler);
  const cardBlocked = !hasCard || busy;
  const undoBlocked = !canUndo || busy;
  return (
    <nav className={styles.controls} aria-label="Deck controls">
      <button type="button" className={styles.button} aria-disabled={cardBlocked} onClick={block(cardBlocked, () => onSwipe(PASS))}>
        Pass <kbd className={styles.key}>←</kbd>
      </button>
      <button type="button" className={styles.buttonLike} aria-disabled={cardBlocked} onClick={block(cardBlocked, () => onSwipe(LIKE))}>
        Like <kbd className={styles.key}>→</kbd>
      </button>
      <button type="button" className={styles.button} aria-disabled={cardBlocked} onClick={block(cardBlocked, () => onSwipe(SUPER))}>
        Super like <kbd className={styles.key}>↑</kbd>
      </button>
      <button type="button" className={styles.button} aria-disabled={undoBlocked} onClick={block(undoBlocked, onUndo)}>
        Undo <kbd className={styles.key}>Backspace</kbd>
      </button>
      <button type="button" className={styles.restart} aria-disabled={busy} onClick={block(busy, onRestart)}>
        Start over
      </button>
    </nav>
  );
}
