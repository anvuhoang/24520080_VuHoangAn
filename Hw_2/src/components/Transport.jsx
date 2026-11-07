// src/components/Transport.jsx
import { useId } from 'react';
import styles from './Transport.module.css';

const SPEEDS = Object.freeze([
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
]);

const pluralNotes = (count) => `${count} ${count === 1 ? 'note' : 'notes'}`;

// The message is derived from the props. While recording it does not count the notes, so the
// live region is not read out for every key that is played.
function getStatus(mode, eventCount, speed) {
  if (mode === 'recording') return 'Recording. Play some keys, then press Stop.';
  if (mode === 'playing') return `Playing ${pluralNotes(eventCount)} at ${speed}x.`;
  if (eventCount === 0) return 'Ready. Press Record, then play some keys.';
  return `${pluralNotes(eventCount)} recorded. Press Play to hear them.`;
}

export default function Transport({
  mode = 'idle',
  eventCount = 0,
  speed = 1,
  onRecord,
  onPlay,
  onStop,
  onSpeedChange,
}) {
  const speedId = useId();

  const state = mode === 'recording' || mode === 'playing' ? mode : 'idle';
  const count = Number.isInteger(eventCount) && eventCount > 0 ? eventCount : 0;
  const selectedSpeed = SPEEDS.some((option) => option.value === speed) ? speed : 1;
  const busy = state !== 'idle';

  return (
    <fieldset className={styles.transport}>
      <legend className={styles.legend}>Recorder</legend>

      <button className={styles.button} type="button" disabled={busy} onClick={() => onRecord?.()}>
        Record
      </button>
      <button
        className={styles.button}
        type="button"
        disabled={busy || count === 0}
        onClick={() => onPlay?.()}
      >
        Play
      </button>
      <button className={styles.button} type="button" disabled={!busy} onClick={() => onStop?.()}>
        Stop
      </button>

      <p className={styles.field}>
        <label htmlFor={speedId}>Speed</label>
        <select
          id={speedId}
          className={styles.select}
          value={selectedSpeed}
          disabled={state === 'playing'}
          onChange={(event) => onSpeedChange?.(Number(event.target.value))}
        >
          {SPEEDS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </p>

      <output className={styles.status} aria-live="polite">
        {getStatus(state, count, selectedSpeed)}
      </output>
    </fieldset>
  );
}
