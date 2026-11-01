// src/components/TelemetryCard.jsx
import { Fragment, useId } from 'react';
import styles from './TelemetryCard.module.css';

const text = (value) => String(value ?? '');

export default function TelemetryCard({ squad }) {
  const headingId = useId();
  const { name, status, map, phase, alive, kills, wwcdProb } = squad ?? {};

  const stats = {
    Map: text(map),
    Phase: text(phase),
    Alive: text(alive),
    Kills: text(kills),
    'Win chance': text(wwcdProb),
  };

  return (
    <article className={styles.card} aria-labelledby={headingId}>
      <header className={styles.header}>
        <h3 id={headingId} className={styles.name}>
          {text(name)}
        </h3>
        <p className={styles.status}>{text(status)}</p>
      </header>

      <dl className={styles.stats}>
        {Object.entries(stats).map(([label, value]) => (
          <Fragment key={label}>
            <dt className={styles.label}>{label}</dt>
            <dd className={styles.value}>{value}</dd>
          </Fragment>
        ))}
      </dl>
    </article>
  );
}
