// src/gallery/CategoryFilter.jsx — category links. Each one is a real link, so the filter can be shared and opened in a new tab.
import { Link } from 'react-router';
import { CATEGORIES } from './photos.js';
import { ALL, galleryQuery } from './galleryParams.js';
import styles from './CategoryFilter.module.css';

const OPTIONS = [{ id: ALL, label: 'All' }, ...CATEGORIES];

export default function CategoryFilter({ category }) {
  return (
    <nav aria-label="Photo categories">
      <ul className={styles.list}>
        {OPTIONS.map((option) => (
          <li key={option.id}>
            <Link
              className={styles.link}
              to={{ search: galleryQuery({ category: option.id }) }}
              aria-current={option.id === category ? 'true' : undefined}
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
