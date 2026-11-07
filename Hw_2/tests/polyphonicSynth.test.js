// tests/polyphonicSynth.test.js
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPolyphonicSynth } from '../src/audio/polyphonicSynth.js';
import { installFakeAudio } from './fakeAudio.js';

let audio;

beforeEach(() => {
  audio = installFakeAudio();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const playNotes = (synth, midis) => midis.forEach((midi) => synth.noteOn(midi, hz(midi)));

describe('createPolyphonicSynth', () => {
  it('creates no audio context until the first note (browser autoplay rules)', () => {
    const synth = createPolyphonicSynth();
    expect(audio.contexts).toHaveLength(0);
    expect(synth.activeCount).toBe(0);

    synth.noteOn(69, 440);
    expect(audio.contexts).toHaveLength(1);
    expect(audio.contexts[0].resume).toHaveBeenCalled();
  });

  it('starts one oscillator at the note frequency', () => {
    const synth = createPolyphonicSynth();
    synth.noteOn(69, 440);

    const [oscillator] = audio.oscillators();
    expect(oscillator.playedHz).toBe(440);
    expect(oscillator.start).toHaveBeenCalledTimes(1);
    expect(synth.activeCount).toBe(1);
  });

  it('sounds at most 8 notes and takes over the OLDEST one for the 9th', () => {
    const synth = createPolyphonicSynth();
    playNotes(synth, [60, 61, 62, 63, 64, 65, 66, 67, 68]);

    const oscillators = audio.oscillators();
    expect(oscillators).toHaveLength(9);
    expect(synth.activeCount).toBe(8);
    expect(oscillators[0].stop).toHaveBeenCalledTimes(1); // the first note played is the one that stopped
    expect(oscillators[0].playedHz).toBeCloseTo(hz(60), 9);
    oscillators.slice(1).forEach((oscillator) => expect(oscillator.stop).not.toHaveBeenCalled());
  });

  it('takes voices over in the order they were played (first in, first out)', () => {
    const synth = createPolyphonicSynth();
    let most = 0;
    for (let midi = 30; midi < 50; midi += 1) {
      synth.noteOn(midi, hz(midi));
      most = Math.max(most, synth.activeCount);
    }

    expect(most).toBe(8);
    expect(synth.activeCount).toBe(8);
    const stopped = audio.oscillators().filter((oscillator) => oscillator.stop.mock.calls.length > 0);
    expect(stopped.map((oscillator) => Math.round(Math.log2(oscillator.playedHz / 440) * 12 + 69))).toEqual(
      Array.from({ length: 12 }, (_, index) => 30 + index)
    );
  });

  it('honours a smaller voice limit', () => {
    const synth = createPolyphonicSynth({ maxVoices: 3 });
    playNotes(synth, [60, 62, 64, 65]);

    expect(synth.activeCount).toBe(3);
    expect(audio.oscillators()[0].stop).toHaveBeenCalledTimes(1);
  });

  it('does not add a second voice for a note that is already sounding', () => {
    const synth = createPolyphonicSynth();
    playNotes(synth, [65, 65, 65]);

    expect(audio.oscillators()).toHaveLength(1);
    expect(synth.activeCount).toBe(1);
  });

  it('fades out only the note that is released', () => {
    const synth = createPolyphonicSynth();
    playNotes(synth, [60, 62, 64]);

    synth.noteOff(62);

    const [c, d, e] = audio.oscillators();
    expect(d.stop).toHaveBeenCalledTimes(1);
    expect(c.stop).not.toHaveBeenCalled();
    expect(e.stop).not.toHaveBeenCalled();
    expect(synth.activeCount).toBe(2);
  });

  it('ignores noteOff for a note that is not sounding, also when repeated', () => {
    const synth = createPolyphonicSynth();
    playNotes(synth, [60]);

    expect(() => {
      synth.noteOff(62);
      synth.noteOff(60);
      synth.noteOff(60);
    }).not.toThrow();
    expect(audio.oscillators()[0].stop).toHaveBeenCalledTimes(1);
  });

  it('lets a note be played again after it was released', () => {
    const synth = createPolyphonicSynth();
    synth.noteOn(60, hz(60));
    synth.noteOff(60);
    synth.noteOn(60, hz(60));

    expect(audio.oscillators()).toHaveLength(2);
    expect(synth.activeCount).toBe(1);
  });

  it('silences everything with stopAll', () => {
    const synth = createPolyphonicSynth();
    playNotes(synth, [60, 62, 64, 65, 67]);

    synth.stopAll();

    expect(synth.activeCount).toBe(0);
    audio.oscillators().forEach((oscillator) => expect(oscillator.stop).toHaveBeenCalledTimes(1));
  });

  it('starts every voice from silence and ends it at silence, never exactly 0 (no click or pop)', () => {
    const synth = createPolyphonicSynth();
    playNotes(synth, [60, 64]);
    synth.noteOff(60);
    synth.stopAll();

    const voiceGains = audio.contexts[0].gains.slice(1); // the first gain is the master output
    expect(voiceGains).toHaveLength(2);
    for (const gain of voiceGains) {
      const [startValue] = gain.gain.setCalls[0];
      expect(startValue).toBeGreaterThan(0);
      expect(startValue).toBeLessThan(0.001);
      for (const [target] of gain.gain.rampCalls) expect(target).toBeGreaterThan(0);
      expect(gain.gain.rampCalls.at(-1)[0]).toBeLessThan(0.001);
      expect(gain.gain.cancelScheduledValues).toHaveBeenCalled(); // the release starts from the level it has reached
    }
  });

  it('lets each voice disconnect its own nodes once it has finished', () => {
    const synth = createPolyphonicSynth();
    synth.noteOn(60, hz(60));
    synth.noteOff(60);

    const [oscillator] = audio.oscillators();
    expect(oscillator.onended).toBeTypeOf('function');
    oscillator.onended();
    expect(oscillator.disconnect).toHaveBeenCalled();
  });

  it('closes the audio context on dispose and is safe to dispose twice', () => {
    const synth = createPolyphonicSynth();
    playNotes(synth, [60, 62]);

    expect(() => {
      synth.dispose();
      synth.dispose();
    }).not.toThrow();

    expect(audio.contexts[0].close).toHaveBeenCalledTimes(1);
    expect(synth.activeCount).toBe(0);
    audio.oscillators().forEach((oscillator) => expect(oscillator.stop).toHaveBeenCalled());
  });

  it('does nothing after dispose, and does not open a new context', () => {
    const synth = createPolyphonicSynth();
    synth.dispose();

    synth.noteOn(60, hz(60));

    expect(audio.contexts).toHaveLength(0);
    expect(synth.activeCount).toBe(0);
  });

  it('ignores notes with an invalid number or frequency', () => {
    const synth = createPolyphonicSynth();

    synth.noteOn(Number.NaN, 440);
    synth.noteOn(60, Number.NaN);
    synth.noteOn(60, -10);
    synth.noteOn(60, 0);
    synth.noteOn('60', 440);
    synth.noteOn(undefined, undefined);

    expect(audio.contexts).toHaveLength(0);
    expect(synth.activeCount).toBe(0);
  });

  it('falls back to 8 voices for an invalid limit', () => {
    const synth = createPolyphonicSynth({ maxVoices: 0 });
    playNotes(synth, [60, 61, 62, 63, 64, 65, 66, 67, 68]);
    expect(synth.activeCount).toBe(8);
  });

  it('does not log anything to the console', () => {
    const spies = ['log', 'info', 'warn', 'error'].map((method) => vi.spyOn(console, method));
    const synth = createPolyphonicSynth();
    playNotes(synth, [60, 61, 62, 63, 64, 65, 66, 67, 68]);
    synth.noteOff(61);
    synth.stopAll();
    synth.dispose();
    synth.dispose();

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
