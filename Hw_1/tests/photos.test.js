// tests/photos.test.js — the data and the files it points at.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, PHOTOS } from '../src/gallery/photos.js';

describe('photos', () => {
  it('has unique ids', () => {
    expect(new Set(PHOTOS.map((p) => p.id)).size).toBe(PHOTOS.length);
  });
  it('uses only known categories and every category has photos', () => {
    const ids = CATEGORIES.map((c) => c.id);
    for (const p of PHOTOS) expect(ids).toContain(p.category);
    for (const id of ids) expect(PHOTOS.some((p) => p.category === id)).toBe(true);
  });
  it('has a real description (alt) that differs from the title, so a link does not read the same text twice', () => {
    for (const p of PHOTOS) {
      expect(p.alt.length).toBeGreaterThan(15);
      expect(p.alt.toLowerCase()).not.toBe(p.title.toLowerCase());
    }
  });
  it('has the dimensions of its file in the data (so the box is reserved before the image loads)', () => {
    for (const p of PHOTOS) {
      const svg = readFileSync(join('public', p.src), 'utf8');
      expect(svg).toContain(`width="${p.width}"`);
      expect(svg).toContain(`height="${p.height}"`);
    }
  });
  it('points at files that exist, each under 5 kB', () => {
    for (const p of PHOTOS) {
      const file = join('public', p.src);
      expect(existsSync(file), file).toBe(true);
      expect(readFileSync(file).length).toBeLessThan(5000);
    }
  });
  it('is frozen', () => {
    expect(Object.isFrozen(PHOTOS)).toBe(true);
    expect(Object.isFrozen(PHOTOS[0])).toBe(true);
    expect(Object.isFrozen(CATEGORIES)).toBe(true);
  });
});

describe('static files', () => {
  it('serves a valid robots.txt (a missing one is answered with index.html and fails the Lighthouse SEO audit)', () => {
    const text = readFileSync(join('public', 'robots.txt'), 'utf8');
    expect(text).toMatch(/^User-agent: \*$/m);
    expect(text).not.toMatch(/<html/i);
  });
  it('has a local fallback image for a broken photo', () => {
    expect(existsSync(join('public', 'photos', 'fallback.svg'))).toBe(true);
  });
});
