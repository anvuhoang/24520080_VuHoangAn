// src/gallery/PhotoGrid.jsx — thumbnails. Each one is a link to ?photoId=…, so opening a photo is a normal navigation.
import { Link } from 'react-router';
import { CATEGORIES } from './photos.js';
import { galleryQuery } from './galleryParams.js';
import { swapToFallback } from './photoImage.js';
import styles from './PhotoGrid.module.css';

const LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const EAGER_COUNT = 3; // the first row is in view at load; the rest waits until it is near

export default function PhotoGrid({ photos, category }) {
  return (
    <ul className={styles.grid}>
      {photos.map((photo, index) => (
        <li key={photo.id}>
          <Link className={styles.card} to={{ search: galleryQuery({ category, photoId: photo.id }) }}>
            <figure className={styles.figure}>
              <img
                className={styles.image}
                src={photo.src}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                loading={index < EAGER_COUNT ? 'eager' : 'lazy'}
                decoding="async"
                onError={swapToFallback}
              />
              <figcaption className={styles.caption}>
                <strong className={styles.title}>{photo.title}</strong>
                <small className={styles.meta}>{LABELS[photo.category]}</small>
              </figcaption>
            </figure>
          </Link>
        </li>
      ))}
    </ul>
  );
}
