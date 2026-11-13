// src/components/AppNav.jsx
import { NavLink } from 'react-router';
import styles from './AppNav.module.css';

const SECTIONS = Object.freeze([
  Object.freeze({ to: '/people', label: 'People' }),
  Object.freeze({ to: '/form', label: 'Form' }),
  Object.freeze({ to: '/forum', label: 'Forum' }),
]);

export default function AppNav({ sections = SECTIONS }) {
  return (
    <nav aria-label="Main">
      <ul className={styles.list}>
        {sections.map((section) => (
          <li key={section.to}>
            <NavLink
              to={section.to}
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
            >
              {section.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
