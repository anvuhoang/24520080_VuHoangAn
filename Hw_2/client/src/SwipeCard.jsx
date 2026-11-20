// client/src/SwipeCard.jsx — the card on top. It turns a pointer drag into an action; keys and buttons are handled one level up.
import { useRef } from 'react';
import { actionForGesture } from './deck.js';
import styles from './SwipeCard.module.css';

export default function SwipeCard({ profile, onSwipe, disabled = false }) {
  // Where the pointer went down. A ref, not state: nothing on screen depends on it, and it must not cause a render.
  const start = useRef(null);

  const handlePointerDown = (event) => {
    if (disabled || !event.isPrimary || event.button !== 0) return; // one finger, the main button
    start.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    if (typeof event.currentTarget.setPointerCapture === 'function') event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event) => {
    const from = start.current;
    start.current = null;
    if (from === null || from.id !== event.pointerId) return; // an "up" that never had its "down" is nothing
    const action = actionForGesture(event.clientX - from.x, event.clientY - from.y);
    if (action !== null) onSwipe(action);
  };

  const handlePointerCancel = () => {
    start.current = null; // the browser took the gesture (a scroll, a call): forget it
  };

  return (
    <article
      className={styles.card}
      aria-label={`${profile.name}, ${profile.age}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <p className={styles.initials} aria-hidden="true">
        {profile.name
          .split(' ')
          .map((part) => part[0])
          .join('')}
      </p>
      <h2 className={styles.name}>
        {profile.name}, {profile.age}
      </h2>
      <p className={styles.bio}>{profile.bio}</p>
    </article>
  );
}
