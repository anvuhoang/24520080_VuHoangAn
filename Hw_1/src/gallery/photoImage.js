// src/gallery/photoImage.js — what an <img> does when its file is missing or fails to load.

export const FALLBACK_SRC = '/photos/fallback.svg';

// Swap to the local fallback once. The marker stops the loop that would start if the fallback itself failed too.
export function swapToFallback(event) {
  const image = event.currentTarget;
  if (image.dataset.fallback === 'used') return;
  image.dataset.fallback = 'used';
  image.src = FALLBACK_SRC;
}
