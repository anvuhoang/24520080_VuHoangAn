// tests/galleryParams.test.js — the URL <-> state helpers.
import { describe, expect, it } from 'vitest';
import { ALL, galleryQuery, neighbours, parseGalleryParams, photosOf } from '../src/gallery/galleryParams.js';
import { PHOTOS } from '../src/gallery/photos.js';

const parse = (query) => parseGalleryParams(new URLSearchParams(query));

describe('parseGalleryParams', () => {
  it('defaults to all categories and no photo', () => {
    expect(parse('')).toEqual({ category: ALL, photoId: null });
  });
  it('reads a known category and a photo id', () => {
    expect(parse('category=chat&photoId=c2')).toEqual({ category: 'chat', photoId: 'c2' });
  });
  it('falls back to "all" for an unknown category instead of an empty page', () => {
    expect(parse('category=nope').category).toBe(ALL);
    expect(parse('category=__proto__').category).toBe(ALL);
    expect(parse('category=').category).toBe(ALL);
  });
  it('is case sensitive: "Chat" is not "chat"', () => {
    expect(parse('category=Chat').category).toBe(ALL);
  });
  it('returns the photo id as written, so a missing photo can be reported', () => {
    expect(parse('photoId=zzz').photoId).toBe('zzz');
  });
  it('treats an empty photoId as no photo', () => {
    expect(parse('photoId=').photoId).toBeNull();
  });
});

describe('galleryQuery', () => {
  it('leaves the URL clean for "all" and no photo', () => {
    expect(galleryQuery()).toBe('');
    expect(galleryQuery({ category: ALL })).toBe('');
  });
  it('writes category and photo', () => {
    expect(galleryQuery({ category: 'match', photoId: 'm1' })).toBe('category=match&photoId=m1');
    expect(galleryQuery({ photoId: 'm1' })).toBe('photoId=m1');
  });
  it('encodes values, so an id cannot add a parameter', () => {
    expect(galleryQuery({ photoId: 'a&category=chat' })).toBe('photoId=a%26category%3Dchat');
  });
  it('round-trips through parseGalleryParams', () => {
    const query = galleryQuery({ category: 'replay', photoId: 'r2' });
    expect(parse(query)).toEqual({ category: 'replay', photoId: 'r2' });
  });
});

describe('photosOf', () => {
  it('returns every photo for "all"', () => {
    expect(photosOf(PHOTOS, ALL)).toHaveLength(PHOTOS.length);
  });
  it('returns only the category, in data order', () => {
    expect(photosOf(PHOTOS, 'chat').map((p) => p.id)).toEqual(['c1', 'c2', 'c3']);
  });
});

describe('neighbours', () => {
  const list = ['a', 'b', 'c'].map((id) => ({ id }));
  it('returns the previous and next photo', () => {
    expect(neighbours(list, 1)).toEqual({ previous: list[0], next: list[2] });
  });
  it('wraps around at both ends', () => {
    expect(neighbours(list, 0).previous).toBe(list[2]);
    expect(neighbours(list, 2).next).toBe(list[0]);
  });
  it('returns nothing when no photo is selected or the list is empty', () => {
    expect(neighbours(list, -1)).toEqual({ previous: null, next: null });
    expect(neighbours([], 0)).toEqual({ previous: null, next: null });
  });
  it('a single photo is its own neighbour', () => {
    expect(neighbours([list[0]], 0)).toEqual({ previous: list[0], next: list[0] });
  });
});
