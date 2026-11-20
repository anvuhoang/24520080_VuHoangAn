// client/src/SwipeDeck.jsx — the page: one focusable deck that listens to the keys, a card that listens to the pointer,
// buttons for the same actions, and the numbers. All state is in useDeck; the score is derived from the history.
import { actionForKey } from './deck.js';
import DeckControls from './DeckControls.jsx';
import ScoreBoard from './ScoreBoard.jsx';
import SwipeCard from './SwipeCard.jsx';
import { useDeck } from './useDeck.js';
import styles from './SwipeDeck.module.css';

export default function SwipeDeck() {
  const deck = useDeck();

  const handleKeyDown = (event) => {
    // Alt+Left is the browser's Back, Ctrl/Cmd+Left moves the text cursor: those chords are not ours.
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const isUndo = event.key === 'Backspace';
    const action = actionForKey(event.key);
    if (!isUndo && action === null) return;
    event.preventDefault(); // the arrows scroll the page and Backspace may go back
    if (event.repeat) return; // a held key is one swipe, not a flood of them
    if (isUndo) deck.undo();
    else deck.swipe(action);
  };

  if (deck.status === 'loading') {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Swipe Deck</h1>
        <p className={styles.loading} role="status" aria-busy="true">
          Loading the deck…
        </p>
      </main>
    );
  }

  if (deck.status === 'error') {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Swipe Deck</h1>
        <section className={styles.error} role="alert">
          <p className={styles.errorText}>{deck.error}</p>
          <button type="button" className={styles.retry} onClick={deck.retry}>
            Try again
          </button>
        </section>
      </main>
    );
  }

  const remaining = deck.profiles.length - deck.history.length;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Swipe Deck</h1>
      <p className={styles.hint}>
        Click the card, then use ← to pass, → to like, ↑ to super like and Backspace to undo. Drag works too, and so do the buttons.
      </p>
      <section
        className={styles.deck}
        tabIndex={0}
        aria-label="Swipe deck"
        onKeyDown={handleKeyDown}
      >
        {deck.current ? (
          <SwipeCard key={deck.current.id} profile={deck.current} onSwipe={deck.swipe} disabled={deck.busy} />
        ) : (
          <article className={styles.empty}>
            <h2 className={styles.emptyTitle}>No more cards</h2>
            <p className={styles.emptyText}>
              You went through all {deck.profiles.length} profiles. Final score: {deck.stats.score}.
            </p>
          </article>
        )}
      </section>
      <aside className={styles.side} aria-label="Score and controls">
        <ScoreBoard stats={deck.stats} remaining={remaining} />
        <DeckControls
          hasCard={deck.current !== null}
          canUndo={deck.history.length > 0}
          busy={deck.busy}
          onSwipe={deck.swipe}
          onUndo={deck.undo}
          onRestart={deck.restart}
        />
      </aside>
      <p className={styles.notice} role="status">
        {deck.notice}
      </p>
    </main>
  );
}
