// tests/keys.test.js
import { describe, expect, it } from 'vitest';
import { KEYS, midiToFrequency } from '../src/music/keys.js';

const byName = (name) => KEYS.find((key) => key.noteName === name);

describe('KEYS', () => {
  it('has the 88 keys of a piano, A0 to C8, in pitch order', () => {
    expect(KEYS).toHaveLength(88);
    expect(KEYS[0]).toMatchObject({ midi: 21, noteName: 'A0' });
    expect(KEYS.at(-1)).toMatchObject({ midi: 108, noteName: 'C8' });
    KEYS.forEach((key, index) => expect(key.midi).toBe(21 + index));
  });

  it('has 52 white keys and 36 black keys', () => {
    expect(KEYS.filter((key) => !key.isBlack)).toHaveLength(52);
    expect(KEYS.filter((key) => key.isBlack)).toHaveLength(36);
  });

  it('has 5 black keys in each of the octaves 1 to 7', () => {
    for (let octave = 1; octave <= 7; octave += 1) {
      const black = KEYS.filter((key) => key.isBlack && key.noteName.endsWith(String(octave)));
      expect(black).toHaveLength(5);
    }
  });

  it('names the keys with sharps and an octave, and every name is unique', () => {
    expect(KEYS.slice(0, 5).map((key) => key.noteName)).toEqual(['A0', 'A#0', 'B0', 'C1', 'C#1']);
    expect(new Set(KEYS.map((key) => key.noteName)).size).toBe(88);
    expect(byName('C4').midi).toBe(60); // middle C
    expect(byName('C#4').isBlack).toBe(true);
    expect(byName('D4').isBlack).toBe(false);
  });

  it('gives each key its frequency from f = 440 * 2^((midi - 69) / 12)', () => {
    expect(byName('A0').freqHz).toBeCloseTo(27.5, 6);
    expect(byName('A4').freqHz).toBeCloseTo(440, 6);
    expect(byName('C4').freqHz).toBeCloseTo(261.6256, 3);
    expect(byName('C8').freqHz).toBeCloseTo(4186.009, 3);
    for (const key of KEYS) expect(key.freqHz).toBeCloseTo(440 * 2 ** ((key.midi - 69) / 12), 9);
  });

  it('has a strictly rising frequency', () => {
    KEYS.forEach((key, index) => {
      if (index > 0) expect(key.freqHz).toBeGreaterThan(KEYS[index - 1].freqHz);
    });
  });

  it('is immutable', () => {
    expect(Object.isFrozen(KEYS)).toBe(true);
    expect(KEYS.every((key) => Object.isFrozen(key))).toBe(true);
    expect(() => KEYS.push({})).toThrow(TypeError);
    expect(() => {
      KEYS[0].freqHz = 1;
    }).toThrow(TypeError);
  });
});

describe('midiToFrequency', () => {
  it('doubles the frequency for every octave', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(81)).toBe(880);
    expect(midiToFrequency(57)).toBe(220);
  });
});
