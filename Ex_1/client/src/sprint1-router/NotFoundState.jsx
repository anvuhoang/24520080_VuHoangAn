// client/src/sprint1-router/NotFoundState.jsx
import { Link } from 'react-router';
import styles from './NotFoundState.module.css';

export default function NotFoundState({
  title = 'Page not found',
  message = 'This address does not match anything here.',
  backTo = '/people',
  backLabel = 'Back to the directory',
}) {
  return (
    <section className={styles.notFound} role="alert">
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      <Link className={styles.back} to={backTo}>
        {backLabel}
      </Link>
    </section>
  );
}
