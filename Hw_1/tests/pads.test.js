// tests/pads.test.js
import { describe, expect, it } from 'vitest';
import { PADS, PAD_BY_CODE } from '../src/data/pads.js';

describe('PADS', () => {
  it('defines the 7 drum pads with physical key codes', () => {
    expect(PADS.map((pad) => pad.code)).toEqual([
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyK', 'KeyL',
    ]);
    expect(PADS.map((pad) => pad.keyLabel)).toEqual(['W', 'A', 'S', 'D', 'J', 'K', 'L']);
  });

  it('gives every pad a unique id, a label and a key label', () => {
    const ids = PADS.map((pad) => pad.id);
    expect(new Set(ids).size).toBe(PADS.length);
    for (const pad of PADS) {
      expect(pad.label).toBeTruthy();
      expect(pad.keyLabel).toHaveLength(1);
    }
  });

  it('maps keys to the agreed sounds', () => {
    const byKey = Object.fromEntries(PADS.map((pad) => [pad.keyLabel, pad.id]));
    expect(byKey).toEqual({
      W: 'tomHigh', A: 'snare', S: 'kick', D: 'hatClosed', J: 'tomLow', K: 'hatOpen', L: 'crash',
    });
  });

  it('never uses the deprecated keyCode', () => {
    for (const pad of PADS) expect(Object.keys(pad)).not.toContain('keyCode');
  });

  it('is immutable (modules run in strict mode, so changes throw)', () => {
    expect(Object.isFrozen(PADS)).toBe(true);
    expect(() => PADS.push({})).toThrow(TypeError);
    expect(() => {
      PADS[0].code = 'KeyZ';
    }).toThrow(TypeError);
    expect(() => {
      delete PADS[0].id;
    }).toThrow(TypeError);
  });
});

describe('PAD_BY_CODE', () => {
  it('finds a pad by KeyboardEvent.code', () => {
    expect(PAD_BY_CODE.get('KeyS')).toBe(PADS[2]);
    expect(PAD_BY_CODE.get('KeyZ')).toBeUndefined();
    expect(PAD_BY_CODE.size).toBe(7);
  });

  it('cannot be changed by accident', () => {
    expect(() => PAD_BY_CODE.set('KeyZ', {})).toThrow(TypeError);
    expect(() => PAD_BY_CODE.delete('KeyW')).toThrow(TypeError);
    expect(() => PAD_BY_CODE.clear()).toThrow(TypeError);
    expect(PAD_BY_CODE.size).toBe(7);
  });
});
