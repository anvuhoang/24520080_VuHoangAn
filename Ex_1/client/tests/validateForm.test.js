// client/tests/validateForm.test.js
import { describe, expect, it } from 'vitest';
import { FIELD_NAMES, INITIAL_VALUES, isFormValid, validateForm } from '../src/sprint2-form/validateForm.js';

const valid = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'Secret123!', confirmPassword: 'Secret123!' };

describe('validateForm', () => {
  it('has no error for valid values', () => {
    expect(validateForm(valid)).toEqual({});
    expect(isFormValid(validateForm(valid))).toBe(true);
  });

  it('reports one message for every field of an empty form', () => {
    const errors = validateForm(INITIAL_VALUES);
    expect(Object.keys(errors)).toEqual(['name', 'email', 'password', 'confirmPassword']);
    expect(errors.confirmPassword).toBe('Confirm the password.');
    expect(isFormValid(errors)).toBe(false);
  });

  it('needs a name of at least 2 characters once the spaces around it are removed', () => {
    expect(validateForm({ ...valid, name: 'A' }).name).toBe('Name must have at least 2 characters.');
    expect(validateForm({ ...valid, name: '  A  ' }).name).toBeDefined();
    expect(validateForm({ ...valid, name: '   ' }).name).toBeDefined();
    expect(validateForm({ ...valid, name: 'Al' }).name).toBeUndefined();
    expect(validateForm({ ...valid, name: ' Al ' }).name).toBeUndefined();
  });

  it('accepts ordinary email addresses and rejects the broken ones', () => {
    for (const email of ['a@b.co', 'first.last@sub.example.org', ' ada@example.com ', 'a+tag@example.com']) {
      expect(validateForm({ ...valid, email }).email).toBeUndefined();
    }
    for (const email of ['', 'ada', 'ada@', '@example.com', 'ada@example', 'ada @example.com', 'ada@exa mple.com', 'a@@b.co']) {
      expect(validateForm({ ...valid, email }).email).toBe('Enter a valid email address.');
    }
  });

  it('needs a password of at least 8 characters (7 is too short, 8 is enough, spaces count)', () => {
    expect(validateForm({ ...valid, password: '1234567', confirmPassword: '1234567' }).password).toBeDefined();
    expect(validateForm({ ...valid, password: '12345678', confirmPassword: '12345678' }).password).toBeUndefined();
    expect(validateForm({ ...valid, password: '        ', confirmPassword: '        ' }).password).toBeUndefined();
  });

  it('checks the confirmation against the password (a rule that depends on two fields)', () => {
    expect(validateForm({ ...valid, confirmPassword: '' }).confirmPassword).toBe('Confirm the password.');
    expect(validateForm({ ...valid, confirmPassword: 'secret123!' }).confirmPassword).toBe('Passwords do not match.');
    expect(validateForm({ ...valid, confirmPassword: 'Secret123!' }).confirmPassword).toBeUndefined();
    // Changing only the password changes the result for the confirmation
    expect(validateForm({ ...valid, password: 'Another456?' }).confirmPassword).toBe('Passwords do not match.');
  });

  it('treats a missing field as empty and does not throw for odd input', () => {
    expect(validateForm({})).toEqual(validateForm(INITIAL_VALUES));
    expect(validateForm()).toEqual(validateForm(INITIAL_VALUES));
    expect(validateForm(null)).toEqual(validateForm(INITIAL_VALUES));
    expect(() => validateForm({ name: 5, email: null, password: undefined, confirmPassword: [] })).not.toThrow();
  });

  it('is pure: the same input gives the same output, and the input is not changed', () => {
    const input = Object.freeze({ ...valid, name: 'A' });
    const first = validateForm(input);
    expect(validateForm(input)).toEqual(first);
    expect(first).not.toBe(validateForm(input));
    expect(input.name).toBe('A');
  });

  it('exposes the field names and a frozen initial state', () => {
    expect(FIELD_NAMES).toEqual(['name', 'email', 'password', 'confirmPassword']);
    expect(Object.isFrozen(INITIAL_VALUES)).toBe(true);
    expect(isFormValid(undefined)).toBe(true);
  });
});
