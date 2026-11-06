// src/components/HitLog.jsx
import { useId } from 'react';
import styles from './HitLog.module.css';

export default function HitLog({ hits = [], limit = 8 }) {
  const headingId = useId();

  const allHits = Array.isArray(hits) ? hits : [];
  const size = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;

  const latest = allHits.at(-1);
  // slice(-0) would return everything, so an empty history is handled explicitly
  const history = size === 0 ? [] : allHits.slice(-size).toReversed();

  return (
    <section className={styles.log} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Hit log
      </h2>

      {/* The only live region. Keying the text by the hit id replaces the node on every hit,
          so hitting the same pad twice is still announced. */}
      <output className={styles.last} aria-live="polite">
        {latest ? (
          <strong key={latest.id}>Last hit: {String(latest.label ?? '')}</strong>
        ) : (
          'No hits yet. Press W A S D J K L.'
        )}
      </output>

      {/* Plain list: not announced when it changes */}
      <ol className={styles.history} aria-label="Recent hits, newest first">
        {history.map((hit) => (
          <li key={hit.id} className={styles.row}>
            {String(hit.label ?? '')}
          </li>
        ))}
      </ol>
    </section>
  );
}
