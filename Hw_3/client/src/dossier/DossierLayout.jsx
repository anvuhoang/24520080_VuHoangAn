// client/src/dossier/DossierLayout.jsx — the nested layout: title, player links, and <Outlet/> for the page of the route.
import { NavLink, Outlet } from 'react-router';
import { useDossiers } from './useDossiers.js';
import styles from './DossierLayout.module.css';

export default function DossierLayout() {
  const { status, dossiers, error, retry } = useDossiers();

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Fair-Play Appeal Tribunal</h1>

      {status === 'loading' ? (
        <p className={styles.loading} role="status" aria-busy="true">
          Loading the dossiers…
        </p>
      ) : null}

      {status === 'error' ? (
        <section className={styles.error} role="alert">
          <p className={styles.errorText}>{error}</p>
          <button type="button" className={styles.retry} onClick={retry}>
            Try again
          </button>
        </section>
      ) : null}

      {status === 'success' ? (
        <>
          <nav aria-label="Players">
            <ul className={styles.players}>
              {dossiers.map((dossier) => (
                <li key={dossier.playerId}>
                  <NavLink to={`/dossier/${dossier.playerId}`} className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}>
                    {dossier.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <Outlet context={{ dossiers }} />
        </>
      ) : null}
    </main>
  );
}
