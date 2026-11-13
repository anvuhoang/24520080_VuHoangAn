// tests/PhotoGalleryLayout.test.jsx — the gallery page driven by the URL, with the real router.
import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import PhotoGalleryLayout from '../src/gallery/PhotoGalleryLayout.jsx';

function Probe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <code data-testid="url">{location.pathname + location.search}</code>
      <button type="button" onClick={() => navigate(-1)}>
        history back
      </button>
    </>
  );
}

function renderAt(entries, { strict = false, index } = {}) {
  const tree = (
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      <Routes>
        <Route path="/gallery" element={<PhotoGalleryLayout />} />
      </Routes>
      <Probe />
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

const url = () => screen.getByTestId('url').textContent;
const dialog = () => document.querySelector('dialog');
// The close event is a queued task; wait for it like the browser does
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)));

describe('grid and filter', () => {
  it('shows every photo, the filter and the count', () => {
    renderAt(['/gallery']);
    expect(screen.getByRole('heading', { level: 1, name: 'Evidence Gallery' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Photo categories' })).getAllByRole('link')).toHaveLength(4);
    expect(screen.getByRole('status')).toHaveTextContent('9 photos');
    expect(screen.getAllByRole('img')).toHaveLength(9);
    expect(dialog()).toBeNull();
  });

  it('reads the category from the URL', () => {
    renderAt(['/gallery?category=chat']);
    expect(screen.getByRole('status')).toHaveTextContent('3 photos in Chat');
    expect(screen.getByRole('link', { name: 'Chat' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'All' })).not.toHaveAttribute('aria-current');
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.queryByText('Round 1 scoreboard')).toBeNull();
  });

  it('shows everything when the category in the URL is unknown', () => {
    renderAt(['/gallery?category=nope']);
    expect(screen.getAllByRole('img')).toHaveLength(9);
    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'true');
  });

  it('clicking a category writes it to the URL and clears any open photo', async () => {
    renderAt(['/gallery?photoId=m1']);
    fireEvent.click(screen.getByRole('link', { name: 'Replay' }));
    expect(url()).toBe('/gallery?category=replay');
    await settle();
    expect(dialog()).toBeNull();
  });

  it('"All" removes the category from the URL', async () => {
    const user = userEvent.setup();
    renderAt(['/gallery?category=chat']);
    await user.click(screen.getByRole('link', { name: 'All' }));
    expect(url()).toBe('/gallery');
  });

  it('a thumbnail links to its photo and keeps the category', () => {
    renderAt(['/gallery?category=replay']);
    const link = screen.getByRole('link', { name: /Replay at the disputed moment/ });
    expect(link).toHaveAttribute('href', '/gallery?category=replay&photoId=r2');
  });

  it('a thumbnail in "all" links without a category', () => {
    renderAt(['/gallery']);
    expect(screen.getByRole('link', { name: /Final scoreboard/ })).toHaveAttribute('href', '/gallery?photoId=m2');
  });

  it('loads the first row eagerly and the rest lazily, every image with its size and an alt', () => {
    renderAt(['/gallery']);
    const images = screen.getAllByRole('img');
    images.forEach((img, i) => {
      expect(img).toHaveAttribute('width', '1200');
      expect(img).toHaveAttribute('height', '800');
      expect(img.getAttribute('alt').length).toBeGreaterThan(15);
      expect(img).toHaveAttribute('loading', i < 3 ? 'eager' : 'lazy');
    });
  });

  it('swaps a broken image to the local fallback once, never in a loop', () => {
    renderAt(['/gallery']);
    const img = screen.getAllByRole('img')[0];
    fireEvent.error(img);
    expect(img.getAttribute('src')).toBe('/photos/fallback.svg');
    img.setAttribute('src', '/photos/other.svg'); // if the fallback failed too, the handler must not touch it again
    fireEvent.error(img);
    expect(img.getAttribute('src')).toBe('/photos/other.svg');
  });
});

describe('lightbox from the URL', () => {
  it('opens as a modal dialog for ?photoId, named by the photo title', () => {
    renderAt(['/gallery?photoId=m2']);
    expect(dialog()).toHaveAttribute('open');
    expect(screen.getByRole('dialog', { name: 'Final scoreboard' })).toBeInTheDocument();
    expect(within(dialog()).getByRole('img')).toHaveAttribute('src', '/photos/m2.svg');
    expect(within(dialog()).getByText('2026-03-14').tagName).toBe('TIME');
  });

  it('opens when a thumbnail is clicked and the URL gets the id (a new history entry)', async () => {
    const user = userEvent.setup();
    renderAt(['/gallery']);
    await user.click(screen.getByRole('link', { name: /Post-match chat/ }));
    expect(url()).toBe('/gallery?photoId=c3');
    expect(screen.getByRole('dialog', { name: 'Post-match chat' })).toBeInTheDocument();
  });

  it('reports an unknown photo with an alert instead of a silent empty page, and no dialog', () => {
    renderAt(['/gallery?photoId=zzz']);
    expect(screen.getByRole('alert')).toHaveTextContent('Photo “zzz” is not in this view.');
    expect(dialog()).toBeNull();
    expect(screen.getAllByRole('img')).toHaveLength(9);
  });

  it('treats a photo outside the chosen category as missing', () => {
    renderAt(['/gallery?category=chat&photoId=m1']);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(dialog()).toBeNull();
  });

  it('the alert link clears the id and keeps the category', async () => {
    const user = userEvent.setup();
    renderAt(['/gallery?category=chat&photoId=m1']);
    await user.click(screen.getByRole('link', { name: 'Close this message' }));
    expect(url()).toBe('/gallery?category=chat');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('an id with markup in it is shown as text', () => {
    renderAt([`/gallery?photoId=${encodeURIComponent('<img src=x onerror=alert(1)>')}`]);
    expect(screen.getByRole('alert')).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(document.querySelector('[onerror]')).toBeNull();
  });
});

describe('count', () => {
  const one = [{ id: 'only', category: 'match', title: 'Only', alt: 'The only photo in this set', caption: 'x', takenOn: '2026-01-01', src: '/photos/m1.svg', width: 1200, height: 800 }];
  it('says "1 photo", not "1 photos"', () => {
    render(
      <MemoryRouter initialEntries={['/gallery']}>
        <PhotoGalleryLayout photos={one} />
      </MemoryRouter>
    );
    expect(screen.getByRole('status')).toHaveTextContent(/^1 photo$/);
  });
  it('says "0 photos" for a category with nothing in it', () => {
    render(
      <MemoryRouter initialEntries={['/gallery?category=chat']}>
        <PhotoGalleryLayout photos={one} />
      </MemoryRouter>
    );
    expect(screen.getByRole('status')).toHaveTextContent('0 photos in Chat');
  });
});

describe('closing', () => {
  it('the Close button closes the dialog and removes only photoId', async () => {
    const user = userEvent.setup();
    renderAt(['/gallery?category=match&photoId=m1']);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(url()).toBe('/gallery?category=match'));
    expect(dialog()).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('3 photos in Match');
  });

  it('Esc (the browser closes the dialog itself) is handled like the Close button', async () => {
    renderAt(['/gallery?category=replay&photoId=r1']);
    act(() => dialog().close());
    await waitFor(() => expect(url()).toBe('/gallery?category=replay'));
    expect(dialog()).toBeNull();
  });

  it('a click on the backdrop closes it; a click on the picture does not', async () => {
    renderAt(['/gallery?photoId=m1']);
    fireEvent.click(within(dialog()).getByRole('img'));
    await settle();
    expect(url()).toBe('/gallery?photoId=m1');
    fireEvent.click(dialog());
    await waitFor(() => expect(url()).toBe('/gallery'));
  });

  it('closing replaces the history entry instead of adding one', async () => {
    const user = userEvent.setup();
    renderAt(['/gallery', '/gallery?photoId=m1'], { index: 1 });
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(url()).toBe('/gallery'));
    await user.click(screen.getByRole('button', { name: 'history back' }));
    expect(url()).toBe('/gallery'); // there is nothing before the first entry; no extra "closed" entry was added
  });

  it('the Back button closes the lightbox and does not leave a stale dialog or push a new entry', async () => {
    const user = userEvent.setup();
    renderAt(['/gallery', '/gallery?photoId=m1'], { index: 1 });
    expect(dialog()).toHaveAttribute('open');
    await user.click(screen.getByRole('button', { name: 'history back' }));
    expect(url()).toBe('/gallery');
    await settle();
    expect(dialog()).toBeNull();
    expect(url()).toBe('/gallery'); // the late close event did not write to the URL
  });
});

describe('browsing inside the lightbox', () => {
  it('Next and Previous stay inside the chosen category and wrap around', () => {
    renderAt(['/gallery?category=match&photoId=m3']);
    expect(screen.getByRole('link', { name: 'Next photo' })).toHaveAttribute('href', '/gallery?category=match&photoId=m1');
    expect(screen.getByRole('link', { name: 'Previous photo' })).toHaveAttribute('href', '/gallery?category=match&photoId=m2');
  });

  it('moving to the next photo replaces the entry, so Back leaves the lightbox in one step', async () => {
    const user = userEvent.setup();
    renderAt(['/gallery', '/gallery?photoId=m1'], { index: 1 });
    await user.click(screen.getByRole('link', { name: 'Next photo' }));
    expect(url()).toBe('/gallery?photoId=m2');
    expect(screen.getByRole('dialog', { name: 'Final scoreboard' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'history back' }));
    expect(url()).toBe('/gallery');
  });

  it('the arrow keys move between photos', () => {
    renderAt(['/gallery?photoId=m1']);
    fireEvent.keyDown(dialog(), { key: 'ArrowRight' });
    expect(url()).toBe('/gallery?photoId=m2');
    fireEvent.keyDown(dialog(), { key: 'ArrowLeft' });
    expect(url()).toBe('/gallery?photoId=m1');
    fireEvent.keyDown(dialog(), { key: 'ArrowLeft' });
    expect(url()).toBe('/gallery?photoId=r3'); // wraps over the whole list
  });

  it('keeps the same dialog open while moving (showModal is called once)', () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    renderAt(['/gallery?photoId=m1']);
    const first = dialog();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(dialog()).toBe(first);
    expect(showModal).toHaveBeenCalledTimes(1);
  });

  it('arrow navigation replaces the entry in both directions', async () => {
    const user = userEvent.setup();
    renderAt(['/gallery', '/gallery?photoId=m1'], { index: 1 });
    fireEvent.keyDown(dialog(), { key: 'ArrowRight' });
    fireEvent.keyDown(dialog(), { key: 'ArrowRight' });
    fireEvent.keyDown(dialog(), { key: 'ArrowLeft' });
    expect(url()).toBe('/gallery?photoId=m2');
    await user.click(screen.getByRole('button', { name: 'history back' }));
    expect(url()).toBe('/gallery');
  });

  it('closes the native dialog when it leaves the page (so the browser returns focus to the opener)', async () => {
    const user = userEvent.setup();
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close');
    renderAt(['/gallery', '/gallery?photoId=m1'], { index: 1 });
    await user.click(screen.getByRole('button', { name: 'history back' }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('a one-photo set: the pager points at the same photo, nothing breaks', () => {
    render(
      <MemoryRouter initialEntries={['/gallery?photoId=only']}>
        <PhotoGalleryLayout
          photos={[{ id: 'only', category: 'match', title: 'Only', alt: 'The only photo in this set', caption: 'x', takenOn: '2026-01-01', src: '/photos/m1.svg', width: 1200, height: 800 }]}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Next photo' })).toHaveAttribute('href', '/gallery?photoId=only');
  });
});

describe('Strict Mode', () => {
  it('opens once, does not throw, and the remount does not close the lightbox through the URL', async () => {
    renderAt(['/gallery?category=chat&photoId=c1'], { strict: true });
    await settle();
    expect(dialog()).toHaveAttribute('open');
    expect(url()).toBe('/gallery?category=chat&photoId=c1');
  });

  it('a user close still works under Strict Mode', async () => {
    const user = userEvent.setup();
    renderAt(['/gallery?photoId=c1'], { strict: true });
    await settle();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(url()).toBe('/gallery'));
  });
});
