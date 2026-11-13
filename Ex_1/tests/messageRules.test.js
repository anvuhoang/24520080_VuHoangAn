// tests/messageRules.test.js
import { describe, expect, it } from 'vitest';
import { MAX_AUTHOR_LENGTH, MAX_TEXT_LENGTH, pickMessageFields, validateMessage } from '../src/forum/messageRules.js';

const ok = { author: 'Ada', text: 'Hello' };

describe('validateMessage', () => {
  it('accepts a normal message', () => {
    expect(validateMessage(ok)).toEqual({});
  });

  it('requires both fields, also when they are only spaces', () => {
    expect(validateMessage({})).toEqual({ author: 'Author is required.', text: 'Message text is required.' });
    expect(validateMessage({ author: '   ', text: '\n\t' })).toEqual({ author: 'Author is required.', text: 'Message text is required.' });
    expect(validateMessage({ author: 'Ada' }).text).toBe('Message text is required.');
    expect(validateMessage({ text: 'Hello' }).author).toBe('Author is required.');
  });

  it('limits the author to 40 characters and the text to 280, counted after trimming', () => {
    expect(MAX_AUTHOR_LENGTH).toBe(40);
    expect(MAX_TEXT_LENGTH).toBe(280);
    expect(validateMessage({ ...ok, author: 'a'.repeat(40) }).author).toBeUndefined();
    expect(validateMessage({ ...ok, author: 'a'.repeat(41) }).author).toBe('Author must have at most 40 characters.');
    expect(validateMessage({ ...ok, author: ` ${'a'.repeat(40)} ` }).author).toBeUndefined();
    expect(validateMessage({ ...ok, text: 'b'.repeat(280) }).text).toBeUndefined();
    expect(validateMessage({ ...ok, text: 'b'.repeat(281) }).text).toBe('Message must have at most 280 characters.');
  });

  it('rejects values that are not strings', () => {
    for (const value of [5, true, null, undefined, {}, [], ['Ada']]) {
      const errors = validateMessage({ author: value, text: value });
      expect(Object.keys(errors).sort()).toEqual(['author', 'text']);
    }
  });

  it('copes with a body that is not an object', () => {
    for (const body of [undefined, null, 'text', 42, [], true]) {
      expect(Object.keys(validateMessage(body)).sort()).toEqual(['author', 'text']);
    }
  });

  it('is pure and does not change its input', () => {
    const input = Object.freeze({ author: ' Ada ', text: ' Hi ' });
    expect(validateMessage(input)).toEqual(validateMessage(input));
    expect(input.author).toBe(' Ada ');
  });
});

describe('pickMessageFields', () => {
  it('returns only the trimmed author and text, never anything else that was sent', () => {
    const picked = pickMessageFields({ author: '  Ada ', text: ' Hi ', id: 'hacked', timestamp: 'never', admin: true });
    expect(picked).toEqual({ author: 'Ada', text: 'Hi' });
    expect(Object.keys(picked)).toEqual(['author', 'text']);
  });
});
