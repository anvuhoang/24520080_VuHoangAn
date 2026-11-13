// src/gallery/galleryParams.js — the URL is the state of the gallery. Pure helpers, no React.
import { CATEGORIES } from './photos.js';

export const ALL = 'all';

// ?category=<id>&photoId=<id>. An unknown category falls back to "all"; photoId is returned as written (or null)
// so that the page can say a photo is missing instead of hiding it.
export function parseGalleryParams(searchParams) {
  const rawCategory = searchParams.get('category');
  const category = CATEGORIES.some((c) => c.id === rawCategory) ? rawCategory : ALL;
  const rawPhotoId = searchParams.get('photoId');
  return { category, photoId: rawPhotoId === null || rawPhotoId === '' ? null : rawPhotoId };
}

// The search string (without "?") for a link; "all" and a missing photo leave the URL clean.
export function galleryQuery({ category = ALL, photoId = null } = {}) {
  const params = new URLSearchParams();
  if (category !== ALL) params.set('category', category);
  if (photoId !== null) params.set('photoId', photoId);
  return params.toString();
}

// The photos of one category, in data order.
export function photosOf(photos, category) {
  return category === ALL ? photos : photos.filter((p) => p.category === category);
}

// Neighbours of a photo inside the visible list; they wrap around, so the lightbox never has a dead end.
export function neighbours(list, index) {
  if (index < 0 || list.length === 0) return { previous: null, next: null };
  return {
    previous: list[(index - 1 + list.length) % list.length],
    next: list[(index + 1) % list.length],
  };
}
