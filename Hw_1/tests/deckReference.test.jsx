// tests/deckReference.test.jsx — the slide 30 code, copied as written, to show where it fails.
// The same two behaviours were measured in Chrome 157 with React Strict Mode (docs/AI_FAILURE_AUDIT.md, entry 01 and 02).
import { useEffect, useRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate, useSearchParams } from 'react-router';
import { describe, expect, it } from 'vitest';

// --- slide 30, as written (the Close button, the <p> and the probe are only scaffolding) ---
function SlidePhotoGalleryLayout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPhotoId = searchParams.get('photoId');
  const dialogRef = useRef(null);
  useEffect(() => {
    if (selectedPhotoId) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [selectedPhotoId]);
  return (
    <dialog ref={dialogRef} onClose={() => setSearchParams({})}>
      <p>photo {selectedPhotoId}</p>
      <button type="button" onClick={() => dialogRef.current.close()}>
        Close
      </button>
    </dialog>
  );
}
// ------------------------------------------------------------------------------------------------

function Probe() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <code data-testid="url">{pathname + search}</code>
      <button type="button" onClick={() => navigate(-1)}>
        history back
      </button>
    </>
  );
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)));
const url = () => screen.getByTestId('url').textContent;

describe('slide 30 reference code', () => {
  it('loses the category filter when the lightbox is closed (setSearchParams({}) clears every parameter)', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/gallery?category=chat&photoId=1']}>
        <SlidePhotoGalleryLayout />
        <Probe />
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(url()).toBe('/gallery')); // the category=chat filter is gone: the user lands on "all"
  });

  it('Back to the grid still writes to the URL (the late close event pushes an entry without the category)', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/gallery?category=chat', '/gallery?category=chat&photoId=1']} initialIndex={1}>
        <SlidePhotoGalleryLayout />
        <Probe />
      </MemoryRouter>
    );
    // Back to the grid: the URL has no photoId, the effect closes the dialog, and its onClose writes to the URL
    await user.click(screen.getByRole('button', { name: 'history back' }));
    await settle();
    // the URL should be '/gallery?category=chat'; the late close event pushed a new entry that dropped the category
    expect(url()).toBe('/gallery');
  });

  it('a click on the backdrop does nothing (no backdrop handling at all)', () => {
    render(
      <MemoryRouter initialEntries={['/gallery?category=chat&photoId=1']}>
        <SlidePhotoGalleryLayout />
        <Probe />
      </MemoryRouter>
    );
    fireEvent.click(document.querySelector('dialog'));
    expect(url()).toBe('/gallery?category=chat&photoId=1'); // the backdrop does nothing
  });
});
