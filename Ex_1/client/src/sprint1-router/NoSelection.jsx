// client/src/sprint1-router/NoSelection.jsx
import styles from './PersonDetail.module.css';

export default function NoSelection({ message = 'Choose a person from the list to open the dossier.' }) {
  return (
    <section className={styles.card}>
      <h2 className={styles.name}>No person selected</h2>
      <p className={styles.hint}>{message}</p>
    </section>
  );
}
