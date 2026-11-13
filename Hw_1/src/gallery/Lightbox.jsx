// src/gallery/Lightbox.jsx — the photo viewer on the native <dialog>. The browser provides the focus trap, the Esc key,
// the inert page behind it and the top layer; the code only keeps it in step with the URL.
import { useId } from 'react';
import { Link, useNavigate } from 'react-router';
import { galleryQuery } from './galleryParams.js';
import { swapToFallback } from './photoImage.js';
import styles from './Lightbox.module.css';

// Module-level on purpose: React calls a ref callback again whenever its identity changes, which would close and
// reopen the dialog on every render. This one opens the dialog when it enters the page and closes it when it leaves,
// so the browser gives focus back to the thumbnail that opened it. (Calling showModal() on a dialog that is already
// modal is a no-op in current Chrome, but it throws on one opened without showModal(); the check keeps it explicit.)
function openModal(dialog) {
  if (dialog === null) return undefined;
  if (!dialog.open) dialog.showModal();
  return () => {
    if (dialog.open) dialog.close();
  };
}

export default function Lightbox({ photo, previous, next, category, onClose }) {
  const titleId = useId();
  const navigate = useNavigate();
  const to = (target) => ({ search: galleryQuery({ category, photoId: target.id }) });

  // The close event is queued, so a dialog that was closed and opened again in the same turn (Strict Mode
  // remounts refs in development) arrives here open: that is not the user closing it.
  const handleClose = (event) => {
    if (!event.currentTarget.open) onClose();
  };

  // A click on the backdrop lands on the dialog itself (the dialog has no padding), never on its content
  const handleClick = (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft' && previous) navigate(to(previous), { replace: true });
    if (event.key === 'ArrowRight' && next) navigate(to(next), { replace: true });
  };

  return (
    <dialog
      ref={openModal}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={handleClose}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <article className={styles.content}>
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {photo.title}
          </h2>
          <button type="button" className={styles.close} onClick={(e) => e.currentTarget.closest('dialog').close()}>
            Close
          </button>
        </header>
        <img
          className={styles.image}
          src={photo.src}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          onError={swapToFallback}
        />
        <p className={styles.caption}>
          {photo.caption} <time dateTime={photo.takenOn}>{photo.takenOn}</time>
        </p>
        {previous && next ? (
          <nav className={styles.pager} aria-label="Photo navigation">
            <Link className={styles.pagerLink} to={to(previous)} replace>
              Previous photo
            </Link>
            <Link className={styles.pagerLink} to={to(next)} replace>
              Next photo
            </Link>
          </nav>
        ) : null}
      </article>
    </dialog>
  );
}
