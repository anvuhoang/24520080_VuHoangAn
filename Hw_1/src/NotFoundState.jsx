// src/NotFoundState.jsx — the catch-all route.
import { Link } from 'react-router';
import styles from './NotFoundState.module.css';

export default function NotFoundState() {
  return (
    <main className={styles.page}>
      <section role="alert">
        <h1 className={styles.title}>Page not found</h1>
        <p className={styles.message}>This address does not match anything here.</p>
        <Link to="/gallery">Back to the gallery</Link>
      </section>
    </main>
  );
}
