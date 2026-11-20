// client/tests/appealRules.test.js — the rules of an appeal, with their borders. The server imports the same file.
import { describe, expect, it } from 'vitest';
import { CATEGORIES, EMPTY_APPEAL, FIELDS, LIMITS, normalizeAppeal, validateAppeal } from '../src/appeal/appealRules.js';

const statement = (n) => 'a'.repeat(n);
const valid = (extra = {}) => ({
  appellantName: 'Himass',
  email: 'himass@example.com',
  category: 'false-positive',
  statement: statement(50),
  evidenceUrl: '',
  confirm: true,
  ...extra,
});

describe('validateAppeal', () => {
  it('accepts a complete appeal', () => {
    expect(validateAppeal(valid())).toEqual({});
  });

  it('the empty form fails on every required field and not on the optional one', () => {
    expect(Object.keys(validateAppeal(EMPTY_APPEAL)).sort()).toEqual(['appellantName', 'category', 'confirm', 'email', 'statement']);
  });

  it('does not throw on a missing or null value object', () => {
    expect(Object.keys(validateAppeal(undefined)).length).toBeGreaterThan(0);
    expect(Object.keys(validateAppeal(null)).length).toBeGreaterThan(0);
  });

  describe('name', () => {
    it.each([
      [1, true],
      [2, false],
      [60, false],
      [61, true],
    ])('%i characters: error is %s', (n, bad) => {
      expect('appellantName' in validateAppeal(valid({ appellantName: 'n'.repeat(n) }))).toBe(bad);
    });
    it('counts the trimmed text: spaces do not make a name', () => {
      expect(validateAppeal(valid({ appellantName: '   a   ' })).appellantName).toMatch(/at least 2/);
    });
    it('is text', () => {
      expect(validateAppeal(valid({ appellantName: { $ne: null } })).appellantName).toBe('Enter your name.');
    });
  });

  describe('email', () => {
    it.each(['a@b.co', 'first.last@sub.example.org', ' a@b.co '])('accepts %j', (email) => {
      expect(validateAppeal(valid({ email })).email).toBeUndefined();
    });
    it.each(['', 'plain', 'a@', '@b.co', 'a@b', 'a b@c.co', 'a@@b.co', 'a@b..', 'a@.b.co', 'a@b..co', 'a@b.'])('rejects %j', (email) => {
      expect(validateAppeal(valid({ email })).email).toBeTruthy();
    });
    it('rejects one longer than 254 characters', () => {
      expect(validateAppeal(valid({ email: `${'a'.repeat(250)}@b.co` })).email).toBeTruthy();
    });
    it('is text', () => {
      expect(validateAppeal(valid({ email: ['a@b.co'] })).email).toBeTruthy();
    });
  });

  describe('category', () => {
    it('accepts each listed reason', () => {
      for (const c of CATEGORIES) expect(validateAppeal(valid({ category: c.id })).category).toBeUndefined();
    });
    it.each(['', 'nope', 'Other', 'constructor', '__proto__'])('rejects %j', (category) => {
      expect(validateAppeal(valid({ category })).category).toBeTruthy();
    });
  });

  describe('statement and the cross-field rule', () => {
    it.each([
      [49, true],
      [50, false],
      [1000, false],
      [1001, true],
    ])('%i characters, named reason: error is %s', (n, bad) => {
      expect('statement' in validateAppeal(valid({ statement: statement(n) }))).toBe(bad);
    });
    it.each([
      [99, true],
      [100, false],
    ])('%i characters with "Other": error is %s', (n, bad) => {
      expect('statement' in validateAppeal(valid({ category: 'other', statement: statement(n) }))).toBe(bad);
    });
    it('the same 60 characters are enough for a named reason and not for "Other"', () => {
      expect(validateAppeal(valid({ category: 'technical-issue', statement: statement(60) })).statement).toBeUndefined();
      expect(validateAppeal(valid({ category: 'other', statement: statement(60) })).statement).toMatch(/"Other".*at least 100/);
    });
    it('changing the category changes the error of another field (it depends on two values)', () => {
      const before = validateAppeal(valid({ category: 'false-positive', statement: statement(60) }));
      const after = validateAppeal(valid({ category: 'other', statement: statement(60) }));
      expect(before.statement).toBeUndefined();
      expect(after.statement).toBeTruthy();
    });
    it('counts the trimmed text', () => {
      expect(validateAppeal(valid({ statement: ` ${statement(48)} ` })).statement).toBeTruthy();
    });
    it('is text', () => {
      expect(validateAppeal(valid({ statement: 12345 })).statement).toBe('Write your statement.');
    });
  });

  describe('evidence link (optional, https only)', () => {
    it.each(['', undefined, null])('%j is fine', (evidenceUrl) => {
      expect(validateAppeal(valid({ evidenceUrl })).evidenceUrl).toBeUndefined();
    });
    it('accepts an https link', () => {
      expect(validateAppeal(valid({ evidenceUrl: 'https://example.com/replay/42?t=3' })).evidenceUrl).toBeUndefined();
    });
    it.each([
      'http://example.com',
      'javascript:alert(1)',
      'data:text/html,<script>1</script>',
      'ftp://example.com',
      'https://',
      'https://user:secret@example.com/',
      'example.com/replay',
      '//example.com',
    ])('rejects %j', (evidenceUrl) => {
      expect(validateAppeal(valid({ evidenceUrl })).evidenceUrl).toBeTruthy();
    });
    it('rejects one longer than 300 characters', () => {
      expect(validateAppeal(valid({ evidenceUrl: `https://example.com/${'a'.repeat(290)}` })).evidenceUrl).toBeTruthy();
    });
    it('rejects a value that is not text', () => {
      expect(validateAppeal(valid({ evidenceUrl: { href: 'https://a.co' } })).evidenceUrl).toBeTruthy();
    });
  });

  describe('confirmation', () => {
    it('must be exactly true', () => {
      expect(validateAppeal(valid({ confirm: true })).confirm).toBeUndefined();
      for (const confirm of [false, 'true', 1, 'on', undefined, null]) expect(validateAppeal(valid({ confirm })).confirm).toBeTruthy();
    });
  });

  it('is pure: the same input gives equal output and the input is not changed', () => {
    const input = valid({ email: 'bad' });
    const copy = { ...input };
    expect(validateAppeal(input)).toEqual(validateAppeal(input));
    expect(input).toEqual(copy);
  });
});

describe('normalizeAppeal', () => {
  it('trims, lower-cases the email and keeps exactly the known fields', () => {
    const out = normalizeAppeal({ ...valid(), appellantName: '  Ada ', email: ' ADA@Example.com ', statement: ` ${statement(50)} `, playerId: 'tanvuu', _id: 'x', isAdmin: true });
    expect(Object.keys(out).sort()).toEqual([...FIELDS].sort());
    expect(out.appellantName).toBe('Ada');
    expect(out.email).toBe('ada@example.com');
    expect(out.statement).toBe(statement(50));
  });
  it('turns anything that is not text into an empty string and a non-true confirm into false', () => {
    const out = normalizeAppeal({ appellantName: { $ne: 1 }, email: 5, category: null, statement: [], evidenceUrl: undefined, confirm: 'true' });
    expect(out).toEqual({ appellantName: '', email: '', category: '', statement: '', evidenceUrl: '', confirm: false });
  });
  it('does not throw on nothing', () => {
    expect(normalizeAppeal(undefined)).toEqual({ appellantName: '', email: '', category: '', statement: '', evidenceUrl: '', confirm: false });
  });
});

describe('constants', () => {
  it('are frozen', () => {
    expect(Object.isFrozen(CATEGORIES)).toBe(true);
    expect(Object.isFrozen(LIMITS)).toBe(true);
    expect(Object.isFrozen(EMPTY_APPEAL)).toBe(true);
  });
});
