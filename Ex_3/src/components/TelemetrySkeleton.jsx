// src/components/TelemetrySkeleton.jsx
import styles from './TelemetrySkeleton.module.css';

// Stable ids for the placeholder bars (never use the array index as a key)
const BAR_IDS = ['bar-name', 'bar-status', 'bar-stats-1', 'bar-stats-2'];

export default function TelemetrySkeleton({ label = 'Syncing KRAFTON radar…' }) {
  return (
    <section aria-busy="true" className={styles.skeleton}>
      <p className={styles.label}>{label}</p>
      <ul aria-hidden="true">
        {BAR_IDS.map((id) => (
          <li key={id} className={styles.bar} />
        ))}
      </ul>
    </section>
  );
}
