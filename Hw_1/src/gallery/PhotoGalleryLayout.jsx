// src/gallery/PhotoGalleryLayout.jsx — the gallery page. Category and open photo are read from the URL on every render;
// there is no state copy and no effect, so a shared link, a reload and the Back button all give the same page.
import { Link, useSearchParams } from 'react-router';
import CategoryFilter from './CategoryFilter.jsx';
import PhotoGrid from './PhotoGrid.jsx';
import Lightbox from './Lightbox.jsx';
import { PHOTOS, CATEGORIES } from './photos.js';
import { ALL, galleryQuery, neighbours, parseGalleryParams, photosOf } from './galleryParams.js';
import styles from './PhotoGalleryLayout.module.css';

export default function PhotoGalleryLayout({ photos = PHOTOS }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { category, photoId } = parseGalleryParams(searchParams);

  const visible = photosOf(photos, category);
  const selectedIndex = photoId === null ? -1 : visible.findIndex((p) => p.id === photoId);
  const selected = selectedIndex === -1 ? null : visible[selectedIndex];
  const { previous, next } = neighbours(visible, selectedIndex);
  const missing = photoId !== null && selected === null;

  const categoryLabel = category === ALL ? null : CATEGORIES.find((c) => c.id === category).label;

  // Closing removes only photoId (the slide's close handler resets all parameters, which also drops the category) and replaces the
  // entry, so the history does not grow with every open and close.
  const closeLightbox = () =>
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.delete('photoId');
        return params;
      },
      { replace: true }
    );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Evidence Gallery</h1>
        <CategoryFilter category={category} />
        <p className={styles.count} role="status">
          {visible.length} {visible.length === 1 ? 'photo' : 'photos'}
          {categoryLabel ? ` in ${categoryLabel}` : ''}
        </p>
      </header>

      {missing ? (
        <p className={styles.missing} role="alert">
          Photo “{photoId}” is not in this view.{' '}
          <Link to={{ search: galleryQuery({ category }) }}>Close this message</Link>
        </p>
      ) : null}

      <PhotoGrid photos={visible} category={category} />

      {selected ? (
        <Lightbox photo={selected} previous={previous} next={next} category={category} onClose={closeLightbox} />
      ) : null}
    </main>
  );
}
