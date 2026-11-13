// src/components/PeopleLayout.jsx
import { NavLink, Outlet } from 'react-router';
import { PEOPLE } from '../data/people.js';
import styles from './PeopleLayout.module.css';

export default function PeopleLayout({ people = PEOPLE }) {
  return (
    <section className={styles.frame} aria-label="People directory">
      <nav className={styles.sidebar} aria-label="People">
        <ul className={styles.list}>
          {people.map((person) => (
            <li key={person.id}>
              <NavLink
                to={`/people/${person.id}`}
                className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
              >
                {person.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <section className={styles.content} aria-label="Dossier">
        <Outlet />
      </section>
    </section>
  );
}
