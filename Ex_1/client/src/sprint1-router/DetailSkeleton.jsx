// client/src/sprint1-router/DetailSkeleton.jsx
import styles from './DetailSkeleton.module.css';

export default function DetailSkeleton({ label = 'Loading dossier…' }) {
  return (
    <section className={styles.skeleton} aria-busy="true" aria-live="polite" aria-label="Loading dossier">
      <p className={styles.label}>{label}</p>
    </section>
  );
}
