// src/components/PioneerItem.jsx
import { useId } from 'react';
import styles from './PioneerItem.module.css';

export default function PioneerItem({ id, name = 'Unknown', age = 0, iq = 0, onDelete }) {
  const headingId = useId();

  return (
    <li className={styles.item}>
      <article className={styles.card} aria-labelledby={headingId}>
        <h3 id={headingId} className={styles.name}>
          {name}
        </h3>
        <dl className={styles.stats}>
          <dt className={styles.statLabel}>IQ</dt>
          <dd className={styles.statValue}>{iq}</dd>
          <dt className={styles.statLabel}>Age</dt>
          <dd className={styles.statValue}>{age}</dd>
        </dl>
        <button
          className={styles.delete}
          type="button"
          aria-label={`Delete ${name}`}
          onClick={() => onDelete?.(id)}
        >
          Delete
        </button>
      </article>
    </li>
  );
}
