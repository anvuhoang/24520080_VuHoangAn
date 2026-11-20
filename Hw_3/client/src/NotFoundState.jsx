// client/src/NotFoundState.jsx — an address or a player that does not exist. Never throws.
import { Link } from 'react-router';
import styles from './NotFoundState.module.css';

export default function NotFoundState({ title = 'Page not found', message = 'This address does not match anything here.', backTo = '/dossier', backLabel = 'Back to the dossiers', headingLevel = 2 }) {
  const Heading = `h${headingLevel}`;
  return (
    <section className={styles.box} role="alert">
      <Heading className={styles.title}>{title}</Heading>
      <p className={styles.message}>{message}</p>
      <Link to={backTo}>{backLabel}</Link>
    </section>
  );
}
